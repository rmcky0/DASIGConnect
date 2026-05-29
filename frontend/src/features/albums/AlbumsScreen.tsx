import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import AlbumCard from "./components/AlbumCard";
import AlbumAssetTile from "./components/AlbumAssetTile";
import CreateAlbumModal from "./components/CreateAlbumModal";
import AssetPickerModal from "./components/AssetPickerModal";
import "../../styles/media-repository.css";
import "../../styles/albums.css";

interface AlbumsScreenProps {
  user: User;
}

export default function AlbumsScreen({ user }: AlbumsScreenProps) {
  void user; // albums are scoped server-side by the caller's institution
  const toast = useToast();
  const navigate = useNavigate();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openAlbum, setOpenAlbum] = useState<AlbumDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
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

  async function handleCreate(name: string, description: string) {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const album = await createAlbum({ name: name.trim(), description: description.trim() || null });
      setCreateOpen(false);
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
    const albumId = openAlbum.id;
    try {
      await removeAlbumAsset(albumId, assetId);
      await refreshDetail();
      setAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, assetCount: Math.max(0, a.assetCount - 1) } : a)),
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

        {openAlbum.assets.length === 0 ? (
          <div className="med-empty">
            <div className="med-empty-title">This album is empty</div>
            <p className="med-empty-sub">Use “Add assets” to put media into this album.</p>
          </div>
        ) : (
          <div className="alb-grid">
            {openAlbum.assets.map((asset) => (
              <AlbumAssetTile
                key={asset.id}
                asset={asset}
                isCover={openAlbum.coverAssetId === asset.id}
                onSetCover={(id) => void handleSetCover(id)}
                onRemove={(id) => void handleRemoveAsset(id)}
              />
            ))}
          </div>
        )}

        {pickerOpen && (
          <AssetPickerModal
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
          <button className="alb-back" type="button" onClick={() => navigate("/media-repository")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12,19 5,12 12,5" />
            </svg>
            Media Repository
          </button>
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
            <AlbumCard
              key={album.id}
              album={album}
              onOpen={(id) => void openDetail(id)}
              onDelete={(a) => void handleDeleteAlbum(a)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateAlbumModal
          creating={creating}
          onCancel={() => setCreateOpen(false)}
          onCreate={(name, description) => void handleCreate(name, description)}
        />
      )}

      {detailLoading && <div className="alb-loading-veil">Opening album…</div>}
    </div>
  );
}
