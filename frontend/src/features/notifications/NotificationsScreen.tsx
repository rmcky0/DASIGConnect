import "../../styles/notifications.css";
import type { User } from "../../types/auth.types";
import { useNotifications } from "./hooks/useNotifications";
import FilterTabs from "./components/FilterTabs";
import NotificationList from "./components/NotificationList";
import SseStatusBar from "./components/SseStatusBar";
import BellWidget from "./components/BellWidget";
import DeliveryChannels from "./components/DeliveryChannels";
import AuditLog from "./components/AuditLog";

interface Props {
  user: User;
}

export default function NotificationsScreen({ user: _user }: Readonly<Props>) {
  const {
    notifications,
    auditLog,
    loading,
    fetchError,
    sseStatus,
    eventCount,
    lastEventTime,
    activeFilter,
    setActiveFilter,
    unreadCount,
    criticalCount,
    totalCount,
    counts,
    markAllRead,
    markRead,
    simulateSSE,
    isSimulating,
  } = useNotifications();

  return (
    <div className="notif-page">
      {/* ── Page Header ── */}
      <div className="notif-page-header">
        <div>
          <h1>Notifications</h1>
          <p>UC-2.3 · System and Submission Notifications · Real-time SSE delivery</p>
        </div>
        <div className="notif-page-actions">
          <button type="button" className="notif-btn notif-btn-ghost" onClick={markAllRead}>
            <i className="ti ti-checks" style={{ fontSize: 14 }} />
            <span>Mark all read</span>
          </button>
          <button type="button" className="notif-btn notif-btn-ghost">
            <i className="ti ti-settings" style={{ fontSize: 14 }} />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* ── SSE Status Bar ── */}
      <SseStatusBar
        status={sseStatus}
        eventCount={eventCount}
        unreadCount={unreadCount}
        lastEventTime={lastEventTime}
        isSimulating={isSimulating}
        onSimulate={simulateSSE}
      />

      {/* ── Main 2-column layout ── */}
      <div className="notif-layout">

        {/* ── Left: Notification Panel ── */}
        <div className="notif-panel">
          <div className="notif-panel-header">
            <div>
              <div className="notif-panel-title">All Notifications</div>
              <div className="notif-panel-meta">
                {totalCount} notifications · {unreadCount} unread
              </div>
            </div>
            <div className="notif-panel-actions">
              <button type="button" className="notif-icon-btn" title="Filter">
                <i className="ti ti-adjustments" style={{ fontSize: 14 }} />
              </button>
              <button type="button" className="notif-icon-btn" title="Sort">
                <i className="ti ti-arrows-sort" style={{ fontSize: 14 }} />
              </button>
              <button
                type="button"
                className="notif-icon-btn"
                title="Refresh"
                onClick={() => setActiveFilter(activeFilter)}
              >
                <i className="ti ti-refresh" style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>

          <FilterTabs
            activeFilter={activeFilter}
            counts={counts}
            onChange={setActiveFilter}
          />

          <NotificationList
            notifications={notifications}
            onNotificationClick={markRead}
            loading={loading}
            error={fetchError}
          />
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="notif-right-sidebar">
          <BellWidget
            unreadCount={unreadCount}
            criticalCount={criticalCount}
            totalCount={totalCount}
          />
          <DeliveryChannels />
          <AuditLog entries={auditLog} />
        </div>
      </div>
    </div>
  );
}
