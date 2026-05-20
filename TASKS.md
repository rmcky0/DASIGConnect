# DASIGConnect — Task Tracker

Team `2526-sem2-it332-38` · CIT-U Capstone · Spring Boot 4.0.6 + React 19

**Legend:** ✅ Done · 🔄 In Progress · ⬜ Not Started

---

## Backend

### M1 — Foundation & Infrastructure (Lerah)

- ✅ All JPA entities: `User`, `Institution`, `Submission`, `SlotReservation`, `InvitationToken`, `PasswordResetToken`, `AccountLockout`, `AuditLog`
- ✅ All base repositories: `UserRepository`, `InstitutionRepository`, `SubmissionRepository`, `SlotReservationRepository`, `InvitationTokenRepository`, `PasswordResetTokenRepository`, `AccountLockoutRepository`, `AuditLogRepository`
- ✅ Core services: `JWTService`, `AuditLogService`, `EmailService`, `TenantScopeService`
- ✅ Security infrastructure: `JwtAuthenticationFilter`, `SecurityConfig`, `JwtUserDetails`
- ✅ Flyway V1 migration — all foundational tables + RLS policies
- ✅ `JacksonConfig`, HikariCP configuration
- ✅ `BackendApplication` `flyway` and `dbDiagnostics` beans gated with `@ConditionalOnProperty(spring.flyway.enabled)` — required for `@WebMvcTest` / `@SpringBootTest` isolation

**M1 Tests:**
- ✅ `BackendApplicationTests`, `JWTServiceTest`, `AuditLogServiceTest`, `TenantScopeServiceTest`

---

### M2 — Auth & User Provisioning (Chris)

- ✅ `AuthController` — `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`
- ✅ `InvitationController` — `POST /api/v1/invitations`, `GET /api/v1/invitations/validate`, `POST /api/v1/invitations/accept`
- ✅ `PasswordController` — `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
- ✅ `AuthService` — login with lockout check, BCrypt verify, JWT generation, audit log
- ✅ `AccountLockoutService` — failed attempt tracking, 5-attempt / 15-min lockout policy
- ✅ `InvitationService` — hashed one-time tokens, user provisioning, `pending_email_undelivered` on SMTP failure
- ✅ `PasswordService` — anti-enumeration reset token flow
- ✅ `JwtUserDetails`, `TokenHashUtils`, `GlobalExceptionHandler`
- ✅ Dashboard shows SMTP failure warning + fallback raw invite link
- ✅ Mail config read from `.env` (MAIL_HOST, MAIL_USERNAME, APP_FRONTEND_BASE_URL, etc.)
- ⬜ Configure real SMTP credentials in `backend/.env`
- ⬜ Create `backend/.env.example` with all required env var keys (committed to git; real `.env` stays gitignored)
- ⬜ `UserController` + `UserService` + `UserDto` — list/view/manage users per institution; lifecycle: pending→active→inactive
- ⬜ `GET /api/v1/me` — authenticated user profile (role, email, institution_id) for frontend identity
- ⬜ `GET /api/v1/users?institutionId=` — user list per institution for dashboard counts
- ⬜ `POST /api/v1/invitations/{id}/resend` — admin resend when SMTP failed or invite lost

**M2 Tests:**
- ✅ `AccountLockoutServiceTest`, `AuthServiceTest`, `InvitationServiceTest`, `PasswordServiceTest`
- ✅ `AuthControllerTest`, `InvitationControllerTest`, `PasswordControllerTest`

---

### M4 — Institution Management & Scheduling (Chim)

- ✅ `InstitutionController`, `InstitutionService`, `InstitutionRepository`
- ✅ `GuardRailService` — evaluates GR-H1 through GR-H5, GR-S1, GR-S2
- ✅ `SlotReservationService`, `SlotReservationRepository`
- ✅ `SubmissionRepository` guard rail queries
- ✅ `WorkspaceProvisionerService` — provisions RLS + workspace on first Validator invite
- ✅ `StaleDraftSlotReleaseJob` — @Scheduled, releases held slot reservations after 7 days inactivity (GR-T2)
- ✅ Exceptions: `GuardRailViolationException`, `InstitutionNotFoundException`, `SlotAlreadyTakenException`
- ✅ DTOs: `CreateInstitutionRequest`, `InstitutionDto`, `GuardRailResult`, `GuardRailViolation`
- ✅ `Institution.emailDomain` field + `V2__add_institution_email_domain.sql` Flyway migration (on `dev`)

**M4 Tests:**
- ✅ `InstitutionDtoTest`, `GuardRailDtoTest`, `InstitutionServiceTest`, `GuardRailServiceTest`, `SlotReservationTest`

---

### UC-1.3 — Content Submission Backend (Jay / assigned member)

- ⬜ Flyway `V3__submissions_and_media.sql` — `submissions` table (full schema per SDD), `slot_reservations` updates
- ⬜ `SubmissionController`:
  - `POST /api/v1/submissions` — create DRAFT
  - `PATCH /api/v1/submissions/{id}` — update draft fields (auto-save support)
  - `DELETE /api/v1/submissions/{id}` — delete draft
  - `POST /api/v1/submissions/{id}/submit` — transition DRAFT → PENDING
  - `POST /api/v1/submissions/{id}/evaluate-slot` — guard rail check for selected slot
  - `GET /api/v1/submissions` — list submissions (filtered by role/institution)
  - `GET /api/v1/submissions/{id}` — get single submission detail
  - `GET /api/v1/submissions/lookups` — form dropdown data (event types, etc.)
  - `POST /api/v1/submissions/{id}/media` — attach media file from upload
  - `POST /api/v1/submissions/{id}/assets` — attach existing library asset to submission
  - `POST /api/v1/submissions/{id}/override-request` — submit GR violation override request
- ⬜ `SubmissionService` — state machine: DRAFT→PENDING, NEEDS_REVISION re-submission, 60-second auto-save, draft deletion validation
- ⬜ `SubmissionRepository` — custom queries for state + institution filtering

> **Note:** Resolve API prefix before starting — SDD uses `/api/` but existing M2/M4 code uses `/api/v1/`. Standardize on `/api/v1/` to match existing work.

---

### UC-2.1 — Content Validation Backend

- ⬜ Flyway migration — `validation_logs`, `review_locks` tables
- ⬜ `ValidationController`:
  - `GET /api/v1/validation/queue` — PENDING submissions sorted by scheduled_at
  - `GET /api/v1/validation/{submissionId}` — full submission detail for review
  - `POST /api/v1/validation/{submissionId}/lock` — acquire 30-min review lock
  - `DELETE /api/v1/validation/{submissionId}/lock` — release lock
  - `POST /api/v1/validation/{submissionId}/approve` — transition to SCHEDULED, lock slot
  - `POST /api/v1/validation/{submissionId}/revise` — transition to NEEDS_REVISION, release slot, send remarks
  - `POST /api/v1/validation/{submissionId}/reject` — transition to REJECTED (terminal), release slot
- ⬜ `ValidationService` — state machine enforcement, GR-H5 (no self-approval), lock management
- ⬜ `ReviewLockService` — 30-min lock acquisition, expiry, release
- ⬜ `ValidationTimeoutDetectorJob` — @Scheduled every 1 min, escalates submissions ≤30 min before scheduled_at that are still PENDING/IN_REVIEW (GR-T1)
- ⬜ `ValidationLogRepository`, `ReviewLockRepository`

---

### UC-2.2 — Media Repository Backend

- ⬜ Flyway migration — `media_assets` (with `embedding VECTOR(1024)`), `asset_tags`, `submission_media_assets` tables; `ivfflat` index on `embedding`
- ⬜ `MediaAssetController`:
  - `POST /api/v1/media/upload` — upload file to Supabase Storage, create `media_assets` record
  - `GET /api/v1/media` — list assets (paginated, filtered by category/tags/text)
  - `GET /api/v1/media/{assetId}` — asset detail with tags and Used In submissions
  - `POST /api/v1/media/{assetId}/tags` — add custom tag
  - `DELETE /api/v1/media/{assetId}/tags/{tagId}` — remove tag
  - `GET /api/v1/media/{assetId}/deletion-check` — check if asset is safe to delete
  - `DELETE /api/v1/media/{assetId}` — soft delete (blocked if active submission references asset)
- ⬜ `MediaAssetService`, `AssetDeletionService` — deletion logic: blocked (active refs), warning (draft refs), free (no refs)
- ⬜ `StorageService` — Supabase Storage client for upload/retrieval/deletion
- ⬜ `MediaAssetRepository`

---

### UC-2.3 — Notifications Backend

- ⬜ Flyway migration — `notifications`, `email_delivery_log` tables
- ⬜ `NotificationController`:
  - `GET /api/v1/notifications/stream` — SSE `SseEmitter` endpoint (persistent connection)
  - `GET /api/v1/notifications` — paginated notification history
  - `GET /api/v1/notifications/unread-count` — badge count
  - `PATCH /api/v1/notifications/{id}/read` — mark single read
  - `POST /api/v1/notifications/mark-all-read`
- ⬜ `NotificationService` — dispatches all 17 trigger types (T1–T17), email retry (3x at 1-min intervals), batching for simultaneous events, consolidation for >5 PUBLISH_FAILED/hour (GR-T6)
- ⬜ `SSEEmitterRegistry` — manages open `SseEmitter` connections per user_id
- ⬜ `NotificationRepository`, `EmailDeliveryLogRepository`

---

### UC-2.4 — Analytics Dashboard Backend

- ⬜ Flyway migration — `ai_interaction_log` table
- ⬜ `AnalyticsController`:
  - `GET /api/v1/analytics/dashboard` — KPI tiles (avg posting delay, content completeness, total posts), 12-week sparklines, period-over-period deltas; time range: 7d/30d/90d/YTD
  - `GET /api/v1/analytics/posts-by-institution` — admin-only bar chart data
  - `GET /api/v1/analytics/contributors` — per-contributor breakdown
  - `GET /api/v1/analytics/report/{metricKey}` — full report modal data
  - `GET /api/v1/analytics/export/{metricKey}?format=csv` — CSV export
- ⬜ `AnalyticsService` — @Cacheable with 60-second TTL
- ⬜ `MetricsAggregatorService` — raw SQL aggregation queries
- ⬜ `AnalyticsRepository` — @NativeQuery methods
- ⬜ `CSVExportService`
- ⬜ `AIInteractionLogRepository`

---

### UC-3.1 — Master Calendar & Automated Publishing Backend

- ⬜ Flyway migration — `facebook_page_tokens` (AES-256-GCM encrypted token), `publication_attempts` tables
- ⬜ `CalendarController`:
  - `GET /api/v1/calendar/events` — scheduled submissions as calendar events (role-filtered)
  - `GET /api/v1/calendar/events/{submissionId}` — single event detail
  - `POST /api/v1/calendar/evaluate-slot` — guard rail check for proposed slot
  - `PATCH /api/v1/calendar/events/{submissionId}/reschedule` — admin drag-drop reschedule (requires override reason, re-validates guard rails)
- ⬜ `CalendarService`
- ⬜ `PublishingSchedulerJob` — @Scheduled fixedDelay 60 000 ms; picks up SCHEDULED submissions; Facebook two-step photo publish / single-call video; exponential backoff: 3 attempts at 5s, 25s, 125s; on all fail → PUBLISH_FAILED + T7 notification (GR-T5)
- ⬜ `StaleSubmissionDetectorJob` — @Scheduled fixedDelay 300 000 ms (5 min); detects SCHEDULED submissions where scheduled_at < NOW() - 5 min → PUBLISH_FAILED (GR-T9)
- ⬜ `TokenHealthCheckJob` — @Scheduled daily; validates FB page token; on failure → T13 notification, publishing suspended (GR-T4)
- ⬜ `FacebookPublisherService` — Graph API v25.0 wrapper; two-step photo (upload then publish), single-call video; returns platform_post_id
- ⬜ `TokenEncryptionService` — AES-256-GCM encrypt/decrypt for `facebook_page_tokens`

---

### UC-3.2 — AI Caption Generation Backend

- ⬜ `CaptionController` — `POST /api/v1/ai/caption`; Bucket4j rate-limited (30/hour/user); 3-second debounce on client side
- ⬜ `CaptionGenerationService` — calls Claude Vision API; returns 3 caption variants (Professional / Community / Energetic tones)
- ⬜ `ClaudeVisionClient` — RestTemplate wrapper; Base64-encodes images; 10-second timeout; logs to `ai_interaction_log`

---

### UC-3.3 — AI Classification & Media Recommendation Backend

- ⬜ `ClassificationController` — `POST /api/v1/ai/classify/{assetId}` (internal, called post-upload)
- ⬜ `ClassificationService` — Stage 1: Claude Vision, classifies into 8-category taxonomy (Research, Awards & Recognition, Events, Community Outreach, Partnerships, Youth Programs, Media Coverage, Administrative); stores ai_category + ai_confidence + ai_description
- ⬜ `EmbeddingService` — Stage 2: Voyage AI `voyage-3-lite`; generates VECTOR(1024); stores in `media_assets.embedding`; triggered as ApplicationEvent post-classification
- ⬜ `RecommendationController` — `GET /api/v1/ai/recommendations?query={title}&submissionId={id}`
- ⬜ `RecommendationService` — pgvector cosine similarity (`<=>`), threshold ≤0.35, top 5 results, ≤3 seconds
- ⬜ `VoyageAIClient` — RestTemplate wrapper; returns float[1024]
- ⬜ `EmbeddingReconciliationJob` — @Scheduled fixedDelay 3 600 000 ms (1 hour); retries assets with null embedding but present ai_description (GR-T7)

---

### UC-3.4 — Manual Publishing Fallback Backend

- ⬜ `ManualPublishController`:
  - `POST /api/v1/admin/resolution/failures/{id}/start-workflow` — begin manual fallback (sets manual_publish_started_at)
  - `POST /api/v1/admin/resolution/failures/{id}/mark-published` — record URL + notes, transition to PUBLISHED_MANUAL
  - `DELETE /api/v1/admin/resolution/failures/{id}/cancel-workflow` — cancel in-progress fallback
- ⬜ `ManualPublishService`
- ⬜ `AbandonmentDetectorJob` — @Scheduled fixedDelay 900 000 ms (15 min); transitions timed-out manual fallback workflows (2-hour abandonment timer)

---

### UC-3.5 — Admin Exception Handling Backend

- ⬜ Flyway migration — `override_requests` table
- ⬜ `ExceptionHandlingController` — Resolution Center endpoints (5 tabs):
  - `GET /api/v1/admin/resolution/counts` — badge counts per tab
  - Tab A (API Failures): `GET /api/v1/admin/resolution/failures`, `POST /{id}/retry`
  - Tab B (Validation Timeouts): `GET /api/v1/admin/resolution/timeouts`, `POST /{id}/approve`, `POST /{id}/defer`, `POST /{id}/reject`
  - Tab C (Override Requests): `GET /api/v1/admin/resolution/overrides`, `POST /{id}/approve`, `POST /{id}/suggest`, `POST /{id}/deny`
  - Tab D (Direct Post): `POST /api/v1/admin/resolution/direct-post`
  - Tab E (Token Management): `GET /api/v1/admin/resolution/tokens`, `GET /{institutionId}/oauth-init`, `GET /oauth-callback`
- ⬜ `ValidationTimeoutService`, `OverrideRequestService`, `DirectPostService`, `TokenManagementService`
- ⬜ `OverrideRequestRepository`
- ⬜ `ExpiredOverrideCleanupJob` — cleans up expired (pending, unactioned) override requests

---

### Infrastructure / Housekeeping — Backend

- ⬜ `InvitationTokenExpiryJob` — @Scheduled hourly; marks expired (24-hour TTL) invitation tokens (GR-T8)
- ⬜ Keep-alive for Render free tier — configure UptimeRobot or Render cron ping before pilot (avoids cold-start sleep)
- ⬜ Flyway migration — add `DIRECT_POST_SCHEDULED` and `DIRECT_POST_FAILED` to `submissions.status` CHECK constraint (required for UC-3.5 Tab D; currently missing from DDL)

---

## Frontend

### M3 — Auth & Core UI (Anton)

- ✅ `LoginPage`, `LoginForm`
- ✅ `InvitationAcceptPage`, `ForgotPasswordPage`, `ChangePasswordForm`
- ✅ `AuthContext` (JWT, role, institution_id, session expiry via `useReducer`)
- ✅ `ProtectedRoute` — role-based route enforcement
- ⬜ `SessionWarningBanner` — warns user before 8-hour JWT expiry
- ⬜ `SessionExpiredModal` — shown on 401; prompts re-login

---

### M5 — Content Submission UI (Jay)

- ✅ `SubmissionFormPage` — UI shell at `/submissions/new`; dashboard "Submit Content" button routes here
- ✅ `MediaUploadZone`, `SlotPicker`, `GuardRailStatusPanel` — UI complete, not wired
- ✅ `SubmissionQueue` — UI complete, not wired
- ✅ `AITagPanel`, `CaptionSuggestButton` — UI only
- ✅ `MediaRecommendationPanel` — UI only
- ⬜ Wire `SubmissionFormPage` to all UC-1.3 backend endpoints (when ready)
- ⬜ `OverrideRequestModal` — shown when GR hard rule violated; submits override to admin
- ⬜ `AssetPickerModal` — browse media library from within submission form (A11 alternative flow)

---

### Institution Management UI (unassigned)

- ⬜ Institution management page for Administrator — create institution, view institution list, view institution detail
  > Currently no frontend exists for UC-1.2 admin actions; `InstitutionController` is built and ready.

---

### UC-2.1 — Validation UI

- ⬜ `ValidationQueuePage` — PENDING submissions list sorted by scheduled_at
- ⬜ `SubmissionReviewPanel` — full submission detail view with lock acquisition
- ⬜ `MediaPreviewCarousel` — image/video preview with navigation
- ⬜ `RevisionHistoryBlock` — shows prior revision remarks
- ⬜ `RequestRevisionModal`, `RejectSubmissionModal`
- ⬜ `ValidationDeadlineBanner` — countdown when close to scheduled publish time

---

### UC-2.2 — Media Repository UI

- ⬜ `MediaLibraryPage` — grid/list view of institution media assets
- ⬜ `MediaGrid`, `AssetCard`, `AssetDetailPanel`
- ⬜ `MediaUploadModal` — direct upload to library (not via submission)
- ⬜ `DeleteConfirmationDialog` — three cases: blocked / warning / free
- ⬜ `MediaSearchFilterBar`, `NetworkViewToggle` (admin cross-institution view)

---

### UC-2.3 — Notifications UI

- ⬜ `SSENotificationListener` — opens persistent `EventSource` to `/api/v1/notifications/stream`
- ⬜ `NotificationBell` — badge count in global header
- ⬜ `NotificationPanel`, `NotificationItem`
- ⬜ `NotificationsPage` — full notification history

---

### UC-2.4 — Analytics UI

- ⬜ `AnalyticsDashboardPage`
- ⬜ `TimeRangeSelector` — 7d / 30d / 90d / YTD
- ⬜ `KPITileGrid`, `KPITile` — avg posting delay, content completeness, total posts; 12-week sparklines
- ⬜ `AIPerformancePanel` — caption acceptance rate, tag correction rate (shown at ≥20 events)
- ⬜ `PostsByInstitutionChart` — admin-only bar chart
- ⬜ `OperationalHealthPanel` — admin-only
- ⬜ `ContributorBreakdownTable`
- ⬜ `FullReportModal` — per-tile detail with CSV export

---

### UC-3.1 — Master Calendar UI

- ⬜ `MasterCalendarPage` — FullCalendar.js week/month view, color-coded by submission state
- ⬜ `CalendarEventCard`, `EventDetailPopover`
- ⬜ `RescheduleModal` — admin drag-drop reschedule; mandatory override reason
- ⬜ `CalendarSSEListener` — real-time calendar event updates via SSE

---

### UC-3.2 & UC-3.3 — AI Features UI

- ⬜ `CaptionSuggestionPanel` — shows 3 caption variants; Apply / Edit / Re-generate / Dismiss per variant
- ⬜ `CaptionVariantCard`, `CaptionRateLimitIndicator`
- ⬜ `ClassificationStatusBadge` — shows AI classification result + confidence on asset
- ⬜ `RecommendationAssetCard` — displays recommended media assets

---

### UC-3.4 & UC-3.5 — Resolution Center UI

- ⬜ `ResolutionCenterPage` — 5-tab layout at `/admin/resolution`
- ⬜ Tab A: `PublishFailedTab`, `ManualPublishWorkflowPanel`, `MarkAsPublishedForm`, `WorkflowAbandonmentTimer`
- ⬜ Tab B: `ValidationTimeoutTab`, `RejectOnBehalfModal`
- ⬜ Tab C: `OverrideRequestsTab`, `SlotSuggestionModal`
- ⬜ Tab D: `DirectPostTab`
- ⬜ Tab E: `TokenManagementPanel`
- ⬜ `AbandonmentConfirmationModal`

---

## Flyway Migration Plan

| Version | File | Tables | UC |
|---|---|---|---|
| V1 | `V1__initial_schema.sql` | users, institutions, invitation_tokens, password_reset_tokens, account_lockouts, audit_log, submissions (basic), slot_reservations | UC-1.1, 1.2, 1.3 base |
| V2 | `V2__add_institution_email_domain.sql` | ALTER institutions ADD email_domain | UC-1.2 extension |
| V3 | `V3__submissions_and_media.sql` | submissions (full schema), media_assets (+ VECTOR(1024)), asset_tags, submission_media_assets | UC-1.3, UC-2.2 |
| V4 | `V4__validation_and_notifications.sql` | validation_logs, review_locks, notifications, email_delivery_log, ai_interaction_log | UC-2.1, UC-2.3, UC-2.4 |
| V5 | `V5__publishing_and_ai.sql` | facebook_page_tokens, publication_attempts, override_requests | UC-3.1, UC-3.4, UC-3.5 |
| V6 | `V6__fix_submission_status_check.sql` | ALTER submissions ADD DIRECT_POST_SCHEDULED, DIRECT_POST_FAILED to status CHECK constraint | UC-3.5 fix |

---

## Open Issues / Discrepancies to Resolve

1. **API prefix** — SDD spec uses `/api/` but M2/M4 implementation uses `/api/v1/`. Decision: standardize on **`/api/v1/`** to match existing code. (All SDD references to `/api/` should be read as `/api/v1/`.)
2. **Endpoint naming — create submission** — SDD uses `POST /api/submissions`, todos use `POST /api/v1/submissions/drafts`. Standardize to `POST /api/v1/submissions`.
3. **UC-1.2 admin frontend** — No task assigned for Institution management UI. Needs owner.
4. **Guard Rail config panel** — SRS says GR thresholds are admin-configurable without code changes. No SDD component spec or task exists for this panel. Needs design + backlog entry.
5. **DIRECT_POST_SCHEDULED / DIRECT_POST_FAILED** — UC-3.5 Tab D uses these states but they are missing from the current submissions DDL CHECK constraint. V6 Flyway migration required.
6. **Two "stale" jobs are different** — `StaleDraftSlotReleaseJob` (M4, done, GR-T2: releases draft slots after 7-day inactivity) ≠ `StaleSubmissionDetectorJob` (not built, GR-T9: detects missed publish windows).
7. **Media upload vs. asset attach** — `POST /api/v1/submissions/{id}/media` uploads a new file to a submission. `POST /api/v1/submissions/{id}/assets` attaches an existing library asset. These are two distinct endpoints, not the same.
8. **Render cold-start** — No task for keep-alive before pilot. Add to pre-pilot checklist.

---

## Housekeeping

- ✅ M1 branch merged to `main`
- ✅ M4 branch merged to `main`
- ✅ Docs/handoff PRs #13, #15, #16 merged to `main`
- ✅ Test warning/import cleanup (`AuthControllerTest`, `AuthServiceTest`, `InvitationServiceTest`, `InstitutionServiceTest`)
- ✅ `origin/main` merged into `dev` — 2026-05-20 (20 commits, 0 conflicts)
- ✅ Test compatibility fixes after merge — 124 tests passing on `dev`
- ✅ SDD, SRS, Proposal PDFs added to `docs/pdf/`
- ✅ `docs/` removed from `.gitignore`
- ⬜ Push `main` to `origin/main` (11 commits ahead)
- ⬜ Push `dev` to `origin/dev` (22 commits ahead)
- ⬜ Assign owner for UC-1.2 Institution management frontend
- ⬜ Team decision on API prefix (`/api/` vs `/api/v1/`) — document in CLAUDE.md once decided
