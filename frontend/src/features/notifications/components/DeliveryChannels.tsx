export default function DeliveryChannels() {
  return (
    <>
      <div className="notif-card">
        <div className="notif-card-header">
          <div className="notif-card-title">Delivery Channels</div>
          <div className="notif-card-sub">Last 24 hours</div>
        </div>
        <div className="channel-list">
          <div className="channel-row">
            <div className="channel-icon icon-info">
              <i className="ti ti-device-desktop" style={{ fontSize: 15 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name">In-App</div>
              <div className="channel-sub">50 delivered · 0 failed</div>
            </div>
            <div className="channel-bar-wrap">
              <div className="channel-bar-bg">
                <div className="channel-bar-fill" style={{ width: "100%", background: "var(--notif-blue-brand)" }} />
              </div>
              <div className="channel-bar-pct">100%</div>
            </div>
          </div>
          <div className="channel-row">
            <div className="channel-icon icon-success">
              <i className="ti ti-mail" style={{ fontSize: 15 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name">Email</div>
              <div className="channel-sub">24 delivered · 1 retrying</div>
            </div>
            <div className="channel-bar-wrap">
              <div className="channel-bar-bg">
                <div className="channel-bar-fill" style={{ width: "92%", background: "var(--notif-success)" }} />
              </div>
              <div className="channel-bar-pct">92%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="notif-card">
        <div className="notif-card-header">
          <div className="notif-card-title">Alternative Flows</div>
          <div className="notif-card-sub">A1–A4 monitoring</div>
        </div>
        <div className="channel-list">
          <div className="channel-row">
            <div className="channel-icon icon-warning">
              <i className="ti ti-mail-off" style={{ fontSize: 14 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name alt-flow">A1 · Email Retry</div>
              <div className="channel-sub">1 pending · 0/3 retries</div>
            </div>
            <span className="notif-badge badge-pending">Active</span>
          </div>
          <div className="channel-row">
            <div className="channel-icon icon-navy">
              <i className="ti ti-wifi-off" style={{ fontSize: 14 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name alt-flow">A2 · Offline Queue</div>
              <div className="channel-sub">0 queued server-side</div>
            </div>
            <span className="notif-badge badge-approved-alt">Clear</span>
          </div>
          <div className="channel-row">
            <div className="channel-icon icon-navy">
              <i className="ti ti-stack" style={{ fontSize: 14 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name alt-flow">A3 · Batch (5s)</div>
              <div className="channel-sub">No concurrent events</div>
            </div>
            <span className="notif-badge badge-approved-alt">Idle</span>
          </div>
          <div className="channel-row">
            <div className="channel-icon icon-error">
              <i className="ti ti-flame" style={{ fontSize: 14 }} />
            </div>
            <div className="channel-info">
              <div className="channel-name alt-flow">A4 · Fail Consolidation</div>
              <div className="channel-sub">0 failures (1h window)</div>
            </div>
            <span className="notif-badge badge-approved-alt">Clear</span>
          </div>
        </div>
      </div>
    </>
  );
}
