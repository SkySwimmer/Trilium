import ReactBasicWidget from "../react/ReactBasicWidget";
import Modal from "../react/Modal";
import Button from "../react/Button";
import NoteAutocomplete from "../react/NoteAutocomplete";
import { t } from "../../services/i18n";
import { useRef, useState } from "preact/hooks";
import note_autocomplete, { Suggestion } from "../../services/note_autocomplete";
import appContext from "../../components/app_context";
import commandRegistry from "../../services/command_registry";
import { refToJQuerySelector } from "../react/react_utils";
import useTriliumEvent from "../react/hooks";

const KEEP_LAST_SEARCH_FOR_X_SECONDS = 120;

type Mode = "last-search" | "recent-notes" | "commands";

function JumpToNoteDialogComponent() {
    const [ mode, setMode ] = useState<Mode>();
    const [ lastOpenedTs, setLastOpenedTs ] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<HTMLInputElement>(null);
    const [ isCommandMode, setIsCommandMode ] = useState(mode === "commands");
    const [ initialText, setInitialText ] = useState(isCommandMode ? "> " : "");
    const actualText = useRef<string>(initialText);
    const [ shown, setShown ] = useState(false);
    
    async function openDialog(commandMode: boolean) {        
        let newMode: Mode;
        let initialText: string = "";

        if (commandMode) {
            newMode = "commands";
            initialText = ">";            
        } else if (Date.now() - lastOpenedTs <= KEEP_LAST_SEARCH_FOR_X_SECONDS * 1000 && actualText) {
            // if you open the Jump To dialog soon after using it previously, it can often mean that you
            // actually want to search for the same thing (e.g., you opened the wrong note at first try)
            // so we'll keep the content.
            // if it's outside of this time limit, then we assume it's a completely new search and show recent notes instead.
            newMode = "last-search";
            initialText = actualText.current;
        } else {
            newMode = "recent-notes";
        }

        if (mode !== newMode) {
            setMode(newMode);
        }

        setInitialText(initialText);
        setShown(true);
        setLastOpenedTs(Date.now());
    }

    useTriliumEvent("jumpToNote", () => openDialog(false));
    useTriliumEvent("commandPalette", () => openDialog(true));

    async function onItemSelected(suggestion?: Suggestion | null) {
        if (!suggestion) {
            return;
        }
        
        setShown(false);
        if (suggestion.notePath) {
            appContext.tabManager.getActiveContext()?.setNote(suggestion.notePath);
        } else if (suggestion.commandId) {
            await commandRegistry.executeCommand(suggestion.commandId);
        }
    }

    function onShown() {
        const $autoComplete = refToJQuerySelector(autocompleteRef);
        switch (mode) {
            case "last-search":
                break;
            case "recent-notes":
                note_autocomplete.showRecentNotes($autoComplete);
                break;
            case "commands":
                note_autocomplete.showAllCommands($autoComplete);
                break;
        }

        $autoComplete
            .trigger("focus")
            .trigger("select");
    }

    return (
        <Modal
            className="jump-to-note-dialog"
            size="lg"
            title={<NoteAutocomplete
                placeholder={t("jump_to_note.search_placeholder")}
                inputRef={autocompleteRef}
                container={containerRef}
                text={initialText}
                opts={{
                    allowCreatingNotes: true,
                    hideGoToSelectedNoteButton: true,
                    allowJumpToSearchNotes: true,
                    isCommandPalette: true
                }}
                onTextChange={(text) => {
                    actualText.current = text;
                    setIsCommandMode(text.startsWith(">"));
                }}
                onChange={onItemSelected}
                />}
            onShown={onShown}
            onHidden={() => setShown(false)}
            footer={!isCommandMode && <Button className="show-in-full-text-button" text={t("jump_to_note.search_button")} keyboardShortcut="Ctrl+Enter" />}
            show={shown}
        >
            <div className="algolia-autocomplete-container jump-to-note-results" ref={containerRef}></div>
        </Modal>
    );
}

export default class JumpToNoteDialog extends ReactBasicWidget {

    get component() {
        return <JumpToNoteDialogComponent />;
    }

}