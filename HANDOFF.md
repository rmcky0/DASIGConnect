# Handoff - 2026-05-26

Current branch: `module3`

## Status

### UC-3.1 Publishing Pipeline & Master Calendar — COMPLETE

All 19 new files and 3 modified files from the UC-3.1 backend plan have been implemented and verified.

**Database (Flyway V12):**
- `publication_attempts` table — records every Facebook Graph API publish attempt (success/failed, error detail, staged photo IDs for orphan cleanup).
- `facebook_page_tokens` table — encrypted DB-backed token store; no RLS (administrator data only).

**Entities & Repositories:**
- `PublicationAttempt` — JPA entity for attempt records; `@ManyToOne(LAZY)` to `Submission`.
- `FacebookPageToken` — JPA entity for encrypted token; `@PrePersist`/`@PreUpdate` timestamps.
- `PublicationAttemptRepository` — `findTopBySubmissionIdOrderByAttemptedAtDesc`, `countBySubmissionId`.
- `FacebookPageTokenRepository` — `findByPageIdAndIsActiveTrue`.

**Token Security:**
- `TokenEncryptionService` — AES-256-GCM; key = SHA-256(FACEBOOK_APP_SECRET); IV stored as `base64(iv):base64(ciphertext+tag)`. Token is never logged.

**Calendar API:**
- `CalendarEventDto` — dual factory methods: `full()` for own institution / admin, `masked()` for other institutions (title is null).
- `CalendarService` — `getCalendarEvents(JwtUserDetails)` switches on role: admin gets all slots full, contributors/validators get own institution full + others masked.
- `CalendarController`:
  - `GET /api/v1/calendar` — authenticated, returns scheduled slots.
  - `PATCH /api/v1/submissions/{id}/reschedule` — admin only; validates guard rails, supports override with audit trail.
- `RescheduleRequestDto` — `scheduledAt` (required) + `overrideReason` (required only when hard guard rail violated).
- `SubmissionService.reschedule()` — guard rail check → hard violation without override → 422; hard violation with override → audit log ADMIN_RESCHEDULE_OVERRIDE → proceed.
- `SlotReservationService.reserveLockedSlot()` — creates a locked reservation directly for admin reschedule.

**Facebook Publishing:**
- `FacebookPublisherService` — Java HttpClient (mirrors `SupabaseStorageService`). `@PostConstruct` syncs env token to DB if no active token exists. Handles:
  - Photo-only: 2-step (stage unpublished → feed post with `attached_media`). Cleanup of staged photos on step-2 failure.
  - Video-only: single POST to `/{PAGE_ID}/videos`.
  - Mixed media: immediate PUBLISH_FAILED (pilot constraint).
  - GR-T5 retry: 3 attempts, backoff 5s → 25s → 125s via `Thread.sleep()`.
  - `recordAttempt()` — `@Transactional`, writes `PublicationAttempt` after each attempt.
  - `markPublished()` / `markFailed()` — `@Transactional`, state transitions + events.
  - `validateToken()` — calls Graph API `debug_token`; updates `last_validated_at` in DB; returns `Instant` or null.
  - **CRITICAL**: `publish()` is called outside any active DB transaction by the scheduler (HikariCP 5-connection constraint).

**Scheduler Jobs:**
- `PublishingSchedulerJob` — `@Scheduled(cron = "0 * * * * *")`, every minute. Loads due submissions in a short read transaction, then calls `facebookPublisherService.publish()` outside transaction.
- `StaleSubmissionDetectorJob` — `@Scheduled(cron = "0 */5 * * * *")`, every 5 min. GR-T9: finds SCHEDULED submissions with missed windows → PUBLISH_FAILED + `PublishFailedEvent`.
- `TokenHealthCheckJob` — `@Scheduled(cron = "0 0 8 * * *")`, daily 08:00 UTC. GR-T4: invalid token → `TokenValidationFailedEvent`; expiry ≤7 days → `TokenExpiryWarningEvent`.

**Resolution Center (UC-3.4):**
- `FailedPublicationDto` — response DTO (submissionId, eventTitle, institutionId/Name, scheduledAt, retryCount, lastAttemptAt, lastError, manualPublishInProgress).
- `ManualPublishCompleteDto` — request DTO (optional postUrl must match `https://www.facebook.com/*`, optional notes).
- `ManualPublishingService` — start/complete/cancel/retry/clearAbandoned; audit log written on complete via `AuditLogService`.
- `ResolutionController` — `@PreAuthorize("hasRole('ADMINISTRATOR')")`, base path `/api/v1/resolution`:
  - `GET /failures` — lists PUBLISH_FAILED submissions with last attempt detail.
  - `POST /{id}/retry` — PUBLISH_FAILED → SCHEDULED, resets retryCount.
  - `POST /{id}/manual-publish/start` — records `manualPublishStartedAt`.
  - `POST /{id}/manual-publish/complete` — transitions → PUBLISHED_MANUAL, fires `PostPublishedManualEvent`.
  - `POST /{id}/manual-publish/cancel` — clears `manualPublishStartedAt`.
- `AbandonmentDetectorJob` — `@Scheduled(cron = "0 */5 * * * *")`, every 5 min; clears sessions open >2 hours.

**Config:**
- `application.properties` — `app.facebook.*` properties added (`page-access-token`, `page-id`, `app-id`, `app-secret`, `api-version`), each backed by env vars with empty-string defaults for graceful degradation.

### Previous Session (UC-1.3) — still on `feature/uc13-submission-backend`, not yet merged

See prior HANDOFF.md content for UC-1.3 details. That branch is still pending merge/review.

## Verification

- Backend: `mvn test` → **208 tests, 0 failures, 0 errors** (all 163 prior tests pass + UC-3.1 additions).
- Maven used: direct from `.m2/wrapper/dists/apache-maven-3.9.15/9925cc1d/bin/mvn` (mvnw.cmd fails in this PS environment).

## Remaining Gaps

- **UC-3.1 frontend**: Calendar page (FullCalendar.js + `GET /api/v1/calendar`) and Resolution Center page (`/api/v1/resolution` endpoints) are not yet implemented. The backend is ready.
- **Live Facebook publish test**: The app is in Facebook Development mode during the pilot — posts are only visible to Meta developer/admin accounts. Full end-to-end test requires valid `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` in the environment.
- **V12 migration on Supabase**: `V12__publishing.sql` has not yet been applied to the deployed Supabase instance (no RLS policies needed for these tables — they are admin-only).
- **UC-1.3 merge**: `feature/uc13-submission-backend` is still pending team review and merge into `main`.
- **UC-2.x**: Content validation (2.1), media repository (2.2), SSE notifications (2.3), and analytics (2.4) not started.
- **UC-3.2/3.3**: AI caption (Claude Vision) and AI classification/recommendation (Voyage AI) not started.
- Active Module 1 blocker: save draft / submit-for-review browser flow still needs manual verification.

## Critical Invariants

- **Never log** the page access token, app secret, or any encrypted token value.
- HikariCP max pool size = 5 (Supabase Session Pooler hard limit). Always commit the read transaction before calling the Facebook Graph API.
- Do NOT call `SlotReservationService.confirm()` in the publishing flow — it is already called by `ValidationService` on approval.
- Mixed media (photo + video in same submission) → immediate PUBLISH_FAILED per SRS pilot constraint.
- All publish state transitions must write to `audit_log` via `AuditLogService`.
- `MediaAsset.embedding` is not mapped by Hibernate. Keep pgvector reads/writes in native repository queries.
- For fresh Supabase projects, keep Flyway baseline version at `0`.
- Do not log JWTs, reset tokens, invitation tokens, passwords, or API keys.
