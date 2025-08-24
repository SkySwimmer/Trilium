import { beforeAll, vi } from "vitest";
import $ from "jquery";

type MessageHandler = (message: any) => void;
type ConnectionHandler = (socket: WebSocket) => void;
type PreconnectHandshakeHandler = { reset?: (socket: WebSocket) => Promise<boolean>, pre?: (socket: WebSocket) => Promise<boolean>, main?: (socket: WebSocket) => Promise<boolean>, post?: (socket: WebSocket) => Promise<boolean> };

injectGlobals();

beforeAll(() => {
    vi.mock("../services/ws.js", mockWebsocket);
    vi.mock("../services/server.js", mockServer);
});

function injectGlobals() {
    const uncheckedWindow = window as any;
    uncheckedWindow.$ = $;
    uncheckedWindow.WebSocket = () => {};
    uncheckedWindow.glob = {
        isMainWindow: true
    };
}

function mockWebsocket() {
    return {
        default: {
            subscribeToMessages(messageHandler: MessageHandler) {
                // Do nothing.
            },
            subscribeToDisconnect(handler: ConnectionHandler) {
                // Do nothing.
            },
            subscribeToReconnect(handler: ConnectionHandler) {
                // Do nothing.
            },
            subscribeToConnect(handler: ConnectionHandler) {
                // Do nothing.
            },
            subscribeToPreConnectHandshake(handler: PreconnectHandshakeHandler) {
                // Do nothing.
            },
            subscribeToPreReconnectHandshake(handler: PreconnectHandshakeHandler) {
                // Do nothing.
            },
            uiVerifyConnection() {
                // Do nothing
                return true;
            }
        }
    }
}

function mockServer() {
    return {
        default: {
            async get(url: string) {
                if (url === "options") {
                    return {};
                }

                if (url === "keyboard-actions") {
                    return [];
                }

                if (url === "tree") {
                    return {
                        branches: [],
                        notes: [],
                        attributes: []
                    }
                }
            },

            async post(url: string, data: object) {
                if (url === "tree/load") {
                    throw new Error(`A module tried to load from the server the following notes: ${((data as any).noteIds || []).join(",")}\nThis is not supported, use Froca mocking instead and ensure the note exist in the mock.`)
                }
            }
        }
    };
}
