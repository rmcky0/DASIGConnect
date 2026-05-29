import type { MediaAsset } from "../../../api/mediaApi";
import { isImage } from "../mediaType";

interface AssetPickerModalProps {
  assets: MediaAsset[];
  loading: boolean;
  selected: Set<string>;
  adding: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/** Multi-select grid for adding existing assets to an album (controlled, presentational). */
export default function AssetPickerModal({
  assets, loading, selected, adding, onToggle, onClose, onConfirm,
}: AssetPickerModalProps) {
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
          <button className="med-btn med-btn-ghost med-btn-sm" type="button" disabled={adding} onClick={onClose}>
            Cancel
          </button>
          <button
            className="med-btn med-btn-primary med-btn-sm"
            type="button"
            disabled={adding || selected.size === 0}
            onClick={onConfirm}
          >
            {adding ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
