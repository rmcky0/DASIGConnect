import type { Folder } from "../../../api/folderApi";

export type FolderFilterMode = "all" | "unfiled" | "folder";

interface FolderSidebarProps {
  folders: Folder[];
  loading: boolean;
  filterMode: FolderFilterMode;
  selectedFolderId: string | null;
  allCount: number;
  unfiledCount: number;
  /** Number of assets currently checked — enables "move here" affordances. */
  selectionCount: number;
  onSelectAll: () => void;
  onSelectUnfiled: () => void;
  onSelectFolder: (id: string) => void;
  onCreate: () => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onMoveSelected: (folderId: string | null) => void;
}

/** Left-rail folder navigation for the Media Repository (presentational). */
export default function FolderSidebar({
  folders, loading, filterMode, selectedFolderId, allCount, unfiledCount, selectionCount,
  onSelectAll, onSelectUnfiled, onSelectFolder, onCreate, onRename, onDelete, onMoveSelected,
}: FolderSidebarProps) {
  const moving = selectionCount > 0;

  return (
    <aside className="fld-sidebar" aria-label="Folders">
      <div className="fld-head">
        <span className="fld-head-title">Folders</span>
        <button className="fld-add" type="button" aria-label="New folder" title="New folder" onClick={onCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {moving && <p className="fld-move-hint">Moving {selectionCount} selected — pick a destination.</p>}

      <nav className="fld-nav">
        <button
          type="button"
          className={`fld-item${filterMode === "all" ? " active" : ""}`}
          onClick={onSelectAll}
        >
          <span className="fld-item-label">All assets</span>
          <span className="fld-count">{allCount}</span>
        </button>

        <div className="fld-row">
          <button
            type="button"
            className={`fld-item${filterMode === "unfiled" ? " active" : ""}`}
            onClick={onSelectUnfiled}
          >
            <span className="fld-item-label">Unfiled</span>
            <span className="fld-count">{unfiledCount}</span>
          </button>
          {moving && (
            <button className="fld-move-btn" type="button" title="Move selected to Unfiled" onClick={() => onMoveSelected(null)}>
              Move here
            </button>
          )}
        </div>

        <div className="fld-divider" />

        {loading ? (
          <p className="fld-empty">Loading…</p>
        ) : folders.length === 0 ? (
          <p className="fld-empty">No folders yet. Use “+” to create one.</p>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="fld-row">
              <button
                type="button"
                className={`fld-item${filterMode === "folder" && selectedFolderId === folder.id ? " active" : ""}`}
                onClick={() => onSelectFolder(folder.id)}
                title={folder.name}
              >
                <svg className="fld-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="fld-item-label">{folder.name}</span>
                <span className="fld-count">{folder.assetCount}</span>
              </button>
              {moving ? (
                <button className="fld-move-btn" type="button" title={`Move selected to ${folder.name}`} onClick={() => onMoveSelected(folder.id)}>
                  Move here
                </button>
              ) : (
                <span className="fld-actions">
                  <button type="button" aria-label={`Rename ${folder.name}`} title="Rename" onClick={() => onRename(folder)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button type="button" aria-label={`Delete ${folder.name}`} title="Delete" onClick={() => onDelete(folder)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
