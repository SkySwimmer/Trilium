import type RootContainer from "../widgets/containers/root_container.js";

import AboutDialog from "../widgets/dialogs/about.js";
import HelpDialog from "../widgets/dialogs/help.js";
import JumpToNoteDialog from "../widgets/dialogs/jump_to_note.js";
import RecentChangesDialog from "../widgets/dialogs/recent_changes.js";
import PromptDialog from "../widgets/dialogs/prompt.js";
import AddLinkDialog from "../widgets/dialogs/add_link.js";
import IncludeNoteDialog from "../widgets/dialogs/include_note.js";
import BulkActionsDialog from "../widgets/dialogs/bulk_actions.js";
import BranchPrefixDialog from "../widgets/dialogs/branch_prefix.js";
import SortChildNotesDialog from "../widgets/dialogs/sort_child_notes.js";
import NoteTypeChooserDialog from "../widgets/dialogs/note_type_chooser.js";
import MoveToDialog from "../widgets/dialogs/move_to.js";
import CloneToDialog from "../widgets/dialogs/clone_to.js";
import ImportDialog from "../widgets/dialogs/import.js";
import ExportDialog from "../widgets/dialogs/export.js";
import MarkdownImportDialog from "../widgets/dialogs/markdown_import.js";
import ProtectedSessionPasswordDialog from "../widgets/dialogs/protected_session_password.js";
import ConfirmDialog from "../widgets/dialogs/confirm.js";
import RevisionsDialog from "../widgets/dialogs/revisions.js";
import DeleteNotesDialog from "../widgets/dialogs/delete_notes.js";
import InfoDialog from "../widgets/dialogs/info.js";
import IncorrectCpuArchDialog from "../widgets/dialogs/incorrect_cpu_arch.js";
import PopupEditorDialog from "../widgets/dialogs/popup_editor.js";
import FlexContainer from "../widgets/containers/flex_container.js";
import NoteIconWidget from "../widgets/note_icon.js";
import NoteTitleWidget from "../widgets/note_title.js";
import ClassicEditorToolbar from "../widgets/ribbon_widgets/classic_editor_toolbar.js";
import PromotedAttributesWidget from "../widgets/ribbon_widgets/promoted_attributes.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import NoteListWidget from "../widgets/note_list.js";
import { CallToActionDialog } from "../widgets/dialogs/call_to_action.jsx";

export function applyModals(rootContainer: RootContainer) {
    rootContainer
        .child(new BulkActionsDialog())
        .child(new AboutDialog())
        .child(new HelpDialog())
        .child(new RecentChangesDialog())
        .child(new BranchPrefixDialog())
        .child(new SortChildNotesDialog())
        .child(new IncludeNoteDialog())
        .child(new NoteTypeChooserDialog())
        .child(new JumpToNoteDialog())
        .child(new AddLinkDialog())
        .child(new CloneToDialog())
        .child(new MoveToDialog())
        .child(new ImportDialog())
        .child(new ExportDialog())
        .child(new MarkdownImportDialog())
        .child(new ProtectedSessionPasswordDialog())
        .child(new RevisionsDialog())
        .child(new DeleteNotesDialog())
        .child(new InfoDialog())
        .child(new ConfirmDialog())
        .child(new PromptDialog())
        .child(new IncorrectCpuArchDialog())
        .child(new PopupEditorDialog()
                .child(new FlexContainer("row")
                    .class("title-row")
                    .css("align-items", "center")
                    .cssBlock(".title-row > * { margin: 5px; }")
                    .child(new NoteIconWidget())
                    .child(new NoteTitleWidget()))
                .child(new ClassicEditorToolbar())
                .child(new PromotedAttributesWidget())
                .child(new NoteDetailWidget())
                .child(new NoteListWidget(true)))
        .child(new CallToActionDialog());
}
