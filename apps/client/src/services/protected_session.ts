import server from "./server.js";
import protectedSessionHolder from "./protected_session_holder.js";
import toastService from "./toast.js";
import type { ToastOptions } from "./toast.js";
import ws from "./ws.js";
import appContext from "../components/app_context.js";
import froca from "./froca.js";
import utils from "./utils.js";
import options from "./options.js";
import { t } from "./i18n.js";

let protectedSessionDeferred: JQuery.Deferred<any, any, any> | null = null;

// TODO: Deduplicate with server when possible.
interface Response {
    success: boolean;
}

interface Message {
    taskId: string;
    data: {
        protect: boolean;
    };
}

async function leaveProtectedSession() {
    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        await protectedSessionHolder.resetProtectedSession();
    }
}

/** returned promise resolves with true if new protected session was established, false if no action was necessary */
function enterProtectedSession() {
    const dfd = $.Deferred();

    if (!options.is("isPasswordSet")) {
        appContext.triggerCommand("showPasswordNotSet");
        return dfd;
    }

    if (protectedSessionHolder.isProtectedSessionAvailable()) {
        dfd.resolve(false);
    } else {
        // using deferred instead of promise because it allows resolving from the outside
        protectedSessionDeferred = dfd;

        appContext.triggerCommand("showProtectedSessionPasswordDialog");
    }

    return dfd.promise();
}

async function reloadData() {
    const allNoteIds = Object.keys(froca.notes);

    await froca.loadInitialTree();

    // make sure that all notes used in the application are loaded, including the ones not shown in the tree
    await froca.reloadNotes(allNoteIds);
}

async function setupProtectedSession(password: string) {
    const response = await server.post<Response>("login/protected", { password: password });

    if (!response.success) {
        toastService.showError(t("protected_session.wrong_password"), 3000);
        return;
    }
}

ws.subscribeToMessages(async (message) => {
    if (message.type === "protectedSessionLogin") {
        // Enable
        protectedSessionHolder.enableProtectedSession();

        // Reload
        await reloadData();
        await appContext.triggerEvent("frocaReloaded", {});
        appContext.triggerEvent("protectedSessionStarted", {});
        appContext.triggerCommand("closeProtectedSessionPasswordDialog");
        if (protectedSessionDeferred !== null) {
            protectedSessionDeferred.resolve(true);
            protectedSessionDeferred = null;
        }
        toastService.showMessage(t("protected_session.started"));
    } else if (message.type === "protectedSessionLogout") {
        if (ws.isConnected()) // Make sure to only run when the session has actually fully loaded, our resync will deal with it
            utils.reloadFrontendApp(`Protected session logout`);
    }
});

async function protectNote(noteId: string, protect: boolean, includingSubtree: boolean) {
    await enterProtectedSession();

    await server.put(`notes/${noteId}/protect/${protect ? 1 : 0}?subtree=${includingSubtree ? 1 : 0}`);
}

function makeToast(message: Message, title: string, text: string): ToastOptions {
    return {
        id: message.taskId,
        title,
        message: text,
        icon: message.data.protect ? "check-shield" : "shield"
    };
}

ws.subscribeToMessages(async (message) => {
    if (message.taskType !== "protectNotes") {
        return;
    }

    const isProtecting = message.data.protect;
    const title = isProtecting ? t("protected_session.protecting-title") : t("protected_session.unprotecting-title");

    if (message.type === "taskError") {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === "taskProgressCount") {
        const count = message.progressCount;
        const text = isProtecting ? t("protected_session.protecting-in-progress", { count }) : t("protected_session.unprotecting-in-progress-count", { count });
        toastService.showPersistent(makeToast(message, title, text));
    } else if (message.type === "taskSucceeded") {
        const text = isProtecting ? t("protected_session.protecting-finished-successfully") : t("protected_session.unprotecting-finished-successfully");
        const toast = makeToast(message, title, text);
        toast.closeAfter = 3000;

        toastService.showPersistent(toast);
    }
});

let protectedSessionActiveLocal = false;
let protectedSessionActiveRemote = false;
ws.subscribeToPreReconnectHandshake({
    reset: async () => {
        // Reset fields
        protectedSessionActiveLocal = false;
        protectedSessionActiveRemote = false;

        // Done
        return true;
    },
    pre: async () => {
        // Handling protected sessions on reconnect
        // The pre status is used to check the current protected session and touch if needed

        // Handle protected session first
        // Check status of current protected sessions
        protectedSessionActiveLocal = protectedSessionHolder.isProtectedSessionAvailable();
        const serverProtectedSessionStatus = await server.get("protected/status").catch(e => {
            console.error(utils.now(), `Failed to check serversided protected session status! Connection to server unavailable! Exception: `, e);
            return null;
        }).then((res: any) => res.session_active);
        if (serverProtectedSessionStatus == null) {
            // Connection issue
            return false;
        }
        protectedSessionActiveRemote = serverProtectedSessionStatus;

        // Touch protected session if needed
        if (protectedSessionActiveRemote)
            protectedSessionHolder.touchProtectedSession();

        // Check status change
        if (protectedSessionActiveLocal != protectedSessionActiveRemote) {
            // Session status changed
            if (!protectedSessionActiveRemote) {
                // Remote session closed
                // Close locally partially so the note syncer wont try syncing the notes
                // If remote and local both have the session active, syncing will be able to perform normally so this will be skipped
                glob.isProtectedSessionAvailable = false;
            }
        }

        // Success
        return true;
    },
    post: async () => {
        // Run after all main preconnect handshakers
        // Handling protected session expiry, which should reload the application

        // Verify protected note change
        let protectedNotesChanged = false;
        for (const noteID in froca.notes) {
            // Get note
            const note = froca.notes[noteID];
            if (note == null)
                continue;

            // Check if last edits metadata is available
            // This data is used to compare with the remote server, to properly sync edits before reload, so user data isnt lost
            if (note.lastEditsDataAvailable) {
                // Skip non-protected, only need to check if protected changed
                if (!note.isProtected)
                    continue;

                // Load local note edit metadata
                const lastLocalData = note.lastLocalData; // Current note contents (updated on user edit and whenever it syncs)
                const lastRemoteData = note.lastRemoteData; // Last successfully-exchanged note data, this is the data that was on the server prior to disconnect

                // Compare note against remote
                const localChangedSinceDisconnect = lastLocalData !== lastRemoteData; // Checks if the local note has been altered by the user since the disconnect
                if (localChangedSinceDisconnect) {
                    // Local end has changed
                    protectedNotesChanged = true;
                }
            }
        }

        // Restore status
        if (protectedSessionActiveLocal)
            glob.isProtectedSessionAvailable = true;

        // Check status of protected session
        // Here we either open or close the protected session, depending on what the remote end has done
        if (!protectedSessionActiveLocal && protectedSessionActiveRemote) {
            // Remote end started the protected session
            // Open it locally as well

            // Enable
            protectedSessionHolder.enableProtectedSession();

            // Reload
            await reloadData();
            await appContext.triggerEvent("frocaReloaded", {});
            appContext.triggerEvent("protectedSessionStarted", {});
            appContext.triggerCommand("closeProtectedSessionPasswordDialog");
            if (protectedSessionDeferred !== null) {
                protectedSessionDeferred.resolve(true);
                protectedSessionDeferred = null;
            }
            toastService.showMessage(t("protected_session.started"));
        } else if (protectedSessionActiveLocal && !protectedSessionActiveRemote) {
            // Remote end closed the session
            if (protectedNotesChanged) {
                // Protected notes changed
                // Unable to safely reload

                // Close persistent
                if (ws.connectionLostToastShown())
                    toastService.closePersistent("clientConnectionLost");

                // Show error
                toastService.showPersistent({
                    id: "clientConnectionUnavailable",
                    title: t("ws.connection-toast-title"),
                    icon: "alert",
                    message: t("ws.connection-toast-reloadfailed-protectedsession"),
                    preventUserClose: true,
                    color: "red"
                });

                // Terminate
                ws.terminateConnection();
                return false;
            }

            // Safe to reload
            utils.reloadFrontendApp(`Protected session logout`);
        }

        // Successss
        return true;
    }
});

export default {
    protectNote,
    enterProtectedSession,
    leaveProtectedSession,
    setupProtectedSession
};
