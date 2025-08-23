import { t } from "../services/i18n.js";
import contextMenu, { type ContextMenuEvent, type MenuItem } from "./context_menu.js";
import appContext, { type CommandNames } from "../components/app_context.js";
import type { ViewScope } from "../services/link.js";
import ws from "../services/ws.js";

function openContextMenu(notePath: string, e: ContextMenuEvent, viewScope: ViewScope = {}, hoistedNoteId: string | null = null) {
    if (!ws.uiVerifyConnection())
        return;
    contextMenu.show({
        x: e.pageX,
        y: e.pageY,
        items: getItems(),
        selectMenuItemHandler: ({ command }) => handleLinkContextMenuItem(command, notePath, viewScope, hoistedNoteId)
    });
}

function getItems(): MenuItem<CommandNames>[] {
    return [
        { title: t("link_context_menu.open_note_in_new_tab"), command: "openNoteInNewTab", uiIcon: "bx bx-link-external" },
        { title: t("link_context_menu.open_note_in_new_split"), command: "openNoteInNewSplit", uiIcon: "bx bx-dock-right" },
        { title: t("link_context_menu.open_note_in_new_window"), command: "openNoteInNewWindow", uiIcon: "bx bx-window-open" },
        { title: t("link_context_menu.open_note_in_popup"), command: "openNoteInPopup", uiIcon: "bx bx-edit" }
    ];
}

function handleLinkContextMenuItem(command: string | undefined, notePath: string, viewScope = {}, hoistedNoteId: string | null = null) {
    if (!hoistedNoteId) {
        hoistedNoteId = appContext.tabManager.getActiveContext()?.hoistedNoteId ?? null;
    }

    // Check connection
    if (!ws.uiVerifyConnection())
        return;

    if (command === "openNoteInNewTab") {
        appContext.tabManager.openContextWithNote(notePath, { hoistedNoteId, viewScope });
    } else if (command === "openNoteInNewSplit") {
        const subContexts = appContext.tabManager.getActiveContext()?.getSubContexts();

        if (!subContexts) {
            logError("subContexts is null");
            return;
        }

        const { ntxId } = subContexts[subContexts.length - 1];
        appContext.triggerCommand("openNewNoteSplit", { ntxId, notePath, hoistedNoteId, viewScope });
    } else if (command === "openNoteInNewWindow") {
        appContext.triggerCommand("openInWindow", { notePath, hoistedNoteId, viewScope });
    } else if (command === "openNoteInPopup") {
        appContext.triggerCommand("openInPopup", { noteIdOrPath: notePath })
    }
}

export default {
    getItems,
    handleLinkContextMenuItem,
    openContextMenu
};
