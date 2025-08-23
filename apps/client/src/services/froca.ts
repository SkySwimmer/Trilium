import utils from "./utils.js";
import FBranch, { type FBranchRow } from "../entities/fbranch.js";
import FNote, { type FNoteRow } from "../entities/fnote.js";
import FAttribute, { type FAttributeRow } from "../entities/fattribute.js";
import server from "./server.js";
import appContext from "../components/app_context.js";
import protectedSessionHolder from "./protected_session_holder.js";
import FBlob, { type FBlobRow } from "../entities/fblob.js";
import FAttachment, { type FAttachmentRow } from "../entities/fattachment.js";
import type { Froca } from "./froca-interface.js";
import ws from "./ws.js";

interface SubtreeResponse {
    notes: FNoteRow[];
    branches: FBranchRow[];
    attributes: FAttributeRow[];
}

interface SearchNoteResponse {
    searchResultNoteIds: string[];
    highlightedTokens: string[];
    error: string | null;
}

/**
 * Froca (FROntend CAche) keeps a read only cache of note tree structure in frontend's memory.
 * - notes are loaded lazily when unknown noteId is requested
 * - when note is loaded, all its parent and child branches are loaded as well. For a branch to be used, it's not must be loaded before
 * - deleted notes are present in the cache as well, but they don't have any branches. As a result check for deleted branch is done by presence check - if the branch is not there even though the corresponding note has been loaded, we can infer it is deleted.
 *
 * Note and branch deletions are corner cases and usually not needed.
 *
 * Backend has a similar cache called Becca
 */
class FrocaImpl implements Froca {
    initializedPromise: Promise<void>;

    notes!: Record<string, FNote>;
    branches!: Record<string, FBranch>;
    attributes!: Record<string, FAttribute>;
    attachments!: Record<string, FAttachment>;
    blobPromises!: Record<string, Promise<FBlob | null> | null>;

    constructor() {
        this.initializedPromise = this.loadInitialTree();
    }

    async loadInitialTree() {
        const resp = await server.get<SubtreeResponse>("tree");

        // clear the cache only directly before adding new content which is important for e.g., switching to protected session

        this.notes = {};
        this.branches = {};
        this.attributes = {};
        this.attachments = {};
        this.blobPromises = {};

        this.addResp(resp);
    }

    async loadSubTree(subTreeNoteId: string) {
        const resp = await server.get<SubtreeResponse>(`tree?subTreeNoteId=${subTreeNoteId}`);

        this.addResp(resp);

        return this.notes[subTreeNoteId];
    }

    addResp(resp: SubtreeResponse) {
        const noteRows = resp.notes;
        const branchRows = resp.branches;
        const attributeRows = resp.attributes;

        const noteIdsToSort = new Set<string>();

        for (const noteRow of noteRows) {
            const { noteId } = noteRow;

            const note = this.notes[noteId];

            if (note) {
                note.update(noteRow);

                // search note doesn't have child branches in the database and all the children are virtual branches
                if (note.type !== "search") {
                    for (const childNoteId of note.children) {
                        const childNote = this.notes[childNoteId];

                        if (childNote) {
                            childNote.parents = childNote.parents.filter((p) => p !== noteId);

                            delete this.branches[childNote.parentToBranch[noteId]];
                            delete childNote.parentToBranch[noteId];
                        }
                    }

                    note.children = [];
                    note.childToBranch = {};
                }

                // we want to remove all "real" branches (represented in the database) since those will be created
                // from branches argument but want to preserve all virtual ones from saved search
                note.parents = note.parents.filter((parentNoteId) => {
                    const parentNote = this.notes[parentNoteId];
                    const branch = this.branches[parentNote.childToBranch[noteId]];

                    if (!parentNote || !branch) {
                        return false;
                    }

                    if (branch.fromSearchNote) {
                        return true;
                    }

                    parentNote.children = parentNote.children.filter((p) => p !== noteId);

                    delete this.branches[parentNote.childToBranch[noteId]];
                    delete parentNote.childToBranch[noteId];

                    return false;
                });
            } else {
                this.notes[noteId] = new FNote(this, noteRow);
            }
        }

        for (const branchRow of branchRows) {
            const branch = new FBranch(this, branchRow);

            this.branches[branch.branchId] = branch;

            const childNote = this.notes[branch.noteId];

            if (childNote) {
                childNote.addParent(branch.parentNoteId, branch.branchId, false);
            }

            const parentNote = this.notes[branch.parentNoteId];

            if (parentNote) {
                parentNote.addChild(branch.noteId, branch.branchId, false);

                noteIdsToSort.add(parentNote.noteId);
            }
        }

        for (const attributeRow of attributeRows) {
            const { attributeId } = attributeRow;

            this.attributes[attributeId] = new FAttribute(this, attributeRow);

            const note = this.notes[attributeRow.noteId];

            if (note && !note.attributes.includes(attributeId)) {
                note.attributes.push(attributeId);
            }

            if (attributeRow.type === "relation") {
                const targetNote = this.notes[attributeRow.value];

                if (targetNote) {
                    if (!targetNote.targetRelations.includes(attributeId)) {
                        targetNote.targetRelations.push(attributeId);
                    }
                }
            }
        }

        // sort all of them at once, this avoids repeated sorts (#1480)
        for (const noteId of noteIdsToSort) {
            this.notes[noteId].sortChildren();
            this.notes[noteId].sortParents();
        }
    }

    async reloadNotes(noteIds: string[]) {
        if (noteIds.length === 0) {
            return;
        }

        noteIds = Array.from(new Set(noteIds)); // make noteIds unique

        const resp = await server.post<SubtreeResponse>("tree/load", { noteIds });

        this.addResp(resp);

        appContext.triggerEvent("notesReloaded", { noteIds });
    }

    async loadSearchNote(noteId: string) {
        const note = await this.getNote(noteId);

        if (!note || note.type !== "search") {
            return;
        }

        const { searchResultNoteIds, highlightedTokens, error } = await server.get<SearchNoteResponse>(`search-note/${note.noteId}`);

        if (!Array.isArray(searchResultNoteIds)) {
            throw new Error(`Search note '${note.noteId}' failed: ${searchResultNoteIds}`);
        }

        // reset all the virtual branches from old search results
        if (note.noteId in froca.notes) {
            froca.notes[note.noteId].children = [];
            froca.notes[note.noteId].childToBranch = {};
        }

        const branches: FBranchRow[] = [...note.getParentBranches(), ...note.getChildBranches()];

        searchResultNoteIds.forEach((resultNoteId, index) =>
            branches.push({
                // branchId should be repeatable since sometimes we reload some notes without rerendering the tree
                branchId: `virt-${note.noteId}-${resultNoteId}`,
                noteId: resultNoteId,
                parentNoteId: note.noteId,
                notePosition: (index + 1) * 10,
                fromSearchNote: true
            })
        );

        // update this note with standard (parent) branches + virtual (children) branches
        this.addResp({
            notes: [note],
            branches,
            attributes: []
        });

        froca.notes[note.noteId].searchResultsLoaded = true;
        froca.notes[note.noteId].highlightedTokens = highlightedTokens;

        return { error };
    }

    getNotesFromCache(noteIds: string[], silentNotFoundError = false): FNote[] {
        return noteIds
            .map((noteId) => {
                if (!this.notes[noteId] && !silentNotFoundError) {
                    console.trace(`Can't find note '${noteId}'`);

                    return null;
                } else {
                    return this.notes[noteId];
                }
            })
            .filter((note) => !!note) as FNote[];
    }

    async getNotes(noteIds: string[] | JQuery<string>, silentNotFoundError = false): Promise<FNote[]> {
        if (noteIds.length === 0) {
            return [];
        }

        noteIds = Array.from(new Set(noteIds)); // make unique
        const missingNoteIds = noteIds.filter((noteId) => !this.notes[noteId]);

        await this.reloadNotes(missingNoteIds);

        return noteIds
            .map((noteId) => {
                if (!this.notes[noteId] && !silentNotFoundError) {
                    console.trace(`Can't find note '${noteId}'`);

                    return null;
                } else {
                    return this.notes[noteId];
                }
            })
            .filter((note) => !!note) as FNote[];
    }

    async noteExists(noteId: string): Promise<boolean> {
        const notes = await this.getNotes([noteId], true);

        return notes.length === 1;
    }

    async getNote(noteId: string, silentNotFoundError = false): Promise<FNote | null> {
        if (noteId === "none") {
            console.trace(`No 'none' note.`);
            return null;
        } else if (!noteId) {
            console.trace(`Falsy noteId '${noteId}', returning null.`);
            return null;
        }

        return (await this.getNotes([noteId], silentNotFoundError))[0];
    }

    getNoteFromCache(noteId: string) {
        if (!noteId) {
            throw new Error("Empty noteId");
        }

        return this.notes[noteId];
    }

    getBranches(branchIds: string[], silentNotFoundError = false): FBranch[] {
        return branchIds.map((branchId) => this.getBranch(branchId, silentNotFoundError)).filter((b) => !!b) as FBranch[];
    }

    getBranch(branchId: string, silentNotFoundError = false) {
        if (!(branchId in this.branches)) {
            if (!silentNotFoundError) {
                logError(`Not existing branch '${branchId}'`);
            }
        } else {
            return this.branches[branchId];
        }
    }

    async getBranchId(parentNoteId: string, childNoteId: string) {
        if (childNoteId === "root") {
            return "none_root";
        }

        const child = await this.getNote(childNoteId);

        if (!child) {
            logError(`Could not find branchId for parent '${parentNoteId}', child '${childNoteId}' since child does not exist`);

            return null;
        }

        return child.parentToBranch[parentNoteId];
    }

    async getAttachment(attachmentId: string, silentNotFoundError = false) {
        const attachment = this.attachments[attachmentId];
        if (attachment) {
            return attachment;
        }

        // load all attachments for the given note even if one is requested, don't load one by one
        let attachmentRows;
        try {
            attachmentRows = await server.getWithSilentNotFound<FAttachmentRow[]>(`attachments/${attachmentId}/all`);
        } catch (e: any) {
            if (silentNotFoundError) {
                logInfo(`Attachment '${attachmentId}' not found, but silentNotFoundError is enabled: ` + e.message);
                return null;
            } else {
                throw e;
            }
        }

        const attachments = this.processAttachmentRows(attachmentRows);

        if (attachments.length) {
            attachments[0].getNote().attachments = attachments;
        }

        return this.attachments[attachmentId];
    }

    async getAttachmentsForNote(noteId: string) {
        const attachmentRows = await server.get<FAttachmentRow[]>(`notes/${noteId}/attachments`);
        return this.processAttachmentRows(attachmentRows);
    }

    processAttachmentRows(attachmentRows: FAttachmentRow[]): FAttachment[] {
        return attachmentRows.map((attachmentRow) => {
            let attachment;

            if (attachmentRow.attachmentId in this.attachments) {
                attachment = this.attachments[attachmentRow.attachmentId];
                attachment.update(attachmentRow);
            } else {
                attachment = new FAttachment(this, attachmentRow);
                this.attachments[attachment.attachmentId] = attachment;
            }

            return attachment;
        });
    }

    async getBlob(entityType: string, entityId: string): Promise<FBlob | null> {
        // I'm not sure why we're not using blobIds directly, it would save us this composite key ...
        // perhaps one benefit is that we're always requesting the latest blob, not relying on perhaps faulty/slow
        // websocket update?
        const key = `${entityType}-${entityId}`;

        if (!this.blobPromises[key]) {
            this.blobPromises[key] = server
                .get<FBlobRow>(`${entityType}/${entityId}/blob`)
                .then((row) => new FBlob(row))
                .catch((e) => {
                    console.error(`Cannot get blob for ${entityType} '${entityId}'`, e);
                    return null;
                });

            // we don't want to keep large payloads forever in memory, so we clean that up quite quickly
            // this cache is more meant to share the data between different components within one business transaction (e.g. loading of the note into the tab context and all the components)
            // if the blob is updated within the cache lifetime, it should be invalidated by froca_updater
            this.blobPromises[key]?.then(() => setTimeout(() => (this.blobPromises[key] = null), 1000));
        }

        return await this.blobPromises[key];
    }
}

const froca = new FrocaImpl();

// Refresher downloader
async function refreshNoteDownload(note: FNote, content: string, timestamp: number) {
    // Try syncing note

    // Compute info
    const data = content;
    const serverEditTimestamp = timestamp;

    // Update user information
    note.lastLocalData = data;
    note.lastLocalEdits = serverEditTimestamp;

    // Update server information
    note.lastRemoteData = data;
    note.lastRemoteEdits = serverEditTimestamp;

    // Success
    return true;
}

// Refresher uploader
async function refreshNoteUpload(note: FNote, content: string) {
    // Try syncing note upstream
    console.debug(utils.now(), "Uploading changes of note " + note.noteId + "...");

    // Update on server
    if (!await server.put(`notes/${note.noteId}/data`, { content: content }).then(() => true).catch((e) => {
        console.error(utils.now(), `Note refresh failure! Upload of ${note.noteId} failed! Exception: `, e);
        return false;
    })) {
        // Failed
        return false;
    }

    // Update user information
    note.lastLocalData = content;
    note.lastLocalEdits = Date.now();

    // Download blob
    const blob = await froca.getBlob("notes", note.noteId).catch((e) => {
        console.error(utils.now(), `Note refresh failure! Redownload of ${note.noteId} failed! Exception: `, e);
        return null;
    });

    // Check result
    if (blob != null) {
        // Update note sync data to match server
        note.lastLocalData = blob.content;
        note.lastLocalEdits = Date.parse(blob.utcDateModified);
    } else {
        // Failed
        return false;
    }

    // Success
    console.debug(utils.now(), "Uploading changes of note " + note.noteId + " completed successfully!");
    return true;
}

// Note refresh function
// Run whenever the client reconnects
async function refreshNotes() {
    // Called whenever the connection re-establishes
    console.log(utils.now(), "Attempting note refresh...");

    // Active note refreshes, this part of the code deals with refreshing note data, either uploading or downloading active notes
    // Depending on the server content, if the upstream is newer, itll need to be downloaded, if the upstream matches the cache but the contents changed, itll need upload
    let anyNotesChanged = false;
    const refreshedNotes: FNote[] = [];
    for (const noteID in froca.notes) {
        // Get note
        const note = froca.notes[noteID];
        if (note == null)
            continue;

        // Check if last edits metadata is available
        // This data is used to compare with the remote server, to properly sync edits before reload, so user data isnt lost
        if (note.lastEditsDataAvailable) {
            // Handle protected session
            // If the remote end ended the session but the local session still has it open, skip protected notes
            // If both ends still have it open, its safe to sync, so only ignore when the server disabled when the local end hasnt
            // By this time isProtectedSessionAvailable will be false should the remote end have disabled it
            if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable())
                continue; // Skip syncing this note to avoid errors

            // Touch protected session
            protectedSessionHolder.touchProtectedSessionIfNecessary(note);

            // Load local note edit metadata
            const lastLocalData = note.lastLocalData; // Current note contents (updated on user edit and whenever it syncs)
            const lastLocalEditTime = note.lastLocalEdits; // Current edit timestamp, the time when the note was last edited (updated on user edit and whenever it syncs)
            const lastRemoteData = note.lastRemoteData; // Last successfully-exchanged note data, this is the data that was on the server prior to disconnect

            // Load remote data
            // Calling manually so deleted blobs wont cause issues
            const blob = await server.getWithSilentNotFound<FBlobRow>("notes/" + note.noteId + "/blob").then((row) => new FBlob(row)).catch(() => null);
            if (!blob) {
                // Check if its a connection error
                const connected: boolean = await server.get("connectiontest").then((data: any) => {
                    return data.connected;
                }).catch((e) => {
                    console.error(utils.now(), `Note refresh failure! Connection to server unavailable! Exception: `, e);
                    return false;
                });

                // Check result
                if (!connected) {
                    // Connection error, abort
                    return false;
                }

                // Note no longer present likely
                continue; // Skip
            }
            const serverSidedData = blob.content; // Current serversided note contents
            const serverSidedEditTime = Date.parse(blob.utcDateModified); // Current serversided note update timestamp

            // Compare note against remote
            const remoteChangedSinceDisconnect = lastRemoteData !== serverSidedData; // Checks if the server side has changed by comparing the last synced data to the current data
            const localChangedSinceDisconnect = lastLocalData !== lastRemoteData; // Checks if the local note has been altered by the user since the disconnect
            if (remoteChangedSinceDisconnect) {
                // Remote end has changed since our disconnect

                // Check conflict
                if (localChangedSinceDisconnect) {
                    // Conflict

                    // Check times
                    console.debug(utils.now(), "Note " + note.noteId + " has gone out of sync! (local changed, upstream changed)");
                    console.debug(utils.now(), "Conflict detected with note refresh, performing resolution!");
                    if (lastLocalEditTime > serverSidedEditTime) {
                        // Current is newer
                        console.debug(utils.now(), "Local note changes are newer than upstream changes");

                        // Sync local data to upsream
                        if (!await refreshNoteUpload(note, lastLocalData))
                            return false;
                        refreshedNotes.push(note);
                        anyNotesChanged = true;
                    } else {
                        // Upstream is newer
                        console.debug(utils.now(), "Upstream note changes are newer than local changes");

                        // Download upstream data to local
                        if (!await refreshNoteDownload(note, serverSidedData, serverSidedEditTime))
                            return false;
                        refreshedNotes.push(note);
                        anyNotesChanged = true;
                    }
                } else {
                    // Download upstream data to local
                    console.debug(utils.now(), "Note " + note.noteId + " has gone out of sync! (local unchanged, upstream changed)");
                    if (!await refreshNoteDownload(note, serverSidedData, serverSidedEditTime))
                        return false;
                    refreshedNotes.push(note);
                    anyNotesChanged = true;
                }
            } else if (localChangedSinceDisconnect) {
                // Remote end unchanged but local end has changed

                // Sync local data to upsream
                console.debug(utils.now(), "Note " + note.noteId + " has gone out of sync! (local changed, upstream unchanged)");
                if (!await refreshNoteUpload(note, lastLocalData))
                    return false;
                refreshedNotes.push(note);
                anyNotesChanged = true;
            }
        }
    }

    // Log done
    console.log(utils.now(), "Note refresh finished");

    // Check if any changed
    if (anyNotesChanged) {
        // After that, the remaining notes in memory need refreshing
        // Otherwise desyncs will heavily break things
        console.log(utils.now(), "Refreshing notes in UI...");
        const refreshedIds: string[] = [];
        const allIds: string[] = [];
        for (const noteID in froca.notes) {
            // Add tree refresh
            allIds.push(froca.notes[noteID].noteId);
        }
        for (const note of refreshedNotes) {
            // Add to refresh list
            refreshedIds.push(note.noteId);
        }

        // Reload notes via froca
        // This will also trigger ui reload without a full window reload
        console.log(utils.now(), "Reloading tree...");
        await froca.loadInitialTree();
        console.log(utils.now(), "Reloading updated notes...");
        await froca.reloadNotes(refreshedIds);
        console.log(utils.now(), "Reloading all notes...");
        await froca.reloadNotes(allIds);
        console.log(utils.now(), "Calling froca reload...");
        await appContext.triggerEvent("frocaReloaded", {});

        // Now the active notes and tree have been reloaded
        // This however doesnt take care of themes and launchbar entries
        // I need to still figure that out
        // FIXME

        // Successfully finished
        console.log(utils.now(), "Reload finished");
    }
    return true;
}

// Bind to ws service' reconnect handshaker
// This isnt needed on initial connect, only reconnect
ws.subscribeToPreReconnectHandshake({
    main: async () => {
        // Refresh notes whenever the connection reconnects

        // Refresh the notes
        if (!await refreshNotes())
            return false;

        // Success
        return true;
    }
});

// Export froca
export default froca;
