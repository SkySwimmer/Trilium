import { useNoteContext, useTriliumOption } from "../react/hooks";

/**
 * Handles the editing toolbar when the CKEditor is in decoupled mode.
 *
 * This toolbar is only enabled if the user has selected the classic CKEditor.
 *
 * The ribbon item is active by default for text notes, as long as they are not in read-only mode.
 * 
 * ! The toolbar is not only used in the ribbon, but also in the quick edit feature.
 */
export default function FormattingToolbar({ hidden }: { hidden?: boolean }) {
    const [ textNoteEditorType ] = useTriliumOption("textNoteEditorType");

    return (textNoteEditorType === "ckeditor-classic" &&
        <div className={`classic-toolbar-widget ${hidden ? "hidden-ext" : ""}`} />
    )
};

export function PopupEditorFormattingToolbar() {
    // TODO: Integrate this directly once we migrate away from class components.
    const { note } = useNoteContext();
    return <FormattingToolbar hidden={note?.type !== "text"} />;
}