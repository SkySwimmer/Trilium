import ws from "./ws.js";
import utils from "./utils.js";

export interface ToastOptions {
    id?: string;
    icon: string;
    title: string;
    message: string;
    delay?: number;
    autohide?: boolean;
    closeAfter?: number;
    color?: string;
    preventUserClose?: boolean;
}

function toast(options: ToastOptions) {
    const $toast = $(
        `<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">
                    <span class="bx bx-${options.icon}"></span>
                    <span class="toast-title"></span>
                </strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body"></div>
        </div>`
    );

    $toast.find(".toast-title").text(options.title);
    $toast.find(".toast-body").html(options.message);

    if (options.id) {
        $toast.attr("id", `toast-${options.id}`);
    }

    $("#toast-container").append($toast);

    if (options.preventUserClose) {
        $toast.find(".btn-close").remove()
    }
    if (options.color) {
        $toast.css("background-color", options.color);
    }

    $toast.toast({
        delay: options.delay || 3000,
        autohide: !!options.autohide
    });

    $toast.on("hidden.bs.toast", (e) => e.target.remove());

    $toast.toast("show");

    return $toast;
}

function showPersistent(options: ToastOptions) {
    let $toast = $(`#toast-${options.id}`);

    if ($toast.length > 0) {
        $toast.find(".toast-body").html(options.message);
    } else {
        options.autohide = false;

        $toast = toast(options);
    }

    if (options.closeAfter) {
        setTimeout(() => $toast.remove(), options.closeAfter);
    }

    return $toast;
}

function closePersistent(id: string) {
    $(`#toast-${id}`).remove();
}

function showMessage(message: string, delay = 2000) {
    console.debug(utils.now(), "message:", message);

    return toast({
        title: "Info",
        icon: "check",
        message: message,
        autohide: true,
        delay
    });
}

export function showError(message: string, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    return toast({
        title: "Error",
        icon: "alert",
        message: message,
        autohide: true,
        delay
    });
}

function showErrorTitleAndMessage(title: string, message: string, delay = 10000) {
    console.log(utils.now(), "error: ", message);

    return toast({
        title: title,
        icon: "alert",
        message: message,
        autohide: true,
        delay
    });
}

export default {
    toast,
    showMessage,
    showError,
    showErrorTitleAndMessage,
    showPersistent,
    closePersistent
};
