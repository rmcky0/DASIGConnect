import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Notification,
  AuditEntry,
  NotificationFilter,
  SseStatus,
  NotificationCategory,
  SseEventTemplate,
} from "../types";
import {
  listNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  openNotificationStream,
} from "../../../api/notificationApi";
import type { NotificationDto } from "../../../api/notificationApi";

export interface NotificationCounts {
  all: number;
  unread: number;
  submissions: number;
  publishing: number;
  system: number;
  overrides: number;
  deadline: number;
}

// ── SSE simulate templates (UI behaviour only — not persisted) ──────────────
const SSE_EVENTS: SseEventTemplate[] = [
  {
    trigger: "T1", category: "submissions",
    icon: "ti ti-file-plus", iconClass: "icon-navy",
    sender: "Submission · CIT-U",
    text: '<strong>Paulo Mendoza</strong> (CIT-U) submitted <em>"CIT-U World Environment Day"</em> for validation.',
    tags: [{ label: "T1", badgeClass: "badge-pending" }],
    link: "/validation/queue", linkLabel: "Open Queue",
    toastMessage: "New submission from CIT-U awaiting validation.",
  },
  {
    trigger: "T8", category: "deadline",
    icon: "ti ti-clock", iconClass: "icon-warning",
    sender: "Deadline Watch · Silliman",
    text: '<strong>URGENT:</strong> <em>"Silliman Biodiversity Week"</em> publishes in <strong>29 minutes</strong> — not yet validated.',
    tags: [{ label: "T8", badgeClass: "badge-pending" }],
    link: "/validation/queue", linkLabel: "Review Now",
    warning: true, toastMessage: "Validation deadline in 29 min — Silliman submission.",
  },
  {
    trigger: "T13", category: "system",
    icon: "ti ti-shield-exclamation", iconClass: "icon-error",
    sender: "System · Token Health",
    text: "<strong>CRITICAL:</strong> Facebook token re-validation triggered. Checking token health…",
    tags: [{ label: "T13", badgeClass: "badge-critical" }],
    link: "/settings/token", linkLabel: "Check Token",
    critical: true, toastMessage: "Critical: Token validation check triggered.",
  },
  {
    trigger: "T5", category: "publishing",
    icon: "ti ti-circle-check", iconClass: "icon-success",
    sender: "Publishing Engine",
    text: '<em>"USC Environment Forum II"</em> published successfully to the DASIG Facebook page.',
    tags: [{ label: "T5", badgeClass: "badge-published" }],
    link: "/dashboard", linkLabel: "View Post",
    toastMessage: "Post published successfully to Facebook.",
  },
  {
    trigger: "T7", category: "publishing",
    icon: "ti ti-circle-x", iconClass: "icon-error",
    sender: "Publishing Engine",
    text: '<strong>Publish failed</strong> for <em>"NORSU Open Day 2025"</em>. Error: token rate limit hit.',
    tags: [{ label: "T7", badgeClass: "badge-failed" }],
    link: "/dashboard", linkLabel: "Resolve",
    critical: true, toastMessage: "Publishing failed — manual action required.",
  },
];

// ── eventType → display metadata ────────────────────────────────────────────
interface EventDisplayMeta {
  trigger: string;
  category: NotificationCategory;
  icon: string;
  iconClass: string;
  critical?: boolean;
  warning?: boolean;
  sender: string;
  linkLabel: string;
  badgeClass: string;
}

const EVENT_META: Record<string, EventDisplayMeta> = {
  submission_pending:          { trigger: "T1",  category: "submissions", icon: "ti ti-file-plus",         iconClass: "icon-navy",    sender: "Submission System",           linkLabel: "Go to Validation Queue",  badgeClass: "badge-pending"   },
  submission_approved:         { trigger: "T2",  category: "submissions", icon: "ti ti-circle-check",      iconClass: "icon-success", sender: "Validation",                  linkLabel: "View in Calendar",        badgeClass: "badge-approved"  },
  submission_needs_revision:   { trigger: "T3",  category: "submissions", icon: "ti ti-pencil",            iconClass: "icon-info",    sender: "Validation",                  linkLabel: "Open Submission to Revise",badgeClass: "badge-revision" },
  submission_rejected:         { trigger: "T4",  category: "submissions", icon: "ti ti-circle-x",          iconClass: "icon-error",   sender: "Validation",                  linkLabel: "View Rejection Details",  badgeClass: "badge-rejected"  },
  submission_scheduled:        { trigger: "T2",  category: "submissions", icon: "ti ti-calendar",          iconClass: "icon-info",    sender: "Scheduler",                   linkLabel: "View in Calendar",        badgeClass: "badge-approved"  },
  submission_publish_failed:   { trigger: "T7",  category: "publishing",  icon: "ti ti-circle-x",          iconClass: "icon-error",   sender: "Publishing Engine",           linkLabel: "Go to Resolution Center", badgeClass: "badge-failed",   critical: true },
  submission_published:        { trigger: "T5",  category: "publishing",  icon: "ti ti-circle-check",      iconClass: "icon-success", sender: "Publishing Engine",           linkLabel: "View Live Post",          badgeClass: "badge-published" },
  submission_published_manual: { trigger: "T6",  category: "publishing",  icon: "ti ti-send",              iconClass: "icon-success", sender: "Admin · Manual Publish",      linkLabel: "View Live Post",          badgeClass: "badge-published" },
  validation_timeout:          { trigger: "T8",  category: "deadline",    icon: "ti ti-clock",             iconClass: "icon-warning", sender: "Deadline Watch",              linkLabel: "Review Submission",       badgeClass: "badge-pending",  warning: true  },
  override_approved:           { trigger: "T9",  category: "overrides",   icon: "ti ti-shield",            iconClass: "icon-purple",  sender: "Override Decision · Admin",   linkLabel: "Confirm Slot",            badgeClass: "badge-approved"  },
  override_denied:             { trigger: "T10", category: "overrides",   icon: "ti ti-shield-off",        iconClass: "icon-error",   sender: "Override Decision · Admin",   linkLabel: "Request New Override",    badgeClass: "badge-rejected"  },
  override_slot_suggested:     { trigger: "T17", category: "overrides",   icon: "ti ti-calendar-check",    iconClass: "icon-purple",  sender: "Override Suggestion · Admin", linkLabel: "Review Slot Options",     badgeClass: "badge-revision"  },
  admin_direct_post:           { trigger: "T11", category: "publishing",  icon: "ti ti-speakerphone",      iconClass: "icon-navy",    sender: "Admin Direct Post",           linkLabel: "View Post Record",        badgeClass: "badge-published" },
  institution_no_validator:    { trigger: "T14", category: "system",      icon: "ti ti-building",          iconClass: "icon-error",   sender: "System · Institution Monitor",linkLabel: "Manage Institution",      badgeClass: "badge-critical", critical: true },
  institution_onboarded:       { trigger: "T15", category: "system",      icon: "ti ti-sparkles",          iconClass: "icon-success", sender: "Onboarding System",           linkLabel: "View Institution",        badgeClass: "badge-approved"  },
  submission_rescheduled:      { trigger: "T16", category: "submissions", icon: "ti ti-calendar",          iconClass: "icon-info",    sender: "Admin · Rescheduled Post",    linkLabel: "View Calendar Entry",     badgeClass: "badge-revision"  },
  token_expiring:              { trigger: "T12", category: "system",      icon: "ti ti-key",               iconClass: "icon-warning", sender: "System · Token Guard",        linkLabel: "Renew Token",             badgeClass: "badge-pending",  warning: true  },
  token_invalid:               { trigger: "T13", category: "system",      icon: "ti ti-shield-exclamation",iconClass: "icon-error",   sender: "System · Token Health Check", linkLabel: "Go to Token Settings",    badgeClass: "badge-critical", critical: true },
  generic:                     { trigger: "SYS", category: "system",      icon: "ti ti-bell",              iconClass: "icon-info",    sender: "System",                      linkLabel: "View",                    badgeClass: "badge-system"    },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function computeGroup(iso: string): string {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 6) return `${diffDays} Days Ago`;
  return "Last Week";
}

function mapDto(dto: NotificationDto): Notification {
  const meta = EVENT_META[dto.eventType] ?? EVENT_META["generic"];
  return {
    id: dto.id,
    trigger: meta.trigger,
    category: meta.category,
    unread: dto.readAt === null,
    critical: meta.critical,
    warning: meta.warning,
    icon: meta.icon,
    iconClass: meta.iconClass,
    sender: meta.sender,
    time: formatRelativeTime(dto.createdAt),
    text: dto.message,
    tags: [{ label: meta.trigger, badgeClass: meta.badgeClass }],
    link: dto.deepLink ?? "/notifications",
    linkLabel: meta.linkLabel,
    group: computeGroup(dto.createdAt),
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<SseStatus>("connecting");
  const [eventCount, setEventCount] = useState(0);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [isSimulating, setIsSimulating] = useState(false);
  const sseIndexRef = useRef(0);
  const simulateFnRef = useRef<(() => void) | null>(null);

  // Fetch initial list
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFetchError(null);
    listNotifications(controller.signal)
      .then((res) => {
        setNotifications(res.data.map(mapDto));
      })
      .catch((err: { code?: string }) => {
        if (err?.code !== "ERR_CANCELED") {
          setFetchError("Could not load notifications. The backend may not be available.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Wire up real SSE stream
  useEffect(() => {
    const controller = new AbortController();
    setSseStatus("connecting");
    openNotificationStream(
      (dto) => {
        setNotifications((prev) => [mapDto(dto), ...prev]);
        setEventCount((prev) => prev + 1);
        setLastEventTime("just now");
        setAuditLog((prev) => [
          {
            type: "DISPATCHED",
            typeClass: "badge-approved",
            detail: `${dto.eventType} → in-app (SSE)`,
            time: "just now",
          },
          ...prev.slice(0, 9),
        ]);
      },
      () => setSseStatus("connected"),
      () => setSseStatus("disconnected"),
      controller.signal,
    );
    return () => controller.abort();
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const criticalCount = notifications.filter((n) => n.critical).length;

  const counts: NotificationCounts = {
    all: notifications.length,
    unread: unreadCount,
    submissions: notifications.filter((n) => n.category === "submissions").length,
    publishing: notifications.filter((n) => n.category === "publishing").length,
    system: notifications.filter((n) => n.category === "system").length,
    overrides: notifications.filter((n) => n.category === "overrides").length,
    deadline: notifications.filter((n) => n.category === "deadline").length,
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return n.unread;
    return n.category === activeFilter;
  });

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    apiMarkAllRead().catch(() => { /* fire-and-forget */ });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    apiMarkRead(id).catch(() => { /* fire-and-forget */ });
  }, []);

  // Simulate SSE — injects an ephemeral notification into local state
  const simulateSSE = useCallback(() => {
    if (isSimulating) return;
    setIsSimulating(true);
    window.setTimeout(() => {
      const event = SSE_EVENTS[sseIndexRef.current % SSE_EVENTS.length];
      sseIndexRef.current += 1;

      const newNotif: Notification = {
        id: `sse-${Date.now()}`,
        trigger: event.trigger,
        category: event.category,
        unread: true,
        critical: event.critical,
        warning: event.warning,
        icon: event.icon,
        iconClass: event.iconClass,
        sender: event.sender,
        time: "just now",
        text: event.text,
        tags: event.tags,
        link: event.link,
        linkLabel: event.linkLabel,
        group: "Today",
      };

      setNotifications((prev) => [newNotif, ...prev]);
      setEventCount((prev) => prev + 1);
      setLastEventTime("just now");
      setAuditLog((prev) => [
        {
          type: "DISPATCHED",
          typeClass: "badge-approved",
          detail: `${event.trigger} → in-app (SSE simulated)`,
          time: "just now",
        },
        ...prev.slice(0, 9),
      ]);
      setIsSimulating(false);
    }, 900);
  }, [isSimulating]);

  simulateFnRef.current = simulateSSE;

  useEffect(() => {
    const delays = [10000, 25000, 45000];
    const ids = delays.map((d) =>
      window.setTimeout(() => simulateFnRef.current?.(), d)
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  return {
    notifications: filteredNotifications,
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
    totalCount: notifications.length,
    counts,
    markAllRead,
    markRead,
    simulateSSE,
    isSimulating,
  };
}
