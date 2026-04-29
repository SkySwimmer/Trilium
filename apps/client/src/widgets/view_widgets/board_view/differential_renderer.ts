import { BoardDragHandler } from "./drag_handler";
import BoardApi from "./api";
import appContext from "../../../components/app_context";
import FNote from "../../../entities/fnote";
import ViewModeStorage from "../view_mode_storage";
import { BoardData } from "./config";
import { t } from "../../../services/i18n.js";
import froca from "../../../services/froca";

export interface BoardState {
    columns: { [key: string]: { note: any; branch: any }[] };
    columnOrder: string[];
}

export class DifferentialBoardRenderer {
    private $container: JQuery<HTMLElement>;
    private api: BoardApi;
    private dragHandler: BoardDragHandler;
    private lastState: BoardState | null = null;
    private onCreateNewItem: (column: string) => void;
    private updateTimeout: number | null = null;
    private pendingUpdate = false;
    private parentNote: FNote;
    private viewStorage: ViewModeStorage<BoardData>;
    private onRefreshApi: () => Promise<void>;

    constructor(
        $container: JQuery<HTMLElement>,
        api: BoardApi,
        dragHandler: BoardDragHandler,
        onCreateNewItem: (column: string) => void,
        parentNote: FNote,
        viewStorage: ViewModeStorage<BoardData>,
        onRefreshApi: () => Promise<void>
    ) {
        this.$container = $container;
        this.api = api;
        this.dragHandler = dragHandler;
        this.onCreateNewItem = onCreateNewItem;
        this.parentNote = parentNote;
        this.viewStorage = viewStorage;
        this.onRefreshApi = onRefreshApi;
    }

    async renderBoard(refreshApi = false): Promise<void> {
        // Refresh API data if requested
        if (refreshApi) {
            await this.onRefreshApi();
        }

        // Debounce rapid updates
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = window.setTimeout(async () => {
            await this.performUpdate();
            this.updateTimeout = null;
        }, 16); // ~60fps
    }

    private async performUpdate(): Promise<void> {
        // Clean up any stray drag indicators before updating
        this.dragHandler.cleanup();

        const currentState = this.getCurrentState();

        if (!this.lastState) {
            // First render - do full render
            await this.fullRender(currentState);
        } else {
            // Differential render - only update what changed
            await this.differentialRender(this.lastState, currentState);
        }

        this.lastState = currentState;
    }

    private getCurrentState(): BoardState {
        const columns: { [key: string]: { note: any; branch: any }[] } = {};
        const columnOrder: string[] = [];

        for (const column of this.api.columns) {
            columnOrder.push(column);
            columns[column] = this.api.getColumn(column) || [];
        }

        return { columns, columnOrder };
    }

    private async fullRender(state: BoardState): Promise<void> {
        this.$container.empty();

        for (const column of state.columnOrder) {
            const columnItems = state.columns[column];
            const $columnEl = this.createColumn(column, columnItems);
            this.$container.append($columnEl);
        }

        this.addAddColumnButton();
    }

    private async differentialRender(oldState: BoardState, newState: BoardState): Promise<void> {
        // Store scroll positions before making changes
        const scrollPositions = this.saveScrollPositions();

        // Handle column additions/removals
        this.updateColumns(oldState, newState);

        // Handle card updates within existing columns
        for (const column of newState.columnOrder) {
            this.updateColumnCards(column, oldState.columns[column] || [], newState.columns[column]);
        }

        // Restore scroll positions
        this.restoreScrollPositions(scrollPositions);
    }

    private saveScrollPositions(): { [column: string]: number } {
        const positions: { [column: string]: number } = {};
        this.$container.find('.board-column').each((_, el) => {
            const column = $(el).attr('data-column');
            if (column) {
                positions[column] = el.scrollTop;
            }
        });
        return positions;
    }

    private restoreScrollPositions(positions: { [column: string]: number }): void {
        this.$container.find('.board-column').each((_, el) => {
            const column = $(el).attr('data-column');
            if (column && positions[column] !== undefined) {
                el.scrollTop = positions[column];
            }
        });
    }

    private updateColumns(oldState: BoardState, newState: BoardState): void {
        // Check if column order has changed
        const orderChanged = !this.arraysEqual(oldState.columnOrder, newState.columnOrder);

        if (orderChanged) {
            // If order changed, we need to reorder the columns in the DOM
            this.reorderColumns(newState.columnOrder);
        }

        // Remove columns that no longer exist
        for (const oldColumn of oldState.columnOrder) {
            if (!newState.columnOrder.includes(oldColumn)) {
                this.$container.find(`[data-column="${oldColumn}"]`).remove();
            }
        }

        // Add new columns
        for (const newColumn of newState.columnOrder) {
            if (!oldState.columnOrder.includes(newColumn)) {
                const columnItems = newState.columns[newColumn];
                const $columnEl = this.createColumn(newColumn, columnItems);

                // Insert at correct position
                const insertIndex = newState.columnOrder.indexOf(newColumn);
                const $existingColumns = this.$container.find('.board-column');

                if (insertIndex === 0) {
                    this.$container.prepend($columnEl);
                } else if (insertIndex >= $existingColumns.length) {
                    this.$container.find('.board-add-column').before($columnEl);
                } else {
                    $($existingColumns[insertIndex - 1]).after($columnEl);
                }
            }
        }
    }

    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }

    private reorderColumns(newOrder: string[]): void {
        // Get all existing column elements
        const $columns = this.$container.find('.board-column');
        const $addColumnButton = this.$container.find('.board-add-column');

        // Create a map of column elements by their data-column attribute
        const columnElements = new Map<string, JQuery<HTMLElement>>();
        $columns.each((_, el) => {
            const $el = $(el);
            const columnValue = $el.attr('data-column');
            if (columnValue) {
                columnElements.set(columnValue, $el);
            }
        });

        // Remove all columns from DOM (but keep references)
        $columns.detach();

        // Re-insert columns in the new order
        let $insertAfter: JQuery<HTMLElement> | null = null;
        for (const columnValue of newOrder) {
            const $columnEl = columnElements.get(columnValue);
            if ($columnEl) {
                if ($insertAfter) {
                    $insertAfter.after($columnEl);
                } else {
                    // Insert at the beginning
                    this.$container.prepend($columnEl);
                }
                $insertAfter = $columnEl;
            }
        }

        // Ensure add column button is at the end
        if ($addColumnButton.length) {
            this.$container.append($addColumnButton);
        }
    }

    private updateColumnCards(column: string, oldCards: { note: any; branch: any }[], newCards: { note: any; branch: any }[]): void {
        const $column = this.$container.find(`[data-column="${column}"]`);
        if (!$column.length) return;

        const $cardContainer = $column;
        const oldCardIds = oldCards.map(item => item.note.noteId);
        const newCardIds = newCards.map(item => item.note.noteId);

        // Remove cards that no longer exist
        $cardContainer.find('.board-note').each((_, el) => {
            const noteId = $(el).attr('data-note-id');
            if (noteId && !newCardIds.includes(noteId)) {
                $(el).addClass('fade-out');
                setTimeout(() => $(el).remove(), 150);
            }
        });

        // Add or update cards
        for (let i = 0; i < newCards.length; i++) {
            const item = newCards[i];
            const noteId = item.note.noteId;
            const $existingCard = $cardContainer.find(`[data-note-id="${noteId}"]`);
            const isNewCard = !oldCardIds.includes(noteId);

            if ($existingCard.length) {
                // Check for changes in title, icon, or color
                const currentTitle = $existingCard.text().trim();
                const currentIconClass = $existingCard.attr('data-icon-class');
                const currentColorClass = $existingCard.attr('data-color-class') || '';

                const newIconClass = item.note.getIcon();
                const newColorClass = item.note.getColorClass() || '';

                let hasChanges = false;

                // Update title if changed
                if (currentTitle !== item.note.title) {
                    $existingCard.contents().filter(function() {
                        return this.nodeType === 3; // Text nodes
                    }).remove();
                    $existingCard.append(document.createTextNode(item.note.title));
                    hasChanges = true;
                }

                // Update icon if changed
                if (currentIconClass !== newIconClass) {
                    const $icon = $existingCard.find('.icon');
                    $icon.removeClass().addClass('icon').addClass(newIconClass);
                    $existingCard.attr('data-icon-class', newIconClass);
                    hasChanges = true;
                }

                // Update color if changed
                if (currentColorClass !== newColorClass) {
                    // Remove old color class if it exists
                    if (currentColorClass) {
                        $existingCard.removeClass(currentColorClass);
                    }
                    // Add new color class if it exists
                    if (newColorClass) {
                        $existingCard.addClass(newColorClass);
                    }
                    $existingCard.attr('data-color-class', newColorClass);
                    hasChanges = true;
                }

                // Add subtle animation if there were changes
                if (hasChanges) {
                    $existingCard.addClass('card-updated');
                    setTimeout(() => $existingCard.removeClass('card-updated'), 300);
                }

                // Ensure card is in correct position
                this.ensureCardPosition($existingCard, i, $cardContainer);
            } else {
                // Create new card
                const $newCard = this.createCard(item.note, item.branch, column);
                $newCard.addClass('fade-in').css('opacity', '0');

                // Insert at correct position
                if (i === 0) {
                    $cardContainer.find('h3').after($newCard);
                } else {
                    const $prevCard = $cardContainer.find('.board-note').eq(i - 1);
                    if ($prevCard.length) {
                        $prevCard.after($newCard);
                    } else {
                        $cardContainer.find('.board-new-item').before($newCard);
                    }
                }

                // Trigger fade in animation
                setTimeout(() => $newCard.css('opacity', '1'), 10);
            }
        }
    }

    private ensureCardPosition($card: JQuery<HTMLElement>, targetIndex: number, $container: JQuery<HTMLElement>): void {
        const $allCards = $container.find('.board-note');
        const currentIndex = $allCards.index($card);

        if (currentIndex !== targetIndex) {
            if (targetIndex === 0) {
                $container.find('h3').after($card);
            } else {
                const $targetPrev = $allCards.eq(targetIndex - 1);
                if ($targetPrev.length) {
                    $targetPrev.after($card);
                }
            }
        }
    }

    private createColumn(column: string, columnItems: { note: any; branch: any }[]): JQuery<HTMLElement> {
        const $columnEl = $("<div>")
            .addClass("board-column")
            .attr("data-column", column);

        // Create header
        const $titleEl = $("<h3>").attr("data-column-value", column);

        // Create title text
        const $titleText = $("<span>").text(column);

        // Create edit icon
        const $editIcon = $("<span>")
            .addClass("edit-icon icon bx bx-edit-alt")
            .attr("title", "Click to edit column title");

        $titleEl.append($titleText, $editIcon);
        $columnEl.append($titleEl);

        // Setup column dragging
        this.dragHandler.setupColumnDrag($columnEl, column);

        // Handle wheel events for scrolling
        $columnEl.on("wheel", (event) => {
            const el = $columnEl[0];
            const needsScroll = el.scrollHeight > el.clientHeight;
            if (needsScroll) {
                event.stopPropagation();
            }
        });

        // Setup drop zones for both notes and columns
        this.dragHandler.setupNoteDropZone($columnEl, column);
        this.dragHandler.setupColumnDropZone($columnEl);

        // Add cards
        for (const item of columnItems) {
            if (item.note) {
                const $noteEl = this.createCard(item.note, item.branch, column);
                $columnEl.append($noteEl);
            }
        }

        // Add "New item" button
        const $newItemEl = $("<div>")
            .addClass("board-new-item")
            .attr("data-column", column)
            .html(`<span class="icon bx bx-plus"></span> ${t("board_view.new-item")}`);

        $newItemEl.on("click", () => this.onCreateNewItem(column));
        $columnEl.append($newItemEl);

        return $columnEl;
    }

    private createCard(note: any, branch: any, column: string): JQuery<HTMLElement> {
        const $iconEl = $("<span>")
            .addClass("icon")
            .addClass(note.getIcon());

        const colorClass = note.getColorClass() || '';

        const $noteEl = $("<div>")
            .addClass("board-note")
            .attr("data-note-id", note.noteId)
            .attr("data-branch-id", branch.branchId)
            .attr("data-current-column", column)
            .attr("data-icon-class", note.getIcon())
            .attr("data-color-class", colorClass)
            .text(note.title);

        // Add color class to the card if it exists
        if (colorClass) {
            $noteEl.addClass(colorClass);
        }

        $noteEl.prepend($iconEl);
        $noteEl.on("click", () => { 
            // Check type
            if (note.type == "book" && note.getLabelValue("viewType") === "board") {
                // Open right here
                const ctx = appContext.tabManager.getActiveContext();
                if (ctx) {
                    // Open in current tab
                    ctx.setNote((ctx.noteId ? ctx.noteId + "/" : "") + note.noteId);
                } else {
                    // Open in popup
                    appContext.triggerCommand("openInPopup", { noteIdOrPath: note.noteId });
                }
            } else {
                // Open in popup
                appContext.triggerCommand("openInPopup", { noteIdOrPath: note.noteId });
            }
        });

        // Setup drag functionality
        this.dragHandler.setupNoteDrag($noteEl, note, branch);

        return $noteEl;
    }

    private addAddColumnButton(): void {
        if (this.$container.find('.board-add-column').length === 0) {
            const $addColumnEl = $("<div>")
                .addClass("board-add-column")
                .html(`<span class="icon bx bx-plus"></span> ${t("board_view.add-column")}`);

            this.$container.append($addColumnEl);
        }
    }

    forceFullRender(): void {
        this.lastState = null;
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
    }

    async flushPendingUpdates(): Promise<void> {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
            await this.performUpdate();
        }
    }

    startInlineEditing(noteId: string): void {
        // Use setTimeout to ensure the card is rendered before trying to edit it
        setTimeout(() => {
            const $card = this.$container.find(`[data-note-id="${noteId}"]`);
            if ($card.length) {
                this.makeCardEditable($card, noteId);
            }
        }, 100);
    }

    private makeCardEditable($card: JQuery<HTMLElement>, noteId: string): void {
        if ($card.hasClass('editing')) {
            return; // Already editing
        }

        // Get the current title (get text without icon)
        const $icon = $card.find('.icon');
        const currentTitle = $card.text().trim();

        // Add editing class and store original click handler
        $card.addClass('editing');
        $card.off('click'); // Remove any existing click handlers temporarily

        // Create input element
        const $input = $('<input>')
            .attr('type', 'text')
            .val(currentTitle)
            .css({
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
                flex: '1',
                minWidth: '0',
                padding: '0',
                marginLeft: '0.25em'
            });

        // Create a flex container to keep icon and input inline
        const $editContainer = $('<div>')
            .css({
                display: 'flex',
                alignItems: 'center',
                width: '100%'
            });

        // Replace content with icon + input in flex container
        $editContainer.append($icon.clone(), $input);
        $card.empty().append($editContainer);
        $input.focus().select();

        const finishEdit = async (save = true) => {
            if (!$card.hasClass('editing')) {
                return; // Already finished
            }

            $card.removeClass('editing');

            let finalTitle = currentTitle;
            if (save) {
                const newTitle = $input.val() as string;
                if (newTitle.trim() && newTitle !== currentTitle) {
                    try {
                        // Update the note title using the board view's server call
                        import('../../../services/server').then(async ({ default: server }) => {
                            await server.put(`notes/${noteId}/title`, { title: newTitle.trim() });
                            finalTitle = newTitle.trim();
                        });
                    } catch (error) {
                        console.error("Failed to update note title:", error);
                    }
                }
            }

            // Restore the card content
            const iconClass = $card.attr('data-icon-class') || 'bx bx-file';
            const $newIcon = $('<span>').addClass('icon').addClass(iconClass);
            $card.text(finalTitle);
            $card.prepend($newIcon);

            // Re-attach click handler for quick edit (for existing cards)
            $card.on('click', () => {
                // Check type
                froca.getNote(noteId, true).then(note => {
                    // Check type
                    if (note && note.type == "book" && note.getLabelValue("viewType") === "board") {
                        // Open right here
                        const ctx = appContext.tabManager.getActiveContext();
                        if (ctx) {
                            // Open in current tab
                            ctx.setNote((ctx.noteId ? ctx.noteId + "/" : "") + noteId);
                        } else {
                            // Open in popup
                            appContext.triggerCommand("openInPopup", { noteIdOrPath: noteId });
                        }
                    } else {
                        // Open in popup
                        appContext.triggerCommand("openInPopup", { noteIdOrPath: noteId });
                    }
                }).catch(() => { 
                    // Open anyways
                    appContext.triggerCommand("openInPopup", { noteIdOrPath: noteId });
                });
            });
        };

        $input.on('blur', () => finishEdit(true));
        $input.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEdit(false);
            }
        });
    }
}
