# Handoff - 2026-05-26

Current branch: `module3`

## What Was Done This Session

### 1. Submit-for-Review 500 Bug — FIXED

**Root cause chain:**
1. `SubmissionService.submit()` called `notificationService.createNotification()` directly inside the main `@Transactional` method (T1 — notify validators). The `notifications` table did not exist in the Supabase DB, so the INSERT failed and rolled back the entire transaction including the PENDING status change. HTTP response: 500.
2. `BackendApplication.flyway()` bean called `.load()` but never `.migrate()` — no migrations beyond V5 + V10 were ever applied to the DB.
3. The DB had a mixed Flyway history: V10 was recorded with checksum 0 (manually baselined at an unknown earlier point), while V6–V9 existed locally but were never applied.

**Fixes applied:**
- `SubmissionService.submit()` — T1 notification block wrapped in try-catch. Submission always reaches PENDING; a notification failure is logged as a warning instead of rolling back.
- `BackendApplication.flyway()` — added `flyway.repair()` then `flyway.migrate()` calls. The bean now explicitly runs migrations on every startup.
- `GlobalExceptionHandler` — added `SlotAlreadyTakenException` handler returning 409 Conflict (was falling through to catch-all 500).

### 2. Flyway Migration History Repair — COMPLETE

**Problem:** Supabase DB had V1–V5 and V10 applied (V10 with checksum 0). V6–V9 existed locally as files but were never applied to the DB. Flyway refused to start due to `FlywayValidateException` (checksum mismatch + out-of-order detections).

**Fix — Option A (no outOfOrder, no validateOnMigrate bypass):**
- Deleted V6, V7, V8, V9 migration files from the codebase.
- Recreated their content as new linear versions:
  - `V14__notifications.sql` (was V6)
  - `V15__email_delivery_log.sql` (was V7)
  - `V16__media_search_indexes.sql` (was V8)
  - `V17__asset_tags.sql` (was V9) — **rewritten** (see below)
- `BackendApplication.flyway()` calls `repair()` before `migrate()` to fix the V10 stored checksum.

**V17 asset_tags rewrite:** V4 had already created `asset_tags` with columns `(asset_id, tag, source)`. The `AssetTag` entity maps to `(media_asset_id, label)` — incompatible schemas. V17 now does `DROP TABLE IF EXISTS asset_tags CASCADE` then `CREATE TABLE asset_tags (id, media_asset_id, label, created_at)` with the correct RLS policy.

**Current migration state after this session:**
- Applied: V1–V5, V10, V11, V12, V13, V14, V15, V16, V17
- All tables exist: `notifications`, `email_delivery_log`, `asset_tags` (correct schema), `publication_attempts`, `facebook_page_tokens`, `validation_logs`, `review_locks`

### 3. Live Facebook Publish — VERIFIED

A photo post was published to the DasigConnect Facebook Page from a scheduled submission. The full pipeline (submit → PENDING → [validation skipped in dev] → SCHEDULED → `PublishingSchedulerJob` → Graph API) confirmed working in Development mode.

## Current State

- **Branch:** `module3` — not yet merged to `main`
- **Backend tests:** 208 passing (no regressions)
- **Submit flow:** working end-to-end in the browser
- **Facebook publish:** confirmed working

## Remaining Gaps

- **UC-3.1 frontend:** Calendar page (FullCalendar.js + `GET /api/v1/calendar`) and Resolution Center page (`/api/v1/resolution` endpoints) not yet implemented.
- **UC-2.x:** Content validation (2.1), media repository (2.2), SSE notifications (2.3), analytics (2.4) — not started.
- **UC-3.2 / 3.3:** AI caption (Claude Vision) and AI classification/recommendation (Voyage AI) — not started.
- Submission lookups do not return categories, tags, or preferred time slots.
- Media library / asset picker needs UC-2.2 backend.
- No built-in validator account. Use the admin dashboard to invite validators.
- `feature/uc13-submission-backend` still pending team review and merge into `main`.

## Critical Invariants

- **Never log** the page access token, app secret, or any encrypted token value.
- HikariCP max pool size = 5 (Supabase Session Pooler hard limit). Always commit the read transaction before calling the Facebook Graph API.
- Do NOT call `SlotReservationService.confirm()` in the publishing flow — already called by `ValidationService` on approval.
- Mixed media (photo + video) → immediate PUBLISH_FAILED per SRS pilot constraint.
- All publish state transitions must write to `audit_log` via `AuditLogService`.
- `BackendApplication.flyway()` calls `repair()` + `migrate()`. Never add `outOfOrder=true` or `validateOnMigrate=false` — fix history issues by renumbering migration files.
- V4 creates `asset_tags(asset_id, tag, source)`. V17 drops and recreates it. Do not revert V17.
- T1 notifications in `SubmissionService.submit()` are wrapped in try-catch by design — do not remove this guard.
