import utils from "./utils.js";
import toastService from "./toast.js";
import server from "./server.js";
import options from "./options.js";
import frocaUpdater from "./froca_updater.js";
import appContext from "../components/app_context.js";
import { t } from "./i18n.js";
import type { EntityChange } from "../server_types.js";

type MessageHandler = (message: any) => void;
type ConnectionHandler = (socket: WebSocket) => void;
type PreconnectHandshakeHandler = { reset?: (socket: WebSocket) => Promise<boolean>, pre?: (socket: WebSocket) => Promise<boolean>, main?: (socket: WebSocket) => Promise<boolean>, post?: (socket: WebSocket) => Promise<boolean> };

const messageHandlers: MessageHandler[] = [];
const disconnectHandlers: ConnectionHandler[] = [];
const connectHandlers: ConnectionHandler[] = [];
const reconnectHandlers: ConnectionHandler[] = [];
const preconnectHandshakeHandlers: PreconnectHandshakeHandler[] = [];
const prereconnectHandshakeHandlers: PreconnectHandshakeHandler[] = [];

let ws: WebSocket;
let lastAcceptedEntityChangeId = window.glob.maxEntityChangeIdAtLoad;
let lastAcceptedEntityChangeSyncId = window.glob.maxEntityChangeSyncIdAtLoad;
let lastProcessedEntityChangeId = window.glob.maxEntityChangeIdAtLoad;
let lastPingTs: number;
let frontendUpdateDataQueue: EntityChange[] = [];
let connectionLostToastShown = false;
let connectionActive = false;
let connectionIsReconnect = false;
let connectionFailed = false;

export function logError(message: string) {
    console.error(utils.now(), message); // needs to be separate from .trace()

    if (ws && ws.readyState === 1) {
        ws.send(
            JSON.stringify({
                type: "log-error",
                error: message,
                stack: new Error().stack
            })
        );
    }
}

function logInfo(message: string) {
    console.log(utils.now(), message);

    if (ws && ws.readyState === 1) {
        ws.send(
            JSON.stringify({
                type: "log-info",
                info: message
            })
        );
    }
}

window.logError = logError;
window.logInfo = logInfo;

function subscribeToMessages(messageHandler: MessageHandler) {
    messageHandlers.push(messageHandler);
}

function subscribeToDisconnect(handler: ConnectionHandler) {
    disconnectHandlers.push(handler);
}

function subscribeToReconnect(handler: ConnectionHandler) {
    reconnectHandlers.push(handler);
}

function subscribeToConnect(handler: ConnectionHandler) {
    connectHandlers.push(handler);
}

function subscribeToPreConnectHandshake(handler: PreconnectHandshakeHandler) {
    preconnectHandshakeHandlers.push(handler);
}

function subscribeToPreReconnectHandshake(handler: PreconnectHandshakeHandler) {
    prereconnectHandshakeHandlers.push(handler);
}


// used to serialize frontend update operations
let consumeQueuePromise: Promise<void> | null = null;

// to make sure each change event is processed only once. Not clear if this is still necessary
const processedEntityChangeIds = new Set();

function logRows(entityChanges: EntityChange[]) {
    const filteredRows = entityChanges.filter((row) => !processedEntityChangeIds.has(row.id) && (row.entityName !== "options" || row.entityId !== "openNoteContexts"));

    if (filteredRows.length > 0) {
        console.debug(utils.now(), "Frontend update data: ", filteredRows);
    }
}

async function executeFrontendUpdate(entityChanges: EntityChange[]) {
    lastPingTs = Date.now();

    if (entityChanges.length > 0) {
        logRows(entityChanges);

        frontendUpdateDataQueue.push(...entityChanges);

        // we set lastAcceptedEntityChangeId even before frontend update processing and send ping so that backend can start sending more updates

        for (const entityChange of entityChanges) {
            if (!entityChange.id) {
                continue;
            }

            lastAcceptedEntityChangeId = Math.max(lastAcceptedEntityChangeId, entityChange.id);

            if (entityChange.isSynced) {
                lastAcceptedEntityChangeSyncId = Math.max(lastAcceptedEntityChangeSyncId, entityChange.id);
            }
        }

        sendPing();

        // first wait for all the preceding consumers to finish
        while (consumeQueuePromise) {
            await consumeQueuePromise;
        }

        try {
            // it's my turn, so start it up
            consumeQueuePromise = consumeFrontendUpdateData();

            await consumeQueuePromise;
        } finally {
            // finish and set to null to signal somebody else can pick it up
            consumeQueuePromise = null;
        }
    }
}

async function handleMessage(event: MessageEvent<any>) {
    // Skip crashed
    if (connectionFailed)
        return;

    // Read
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === "ping") {
        lastPingTs = Date.now();
    } else if (message.type === "reload-frontend") {
        utils.reloadFrontendApp("received request from backend to reload frontend");
    } else if (message.type === "frontend-update") {
        await executeFrontendUpdate(message.data.entityChanges);
    } else if (message.type === "sync-hash-check-failed") {
        toastService.showError(t("ws.sync-check-failed"), 60000);
    } else if (message.type === "consistency-checks-failed") {
        toastService.showError(t("ws.consistency-checks-failed"), 50 * 60000);
    } else if (message.type === "api-log-messages") {
        appContext.triggerEvent("apiLogMessages", { noteId: message.noteId, messages: message.messages });
    } else if (message.type === "toast") {
        toastService.showMessage(message.message);
    } else if (message.type === "llm-stream") {
        // ENHANCED LOGGING FOR DEBUGGING
        console.log(`[WS-CLIENT] >>> RECEIVED LLM STREAM MESSAGE <<<`);
        console.log(`[WS-CLIENT] Message details: sessionId=${message.sessionId}, hasContent=${!!message.content}, contentLength=${message.content ? message.content.length : 0}, hasThinking=${!!message.thinking}, hasToolExecution=${!!message.toolExecution}, isDone=${!!message.done}`);

        if (message.content) {
            console.log(`[WS-CLIENT] CONTENT PREVIEW: "${message.content.substring(0, 50)}..."`);
        }

        // Create the event with detailed logging
        console.log(`[WS-CLIENT] Creating CustomEvent 'llm-stream-message'`);
        const llmStreamEvent = new CustomEvent('llm-stream-message', { detail: message });

        // Dispatch to multiple targets to ensure delivery
        try {
            console.log(`[WS-CLIENT] Dispatching event to window`);
            window.dispatchEvent(llmStreamEvent);
            console.log(`[WS-CLIENT] Event dispatched to window`);

            // Also try document for completeness
            console.log(`[WS-CLIENT] Dispatching event to document`);
            document.dispatchEvent(new CustomEvent('llm-stream-message', { detail: message }));
            console.log(`[WS-CLIENT] Event dispatched to document`);
        } catch (err) {
            console.error(`[WS-CLIENT] Error dispatching event:`, err);
        }

        // Debug current listeners (though we can't directly check for specific event listeners)
        console.log(`[WS-CLIENT] Active event listeners should receive this message now`);

        // Detailed logging based on message type
        if (message.content) {
            console.log(`[WS-CLIENT] Content message: ${message.content.length} chars`);
        } else if (message.thinking) {
            console.log(`[WS-CLIENT] Thinking update: "${message.thinking}"`);
        } else if (message.toolExecution) {
            console.log(`[WS-CLIENT] Tool execution: action=${message.toolExecution.action}, tool=${message.toolExecution.tool || 'unknown'}`);
            if (message.toolExecution.result) {
                console.log(`[WS-CLIENT] Tool result preview: "${String(message.toolExecution.result).substring(0, 50)}..."`);
            }
        } else if (message.done) {
            console.log(`[WS-CLIENT] Completion signal received`);
        }
    } else if (message.type === "execute-script") {
        // TODO: Remove after porting the file
        // @ts-ignore
        const bundleService = (await import("./bundle.js")).default as any;
        // TODO: Remove after porting the file
        // @ts-ignore
        const froca = (await import("./froca.js")).default as any;
        const originEntity = message.originEntityId ? await froca.getNote(message.originEntityId) : null;

        bundleService.getAndExecuteBundle(message.currentNoteId, originEntity, message.script, message.params);
    }
}

let entityChangeIdReachedListeners: {
    desiredEntityChangeId: number;
    resolvePromise: () => void;
    start: number;
}[] = [];

function waitForEntityChangeId(desiredEntityChangeId: number) {
    if (desiredEntityChangeId <= lastProcessedEntityChangeId) {
        return Promise.resolve();
    }

    console.debug(`Waiting for ${desiredEntityChangeId}, last processed is ${lastProcessedEntityChangeId}, last accepted ${lastAcceptedEntityChangeId}`);

    return new Promise<void>((res, rej) => {
        entityChangeIdReachedListeners.push({
            desiredEntityChangeId: desiredEntityChangeId,
            resolvePromise: res,
            start: Date.now()
        });
    });
}

function waitForMaxKnownEntityChangeId() {
    return waitForEntityChangeId(server.getMaxKnownEntityChangeId());
}

function checkEntityChangeIdListeners() {
    entityChangeIdReachedListeners.filter((l) => l.desiredEntityChangeId <= lastProcessedEntityChangeId).forEach((l) => l.resolvePromise());

    entityChangeIdReachedListeners = entityChangeIdReachedListeners.filter((l) => l.desiredEntityChangeId > lastProcessedEntityChangeId);

    entityChangeIdReachedListeners
        .filter((l) => Date.now() > l.start - 60000)
        .forEach((l) =>
            console.log(
                `Waiting for entityChangeId ${l.desiredEntityChangeId} while last processed is ${lastProcessedEntityChangeId} (last accepted ${lastAcceptedEntityChangeId}) for ${Math.floor((Date.now() - l.start) / 1000)}s`
            )
        );
}

async function consumeFrontendUpdateData() {
    if (frontendUpdateDataQueue.length > 0) {
        const allEntityChanges = frontendUpdateDataQueue;
        frontendUpdateDataQueue = [];

        const nonProcessedEntityChanges = allEntityChanges.filter((ec) => !processedEntityChangeIds.has(ec.id));

        try {
            await utils.timeLimit(frocaUpdater.processEntityChanges(nonProcessedEntityChanges), 30000);
        } catch (e: any) {
            logError(`Encountered error ${e.message}: ${e.stack}, reloading frontend.`);

            if (!glob.isDev && !options.is("debugModeEnabled")) {
                // if there's an error in updating the frontend, then the easy option to recover is to reload the frontend completely

                utils.reloadFrontendApp();
            } else {
                console.log("nonProcessedEntityChanges causing the timeout", nonProcessedEntityChanges);

                toastService.showError(t("ws.encountered-error", { message: e.message }));
            }
        }

        for (const entityChange of nonProcessedEntityChanges) {
            processedEntityChangeIds.add(entityChange.id);

            if (entityChange.id) {
                lastProcessedEntityChangeId = Math.max(lastProcessedEntityChangeId, entityChange.id);
            }
        }
    }

    checkEntityChangeIdListeners();
}

function uiVerifyConnection() {
    // Check connection
    if (!connectionActive) {
        // Error
        toastService.showErrorTitleAndMessage(t("ws.connection-toast-title"), t("ws.connection-toast-unavailable"), 3000);
        return false;
    }
    return true;
}

async function connectWebSocket() {
    const loc = window.location;
    const webSocketUri = `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${loc.pathname}`;

    // use wss for secure messaging
    const ws = new WebSocket(webSocketUri);
    ws.onopen = () => handleConnected(webSocketUri);
    ws.onmessage = handleMessage;
    // we're not handling ws.onclose here because reconnection is done in sendPing()

    // Verify authentication
    await verifyAuth();
    return ws;
}

function terminateConnection() {
    connectionFailed = true;
    lastPingTs = 0;
    closeSocket();
}

function closeSocket() {
    try {
        ws.send(
            JSON.stringify({
                type: "close",
                lastEntityChangeId: lastAcceptedEntityChangeId
            })
        );
    } catch { /* empty */ }
    ws.close();
}

async function verifyAuth() {
    const authResult: any = await server.get("auth/verify").catch(() => null);
    if (authResult && !authResult.auth_status) {
        // Try reauthentication
        const result: any = await server.get("auth/reauthenticate").catch(() => null);
        if (result && !result.success) {
            // Reauthentication failed
            // Terminate connection permanently with error
            connectionFailed = true;
            lastPingTs = 0;
            closeSocket();
            console.error(utils.now(), "Unable to reestablish connection to server due to having an expired session, retries cancelled");

            // Close persistent
            if (connectionLostToastShown)
                toastService.closePersistent("clientConnectionLost");

            // Show error
            toastService.showPersistent({
                id: "clientConnectionUnavailable",
                title: t("ws.connection-toast-title"),
                icon: "alert",
                message: t("ws.connection-toast-autherror"),
                preventUserClose: true,
                color: "red"
            });
            return false;
        }
    }
    return true;
}

async function handleConnected(webSocketUri: string) {
    // Debug log
    console.debug(utils.now(), `Connected to server ${webSocketUri} with WebSocket`);
    console.log(utils.now(), "WS connection established");

    // Resync time
    if (!await server.resyncTime()) {
        // Connection issue
        // Close and let the pinger reconnect
        lastPingTs = 0;
        closeSocket();
        return;
    }

    // Verify authentication
    if (!await verifyAuth()) {
        // Connection already aborted
        return;
    }

    // Dispatch connect handshake
    for (const handler of preconnectHandshakeHandlers) {
        if (handler.reset && !await handler.reset(ws)) {
            // Connection issue
            // Close and let the pinger reconnect
            lastPingTs = 0;
            closeSocket();
            return;
        }
    }
    for (const handler of preconnectHandshakeHandlers) {
        if (handler.pre && !await handler.pre(ws)) {
            // Connection issue
            // Close and let the pinger reconnect
            lastPingTs = 0;
            closeSocket();
            return;
        }
    }
    for (const handler of preconnectHandshakeHandlers) {
        if (handler.main && !await handler.main(ws)) {
            // Connection issue
            // Close and let the pinger reconnect
            lastPingTs = 0;
            closeSocket();
            return;
        }
    }
    for (const handler of preconnectHandshakeHandlers) {
        if (handler.post && !await handler.post(ws)) {
            // Connection issue
            // Close and let the pinger reconnect
            lastPingTs = 0;
            closeSocket();
            return;
        }
    }

    // Dispatch reconnect handshake
    if (connectionIsReconnect) {
        for (const handler of prereconnectHandshakeHandlers) {
            if (handler.reset && !await handler.reset(ws)) {
                // Connection issue
                // Close and let the pinger reconnect
                lastPingTs = 0;
                closeSocket();
                return;
            }
        }
        for (const handler of prereconnectHandshakeHandlers) {
            if (handler.pre && !await handler.pre(ws)) {
                // Connection issue
                // Close and let the pinger reconnect
                lastPingTs = 0;
                closeSocket();
                return;
            }
        }
        for (const handler of prereconnectHandshakeHandlers) {
            if (handler.main && !await handler.main(ws)) {
                // Connection issue
                // Close and let the pinger reconnect
                lastPingTs = 0;
                closeSocket();
                return;
            }
        }
        for (const handler of prereconnectHandshakeHandlers) {
            if (handler.post && !await handler.post(ws)) {
                // Connection issue
                // Close and let the pinger reconnect
                lastPingTs = 0;
                closeSocket();
                return;
            }
        }
    }

    // Mark active
    connectionActive = true;

    // Dispatch connect
    for (const handler of connectHandlers) {
        handler(ws);
    }


    // Dispatch reconnect
    if (connectionIsReconnect) {
        for (const handler of reconnectHandlers) {
            handler(ws);
        }
    }

    // Mark non-reconnect
    connectionIsReconnect = false;

    // Close toast if needed
    if (connectionLostToastShown) {
        // Done
        connectionLostToastShown = false;

        // Close
        toastService.closePersistent("clientConnectionLost");

        // Show reestablished
        toastService.toast({
            id: "clientConnectionReestablished",
            title: t("ws.connection-toast-title"),
            icon: "alert",
            message: t("ws.connection-toast-reestablished"),
            autohide: true,
            closeAfter: 3,
            color: "green"
        });
    }
}

async function sendPing() {
    // This method primarily handles pinging and timeouts

    // Connection timeout handler
    let wasTimeout = false;
    if (Date.now() - lastPingTs > 15000 && !connectionFailed) {
        console.log(
            utils.now(),
            "Lost websocket connection to the backend. If you keep having this issue repeatedly, you might want to check your reverse proxy (nginx, apache) configuration and allow/unblock WebSocket."
        );

        // Close if needed
        closeSocket();
        connectionIsReconnect = true;
        lastPingTs = Date.now(); // Prevent loop

        // Make sure the popup doesnt show unless the connection fails to establish a second time
        wasTimeout = true;

        // Show popup if needed
        setTimeout(() => {
            if ((ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING || ws.readyState === ws.CONNECTING) && !connectionFailed) {
                // Show toast if needed
                if (!connectionLostToastShown) {
                    // Show toast
                    connectionLostToastShown = true
                    toastService.showPersistent({
                        id: "clientConnectionLost",
                        title: t("ws.connection-toast-title"),
                        icon: "alert",
                        message: t("ws.connection-toast-lost"),
                        preventUserClose: true,
                        color: "red"
                    });
                }
            }
        }, 5000);
    }

    // Check state
    if (ws.readyState === ws.OPEN) {
        // Send ping
        ws.send(
            JSON.stringify({
                type: "ping",
                lastEntityChangeId: lastAcceptedEntityChangeId
            })
        );
    } else if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
        // Mark inactive
        if (connectionActive) {
            // Dispatch disconnect
            for (const handler of disconnectHandlers) {
                handler(ws);
            }
        }
        connectionActive = false;

        // Show toast if needed
        if (!connectionLostToastShown && !wasTimeout && !connectionFailed) {
            // Show toast
            connectionLostToastShown = true
            toastService.showPersistent({
                id: "clientConnectionLost",
                title: t("ws.connection-toast-title"),
                icon: "alert",
                message: t("ws.connection-toast-lost"),
                preventUserClose: true,
                color: "red"
            });
        }

        // Log
        if (!connectionFailed) {
            console.log(utils.now(), "WS closed or closing, trying to reconnect");

            // Try reconnect
            connectionIsReconnect = true;
            ws = await connectWebSocket();
        }
    }
}

setTimeout(async () => {
    // Resync time
    server.resyncTime();

    // Connect
    ws = await connectWebSocket();

    // Reset last ping
    lastPingTs = Date.now();

    // Start pinger
    setInterval(sendPing, 1000);
}, 0);

export function throwError(message: string) {
    logError(message);

    throw new Error(message);
}

export default {
    logError,
    subscribeToMessages,
    subscribeToConnect,
    subscribeToDisconnect,
    subscribeToReconnect,
    subscribeToPreConnectHandshake,
    subscribeToPreReconnectHandshake,
    waitForMaxKnownEntityChangeId,
    terminateConnection,
    uiVerifyConnection,
    connectionLostToastShown: () => connectionLostToastShown,
    getMaxKnownEntityChangeSyncId: () => lastAcceptedEntityChangeSyncId,
    isConnected: () => connectionActive,
    getConnection: () => ws
};
