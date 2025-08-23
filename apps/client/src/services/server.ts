import utils, { isShare } from "./utils.js";
import ValidationError from "./validation_error.js";

type Headers = Record<string, string | null | undefined>;

type Method = string;

interface Response {
    headers: Headers;
    body: unknown;
}

interface Arg extends Response {
    statusCode: number;
    method: Method;
    url: string;
    requestId: string;
}

interface RequestData {
    resolve: (value: unknown) => any;
    reject: (reason: unknown) => any;
    silentNotFound: boolean;
    requestUrl: string;
    requestMethod: string;
    requestHeaders: Headers;
    requestData: any;
}

export interface StandardResponse {
    success: boolean;
}

async function getHeaders(headers?: Headers) {
    if (isShare) {
        return {};
    }

    const appContext = (await import("../components/app_context.js")).default;
    const activeNoteContext = appContext.tabManager ? appContext.tabManager.getActiveContext() : null;

    // headers need to be lowercase because node.js automatically converts them to lower case
    // also avoiding using underscores instead of dashes since nginx filters them out by default
    const allHeaders: Headers = {
        "trilium-component-id": glob.componentId,
        "trilium-local-now-datetime": utils.localNowDateTime(),
        "trilium-hoisted-note-id": activeNoteContext ? activeNoteContext.hoistedNoteId : null,
        "x-csrf-token": glob.csrfToken
    };

    for (const headerName in headers) {
        if (headers[headerName]) {
            allHeaders[headerName] = headers[headerName];
        }
    }

    if (utils.isElectron()) {
        // passing it explicitly here because of the electron HTTP bypass
        allHeaders.cookie = document.cookie;
    }

    return allHeaders;
}

async function getWithSilentNotFound<T>(url: string, componentId?: string) {
    return await call<T>("GET", url, componentId, { silentNotFound: true });
}

let serverTimeOffset = Date.now();
let hasSyncedTime = false;

const dateCallOrig = Date.now;
Date.now = () => {
    // Get current
    let current = dateCallOrig();

    // Sync with server
    current = current + serverTimeOffset;

    // Return
    return current;
};

// Time sync
async function resyncTime() {
    // Get current server time
    let serverTime = 0;
    let serverTimeReceived = false;
    await get("servertime").then((data: any) => {
        serverTime = data.time;
        serverTimeReceived = true;
        return serverTime;
    }).catch((e) => {
        console.error(utils.now(), `Failed to sync to server time! Exception: `, e);
        return null;
    });
    if (!serverTimeReceived) {
        // Request failed
        return false;
    }

    // Get current client time
    const clientTime = dateCallOrig();

    // Resync
    serverTimeOffset = serverTime - clientTime;

    // Return
    return true;
}

async function resyncTimeInitial() {
    serverTimeOffset = dateCallOrig();
    if (!await resyncTime()) {
        // Schedule retry
        setTimeout(async () => {
            // Retry
            console.log(utils.now(), "Attempting server time resync...");
            resyncTime();
        }, 5000);
    }
    return;
}

/**
 * @param raw if `true`, the value will be returned as a string instead of a JavaScript object if JSON, XMLDocument if XML, etc.
 */
async function get<T>(url: string, componentId?: string, raw?: boolean) {
    return await call<T>("GET", url, componentId, { raw });
}

async function post<T>(url: string, data?: unknown, componentId?: string) {
    return await call<T>("POST", url, componentId, { data });
}

async function put<T>(url: string, data?: unknown, componentId?: string) {
    return await call<T>("PUT", url, componentId, { data });
}

async function patch<T>(url: string, data: unknown, componentId?: string) {
    return await call<T>("PATCH", url, componentId, { data });
}

async function remove<T>(url: string, componentId?: string) {
    return await call<T>("DELETE", url, componentId);
}

async function upload(url: string, fileToUpload: File) {
    const formData = new FormData();
    formData.append("upload", fileToUpload);

    return await $.ajax({
        url: window.glob.baseApiUrl + url,
        headers: await getHeaders(),
        data: formData,
        type: "PUT",
        timeout: 60 * 60 * 1000,
        contentType: false, // NEEDED, DON'T REMOVE THIS
        processData: false // NEEDED, DON'T REMOVE THIS
    });
}

let idCounter = 1;

const idToRequestMap: Record<string, RequestData> = {};

let maxKnownEntityChangeId = 0;

let lastTraffic = 0;

interface CallOptions {
    data?: unknown;
    silentNotFound?: boolean;
    // If `true`, the value will be returned as a string instead of a JavaScript object if JSON, XMLDocument if XML, etc.
    raw?: boolean;
}

async function call<T>(method: string, url: string, componentId?: string, options: CallOptions = {}) {
    // Sync time if needed
    if (!hasSyncedTime)
    {
        // Mark and sync
        hasSyncedTime = true;
        await resyncTimeInitial();
    }

    // Update traffic timer
    lastTraffic = Date.now()

    let resp;
    const headers = await getHeaders({
        "trilium-component-id": componentId
    });
    const { data } = options;

    if (utils.isElectron()) {
        const ipc = utils.dynamicRequire("electron").ipcRenderer;
        const requestId = idCounter++;

        resp = (await new Promise((resolve, reject) => {
            idToRequestMap[requestId] = {
                resolve,
                reject,
                silentNotFound: !!options.silentNotFound,
                requestMethod: method,
                requestHeaders: headers,
                requestUrl: url,
                requestData: data
            };

            ipc.send("server-request", {
                requestId: requestId,
                headers: headers,
                method: method,
                url: `/${window.glob.baseApiUrl}${url}`,
                data: data
            });
        })) as any;
    } else {
        resp = await ajax(url, method, data, headers, !!options.silentNotFound, options.raw, componentId);
    }

    const maxEntityChangeIdStr = resp.headers["trilium-max-entity-change-id"];

    if (maxEntityChangeIdStr && maxEntityChangeIdStr.trim()) {
        maxKnownEntityChangeId = Math.max(maxKnownEntityChangeId, parseInt(maxEntityChangeIdStr));
    }

    return resp.body as T;
}

setInterval(async () => {
    // Check last traffic time
    if (Date.now() - lastTraffic > 5000) {
        // Poll
        const connected: boolean = await get("connectiontest").then((data: any) => {
            return data.connected;
        }).catch((e) => {
            return false;
        });
        if (!connected) {
            // Disconnect websocket if needed
            const ws = (await import("./ws.js")).default;
            if (ws.isConnected()) {
                // Close and trigger reauth check
                ws.getConnection().close();
            }
        } else {
            // Verify auth status
            const authResult: any = await get("auth/verify").catch(() => null);
            if (authResult && !authResult.auth_status) {
                // Try reauthentication
                const result: any = await get("auth/reauthenticate").catch(() => null);
                if (result && !result.success) {
                    const ws = (await import("./ws.js")).default;
                    if (ws.isConnected()) {
                        // Close and trigger reauth check
                        ws.getConnection().close();
                    }
                }
            }
        }
    }
}, 5000);

/**
 * @param raw if `true`, the value will be returned as a string instead of a JavaScript object if JSON, XMLDocument if XML, etc.
 */
function ajax(url: string, method: string, data: unknown, headers: Headers, silentNotFound: boolean, raw?: boolean, componentId?: string): Promise<Response> {
    return new Promise((res, rej) => {
        const options: JQueryAjaxSettings = {
            url: window.glob.baseApiUrl + url,
            type: method,
            headers: headers,
            timeout: 60000,
            success: (body, textStatus, jqXhr) => {
                const respHeaders: Headers = {};

                jqXhr
                    .getAllResponseHeaders()
                    .trim()
                    .split(/[\r\n]+/)
                    .forEach((line) => {
                        const parts = line.split(": ");
                        const header = parts.shift();
                        if (header) {
                            respHeaders[header] = parts.join(": ");
                        }
                    });

                res({
                    body,
                    headers: respHeaders
                });
            },
            error: async (jqXhr) => {
                if (jqXhr.status === 0) {
                    // don't report requests that are rejected by the browser, usually when the user is refreshing or going to a different page.
                    rej("rejected by browser");
                    return;
                } else if (silentNotFound && jqXhr.status === 404) {
                    // report nothing
                } else {
                    // Check auth
                    const authResult: any = await get("auth/verify").catch(() => null);
                    if (authResult && !authResult.auth_status) {
                        // Try reauthentication
                        const result: any = await get("auth/reauthenticate").catch(() => null);
                        if (result && !result.success) {
                            const ws = (await import("./ws.js")).default;
                            if (ws.isConnected()) {
                                // Close and trigger reauth check
                                ws.getConnection().close();
                            }
                            rej(jqXhr.responseText);
                            return;
                        }

                        // Rerun
                        res(await call(method, url, componentId, options));
                        return;
                    }

                    // Report error
                    await reportError(method, url, jqXhr.status, jqXhr.responseText);
                }

                rej(jqXhr.responseText);
            }
        };

        if (raw) {
            options.dataType = "text";
        }

        if (data) {
            try {
                options.data = JSON.stringify(data);
            } catch (e) {
                console.log("Can't stringify data: ", data, " because of error: ", e);
            }
            options.contentType = "application/json";
        }

        $.ajax(options);
    });
}

if (utils.isElectron()) {
    const ipc = utils.dynamicRequire("electron").ipcRenderer;

    ipc.on("server-response", async (event: string, arg: Arg) => {
        if (arg.statusCode >= 200 && arg.statusCode < 300) {
            handleSuccessfulResponse(arg);
        } else {
            if (arg.statusCode === 404 && idToRequestMap[arg.requestId]?.silentNotFound) {
                // report nothing
            } else {
                // Check auth
                const authResult: any = await get("auth/verify").catch(() => null);
                if (authResult && !authResult.auth_status) {
                    // Try reauthentication
                    const result: any = await get("auth/reauthenticate").catch(() => null);
                    if (result && !result.success) {
                        const ws = (await import("./ws.js")).default;
                        if (ws.isConnected()) {
                            // Close and trigger reauth check
                            ws.getConnection().close();
                        }
                        idToRequestMap[arg.requestId].reject(new Error(`Server responded with ${arg.statusCode}`));
                        delete idToRequestMap[arg.requestId];
                        return;
                    }

                    // Rerun
                    await ipc.send("server-request", {
                        requestId: arg.requestId,
                        headers: idToRequestMap[arg.requestId].requestHeaders,
                        method: idToRequestMap[arg.requestId].requestMethod,
                        url: `/${window.glob.baseApiUrl}${idToRequestMap[arg.requestId].requestUrl}`,
                        data: idToRequestMap[arg.requestId].requestData
                    });
                    return;
                }

                // Report error
                await reportError(arg.method, arg.url, arg.statusCode, arg.body);
            }

            idToRequestMap[arg.requestId].reject(new Error(`Server responded with ${arg.statusCode}`));
        }

        delete idToRequestMap[arg.requestId];
    });

    function handleSuccessfulResponse(arg: Arg) {
        if (arg.headers["Content-Type"] === "application/json" && typeof arg.body === "string") {
            arg.body = JSON.parse(arg.body);
        }

        if (!(arg.requestId in idToRequestMap)) {
            // this can happen when reload happens between firing up the request and receiving the response
            throw new Error(`Unknown requestId '${arg.requestId}'`);
        }

        idToRequestMap[arg.requestId].resolve({
            body: arg.body,
            headers: arg.headers
        });
    }
}

async function reportError(method: string, url: string, statusCode: number, response: unknown) {
    let message = response;

    if (typeof response === "string") {
        try {
            response = JSON.parse(response);
            message = (response as any).message;
        } catch (e) {}
    }

    const toastService = (await import("./toast.js")).default;

    const messageStr = typeof message === "string" ? message : JSON.stringify(message);

    if ([400, 404].includes(statusCode) && response && typeof response === "object") {
        toastService.showError(messageStr);
        throw new ValidationError({
            requestUrl: url,
            method,
            statusCode,
            ...response
        });
    } else {
        const title = `${statusCode} ${method} ${url}`;
        toastService.showErrorTitleAndMessage(title, messageStr);
        const { throwError } = await import("./ws.js");
        throwError(`${title} - ${message}`);
    }
}

export default {
    get,
    getWithSilentNotFound,
    post,
    put,
    patch,
    remove,
    upload,
    resyncTime,
    // don't remove, used from CKEditor image upload!
    getHeaders,
    getMaxKnownEntityChangeId: () => maxKnownEntityChangeId
};
