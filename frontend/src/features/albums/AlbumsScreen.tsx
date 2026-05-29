import { useEffect, useState } from "react";
import type { User } from "../../types/auth.types";
import {
  listAlbums,
  getAlbum,
  createAlbum,
  deleteAlbum,
  addAlbumAssets,
  removeAlbumAsset,
  setAlbumCover,
  type Album,
  type AlbumDetail,
} from "../../api/albumApi";
import { searchMediaAssets, type MediaAsset } from "../../api/mediaApi";
import { useToast } from "../../context/ToastContext";
import "../../styles/media-repository.css";
import "../../styles/albums.css";

interface AlbumsScreenProps {
  user: User;
}

const IMAGE_TYPES = new Set(["jpeg", "jpg", "png", "webp", "gif"]);

function isImage(fileType: string) {
  return IMAGE_TYPES.has(fileType.toLowerCase());
}

export default function AlbumsScreen({ user }: AlbumsScreenProps) {
  void user; // albums are scoped server-side by the caller's institution
  const toast = useToast();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openAlbum, setOpenAlbum] = useState<AlbumDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAssets, setPickerAssets] = useState<MediaAsset[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  function fetchAlbums(signal?: AbortSignal) {
    listAlbums(signal)
      .then(setAlbums)
      .catch(() => setError("Could not load albums."))
      .finally(() => setLoading(false));
  }

  // Event-handler reload (sets loading/error then fetches) — kept out of the effect body.
  function reload() {
    setLoading(true);
    setError(null);
    fetchAlbums();
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchAlbums(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      setOpenAlbum(await getAlbum(id));
    } catch {
      toast.error("Could not open that album.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!openAlbum) return;
    try {
      setOpenAlbum(await getAlbum(openAlbum.id));
    } catch {
      /* keep current view on refresh error */
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const album = await createAlbum({ name: name.trim(), description: description.trim() || null });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setAlbums((prev) => [album, ...prev]);
      toast.success(`Album "${album.name}" created.`);
    } catch {
      toast.error("Could not create the album.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteAlbum(album: Album) {
    if (!window.confirm(`Delete album "${album.name}"? The assets themselves are not deleted.`)) return;
    try {
      await deleteAlbum(album.id);
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
      if (openAlbum?.id === album.id) setOpenAlbum(null);
      toast.success("Album deleted.");
    } catch {
      toast.error("Could not delete the album.");
    }
  }

  function openPicker() {
    setPickerOpen(true);
    setPickerSelected(new Set());
    setPickerLoading(true);
    searchMediaAssets({ pageSize: 100 })
      .then((page) => setPickerAssets(page.items))
      .catch(() => toast.error("Could not load assets."))
      .finally(() => setPickerLoading(false));
  }

  function togglePick(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSelected() {
    if (!openAlbum || pickerSelected.size === 0) return;
    setAdding(true);
    try {
      const detail = await addAlbumAssets(openAlbum.id, [...pickerSelected]);
      setOpenAlbum(detail);
      setAlbums((prev) => prev.map((a) => (a.id === detail.id ? { ...a, assetCount: detail.assetCount } : a)));
      setPickerOpen(false);
      toast.success(`Added ${pickerSelected.size} ${pickerSelected.size === 1 ? "asset" : "assets"}.`);
    } catch {
      toast.error("Could not add assets to the album.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveAsset(assetId: string) {
    if (!openAlbum) return;
    try {
      await removeAlbumAsset(openAlbum.id, assetId);
      await refreshDetail();
      setAlbums((prev) =>
        prev.map((a) => (a.id === openAlbum.id ? { ...a, assetCount: Math.max(0, a.assetCount - 1) } : a)),
      );
    } catch {
      toast.error("Could not remove the asset.");
    }
  }

  async function handleSetCover(assetId: string) {
    if (!openAlbum) return;
    try {
      await setAlbumCover(openAlbum.id, assetId);
      await refreshDetail();
      toast.success("Cover updated.");
    } catch {
      toast.error("Could not set the cover.");
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (openAlbum) {
    const coverable = openAlbum.assets;
    return (
      <div className="med-page">
        <div className="med-header">
          <div>
            <button className="alb-back" type="button" onClick={() => setOpenAlbum(null)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12,19 5,12 12,5" />
              </svg>
              All albums
            </button>
            <h1 className="med-title">{openAlbum.name}</h1>
            <p className="med-subtitle">
              {openAlbum.assetCount} {openAlbum.assetCount === 1 ? "asset" : "assets"}
              {openAlbum.source === "ai_suggested" ? " · AI-suggested" : ""}
              {openAlbum.description ? ` · ${openAlbum.description}` : ""}
            </p>
          </div>
          <div className="med-header-actions">
            <button className="med-btn med-btn-primary med-btn-sm" type="button" onClick={openPicker}>
              Add assets
            </button>
          </div>
        </div>

        {coverable.length === 0 ? (
          <div className="med-empty">
            <div className="med-empty-title">This album is empty</div>
            <p className="med-empty-sub">Use “Add assets” to put media into this album.</p>
          </div>
        ) : (
          <div className="alb-grid">
            {coverable.map((asset) => (
              <figure key={asset.id} className="alb-asset">
                <div className="alb-asset-thumb">
                  {isImage(asset.fileType) ? (
                    <img src={asset.storageUrl} alt={asset.fileName} loading="lazy" />
                  ) : (
                    <span className="alb-asset-file">{asset.fileType.toUpperCase()}</span>
                  )}
                  {openAlbum.coverAssetId === asset.id && <span className="alb-cover-badge">Cover</span>}
                  <div className="alb-asset-actions">
                    <button type="button" title="Set as cover" aria-label="Set as cover" onClick={() => void handleSetCover(asset.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    <button type="button" title="Remove from album" aria-label="Remove from album" onClick={() => void handleRemoveAsset(asset.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
                <figcaption className="alb-asset-name">{asset.fileName}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {pickerOpen && (
          <AssetPicker
            assets={pickerAssets}
            loading={pickerLoading}
            selected={pickerSelected}
            adding={adding}
            onToggle={togglePick}
            onClose={() => { if (!adding) setPickerOpen(false); }}
            onConfirm={() => void handleAddSelected()}
          />
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="med-page">
      <div className="med-header">
        <div>
          <h1 className="med-title">Albums</h1>
          <p className="med-subtitle">Curated collections · an asset can live in many albums</p>
        </div>
        <div className="med-header-actions">
          <button className="med-btn med-btn-primary med-btn-sm" type="button" onClick={() => setCreateOpen(true)}>
            New Album
          </button>
        </div>
      </div>

      {loading ? (
        <div className="med-empty"><div className="med-empty-title">Loading albums…</div></div>
      ) : error ? (
        <div className="med-empty">
          <div className="med-empty-title">Failed to load albums</div>
          <p className="med-empty-sub">{error}</p>
          <button className="med-btn med-btn-ghost" type="button" style={{ marginTop: 20 }} onClick={reload}>Try again</button>
        </div>
      ) : albums.length === 0 ? (
        <div className="med-empty">
          <div className="med-empty-title">No albums yet</div>
          <p className="med-empty-sub">Create an album to group related media into a curated collection.</p>
          <button className="med-btn med-btn-primary" type="button" style={{ marginTop: 20 }} onClick={() => setCreateOpen(true)}>New Album</button>
        </div>
      ) : (
        <div className="alb-list">
          {albums.map((album) => (
            <article key={album.id} className="alb-card" onClick={() => void openDetail(album.id)}>
              <div className="alb-card-cover">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
              </div>
              <div className="alb-card-body">
                <div className="alb-card-name">
                  {album.name}
                  {album.source === "ai_suggested" && <span className="alb-ai-badge">AI</span>}
                </div>
                <div className="alb-card-meta">{album.assetCount} {album.assetCount === 1 ? "asset" : "assets"}</div>
                {album.description && <p className="alb-card-desc">{album.description}</p>}
              </div>
              <button
                className="alb-card-delete"
                type="button"
                aria-label={`Delete album ${album.name}`}
                onClick={(e) => { e.stopPropagation(); void handleDeleteAlbum(album); }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="alb-modal-overlay" role="dialog" aria-modal="true" aria-label="Create album" onClick={() => { if (!creating) setCreateOpen(false); }}>
          <div className="alb-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="alb-modal-title">New Album</h2>
            <label className="alb-field">
              <span>Name</span>
              <input autoFocus value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="e.g. Graduation 2026" />
            </label>
            <label className="alb-field">
              <span>Description <em>(optional)</em></span>
              <textarea value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="alb-modal-actions">
              <button className="med-btn med-btn-ghost med-btn-sm" type="button" disabled={creating} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="med-btn med-btn-primary med-btn-sm" type="button" disabled={creating || !name.trim()} onClick={() => void handleCreate()}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailLoading && <div className="alb-loading-veil">Opening album…</div>}
    </div>
  );
}

function AssetPicker({
  assets, loading, selected, adding, onToggle, onClose, onConfirm,
}: {
  assets: MediaAsset[];
  loading: boolean;
  selected: Set<string>;
  adding: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="alb-modal-overlay" role="dialog" aria-modal="true" aria-label="Add assets to album" onClick={onClose}>
      <div className="alb-modal alb-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="alb-modal-title">Add assets</h2>
        {loading ? (
          <div className="alb-picker-empty">Loading assets…</div>
        ) : assets.length === 0 ? (
          <div className="alb-picker-empty">No assets available to add.</div>
        ) : (
          <div className="alb-picker-grid">
            {assets.map((asset) => {
              const checked = selected.has(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`alb-picker-item${checked ? " checked" : ""}`}
                  aria-pressed={checked}
                  onClick={() => onToggle(asset.id)}
                >
                  {isImage(asset.fileType) ? (
                    <img src={asset.storageUrl} alt={asset.fileName} loading="lazy" />
                  ) : (
                    <span className="alb-asset-file">{asset.fileType.toUpperCase()}</span>
                  )}
                  {checked && <span className="alb-picker-check" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="alb-modal-actions">
          <button className="med-btn med-btn-ghost med-btn-sm" type="button" disabled={adding} onClick={onClose}>Cancel</button>
          <button className="med-btn med-btn-primary med-btn-sm" type="button" disabled={adding || selected.size === 0} onClick={onConfirm}>
            {adding ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
