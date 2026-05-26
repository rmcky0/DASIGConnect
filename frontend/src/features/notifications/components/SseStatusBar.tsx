import type { SseStatus } from "../types";

interface Props {
  status: SseStatus;
  eventCount: number;
  unreadCount: number;
  lastEventTime: string | null;
  isSimulating: boolean;
  onSimulate: () => void;
}

const STATUS_LABEL: Record<SseStatus, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
};

export default function SseStatusBar({
  status,
  eventCount,
  unreadCount,
  lastEventTime,
  isSimulating,
  onSimulate,
}: Props) {
  const sublabel =
    status === "connected"
      ? `Connected — /api/notifications/stream · Last event: ${lastEventTime ?? "—"}`
      : status === "connecting"
      ? "Establishing connection to /api/notifications/stream…"
      : "SSE stream unavailable — UC-2.3 backend not yet deployed";

  return (
    <div className="sse-bar">
      <div className="sse-left">
        <div className={`sse-dot ${status === "connected" ? "" : status}`} />
        <div>
          <div className="sse-label">
            SSENotificationListener · {STATUS_LABEL[status]}
          </div>
          <div className="sse-sublabel">{sublabel}</div>
        </div>
      </div>
      <div className="sse-right">
        <div className="sse-stat">
          <div className="sse-stat-val">{eventCount}</div>
          <div className="sse-stat-lbl">Events today</div>
        </div>
        <div className="sse-divider" />
        <div className="sse-stat">
          <div className="sse-stat-val">{unreadCount}</div>
          <div className="sse-stat-lbl">Unread</div>
        </div>
        <div className="sse-divider" />
        <div className="sse-stat">
          <div className="sse-stat-val" style={{ color: "var(--notif-success)" }}>0</div>
          <div className="sse-stat-lbl">Failures</div>
        </div>
        <button
          type="button"
          className="notif-btn notif-btn-ghost sse-sim-btn"
          onClick={onSimulate}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <>
              <i className="ti ti-loader-2 spin" style={{ fontSize: 12 }} />
              Receiving…
            </>
          ) : (
            <>
              <i className="ti ti-radio" style={{ fontSize: 12 }} />
              Simulate event
            </>
          )}
        </button>
      </div>
    </div>
  );
}
