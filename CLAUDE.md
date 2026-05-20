# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DASIGConnect** is a capstone project (Team `2526-sem2-it332-38`, CIT-U) — a web-based Social Media Content Workflow and Scheduling Management System built for the **DOST Acadême–Science and Innovation Group (DASIG)** under DOST Region 7.

It replaces ad hoc email coordination between DASIG member HEIs (CIT-U, Silliman University, others) with a structured, role-based workflow: contributors submit event content → validators review per institution → administrator approves and schedules → system auto-publishes to the DASIG Facebook Page.

See `README.md` for full project context. See `docs/pdf/` for the SDD (94-page), SRS (134-page), and Proposal (12-page). See `TASKS.md` for the full task checklist.

---

## Commands

### Backend (`/backend`)
```bash
# Run locally (loads .env automatically via spring-dotenv)
./mvnw spring-boot:run

# Build JAR (skipping tests)
./mvnw clean package -DskipTests

# Run all tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=BackendApplicationTests

# Add a dependency (edit pom.xml, then)
./mvnw dependency:resolve
```

### Frontend (`/frontend`)
```bash
npm install        # install dependencies
npm run dev        # start Vite dev server (localhost:5173)
npm run build      # TypeScript check + production build
npm run lint       # ESLint
npm run preview    # preview production build
npx shadcn add <component>   # add a new shadcn/ui component
```

---

## Architecture

DASIGConnect is a **three-tier client-server** system:

```
React SPA (Vercel) ──HTTPS/SSE──► Spring Boot REST API (Render) ──► Supabase PostgreSQL + pgvector
                                                                  └──► Supabase Storage (media files)
                                        │
                            ┌───────────┼───────────┐
                     Facebook Graph API  Anthropic Claude  Voyage AI
                       (auto-publish)    (vision/caption)  (embeddings)
```

### Backend — Spring Boot 4.0.6 / Java 21

- **Entry point:** `src/main/java/com/dasigconnect/backend/BackendApplication.java`
- **Config:** `src/main/resources/application.properties` — references `${DATABASE_URL}`, `${DATABASE_USER}`, `${DATABASE_PASSWORD}`
- **`spring-dotenv`** (`me.paulschwarz:spring-dotenv`) auto-loads `backend/.env` at startup — no manual export needed
- Runs on port `8080`; stateless — all session state in JWT (8-hour inactivity timeout)
- **DB migrations:** Flyway (`src/main/resources/db/migration/`)
- **DB access:** Spring Data JPA + Hibernate via HikariCP (max 5 connections — Supabase Session Pooler)
- **Auth:** Spring Security + JWT (`jjwt`) — `JwtAuthenticationFilter` validates every request
- **Multi-tenancy:** `TenantScopeService` enforces institution-level data isolation via `HandlerInterceptor`; backed by PostgreSQL Row-Level Security (RLS)
- **Real-time:** Server-Sent Events (SSE) via Spring `SseEmitter` for in-app notifications and calendar updates
- **Background jobs:** Spring `@Scheduled` for Facebook publishing, validation timeouts, embedding reconciliation, token health checks
- **Rate limiting:** Bucket4j — 5 login attempts / 15 min / IP; 30 AI requests / hour / user; 10 token refreshes / hour / user

> **Critical:** `application.properties` references `${DATABASE_USER}` but `.env` uses `DATABASE_USERNAME`. Keep these in sync or the datasource fails to connect.

### Frontend — React 19 / TypeScript / Vite

- **Entry:** `src/main.tsx` → `src/App.tsx`
- **`@` alias** resolves to `src/` (configured in `vite.config.ts`)
- **UI:** shadcn/ui (Radix UI) + Tailwind CSS v4 (via `@tailwindcss/vite` — no `tailwind.config.js` needed)
- **Routing:** React Router v7 with role-based route protection via `ProtectedRoute`
- **HTTP:** Axios with global JWT interceptors and 401 session expiry handling
- **Calendar:** FullCalendar (daygrid, timegrid, interaction plugins)
- **Real-time:** `EventSource` (SSE) for notification badge and calendar updates
- **State:** React Context API + `useReducer` (JWT, role, institution_id, session expiry)
- **Components:** `src/components/ui/` (shadcn pattern)

### Deployment

| Layer | Platform | Config |
|---|---|---|
| Backend | Render | `backend/render.yaml` — build: `mvn clean package -DskipTests`, start: `java -jar target/backend-0.0.1-SNAPSHOT.jar` |
| Frontend | Vercel | Auto-detect Vite |
| Database | Supabase | PostgreSQL + pgvector extension + Storage |

Render env vars (`DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`) must be set manually in the Render dashboard (`sync: false`).

> **Render free tier:** The backend sleeps after inactivity. Configure UptimeRobot or a Render cron keep-alive before the pilot to prevent cold-start delays.

---

## Domain Model

### User Roles

| Role | Scope | Key Capabilities |
|---|---|---|
| `CONTRIBUTOR` | Per-institution workspace | Submit content, upload media, use AI caption suggestions, use media recommendations |
| `VALIDATOR` | Per-institution | Review submissions before admin escalation; cannot approve own submissions (GR-H5) |
| `ADMINISTRATOR` | Network-wide (DASIG) | Approve/reject/revise, schedule posts, manage institutions, view analytics, exception handling |

### Use Cases (12 total across 3 modules)

| UC | Name | Status |
|---|---|---|
| UC-1.1 | User Provisioning, Onboarding, and Authentication | ✅ Done (BE + FE) |
| UC-1.2 | Institution Onboarding and Workspace Provisioning | 🟡 BE done, FE admin UI not built |
| UC-1.3 | Content Submission and Self-Service Scheduling | 🟡 FE UI shell done; BE not built |
| UC-2.1 | Content Validation and Approval | ⬜ Not started |
| UC-2.2 | Media Repository Management | ⬜ Not started |
| UC-2.3 | System and Submission Notifications | ⬜ Not started |
| UC-2.4 | Analytics Dashboard | ⬜ Not started |
| UC-3.1 | Master Calendar and Automated Publishing | ⬜ Not started |
| UC-3.2 | AI Caption Generation | ⬜ Not started |
| UC-3.3 | AI Image Classification and Media Recommendation | ⬜ Not started |
| UC-3.4 | Manual Publishing Fallback | ⬜ Not started |
| UC-3.5 | Administrator Exception Handling | ⬜ Not started |

### Submission State Machine

```
DRAFT ──submit──► PENDING ──validator approves──► SCHEDULED ──publish job──► PUBLISHED
                     │                                │
                     │         ──validator revises──► NEEDS_REVISION ──re-submit──► PENDING
                     │
                     └──validator rejects──► REJECTED (terminal)
                     
SCHEDULED ──publish fails all 3 retries──► PUBLISH_FAILED ──manual fallback──► PUBLISHED_MANUAL
                                                           └──admin retry──► SCHEDULED

Admin direct post ──► DIRECT_POST_SCHEDULED ──► PUBLISHED / DIRECT_POST_FAILED
```

### Institution Status Machine

```
(new) ──admin creates──► ONBOARDING ──first Validator invited──► ACTIVE
ACTIVE ──all Validators deactivated──► INACTIVE_NO_VALIDATOR
```

### Database Schema (19 tables)

**Module 1 tables (Flyway V1 + V2):**

| Table | Key Columns | Notes |
|---|---|---|
| `institutions` | id, name, code (UNIQUE), email_domain, status (onboarding\|active\|inactive_no_validator) | |
| `users` | id, email (UNIQUE), password_hash, role (contributor\|validator\|administrator), institution_id (NULL for admins), account_state (pending\|pending_email_undelivered\|active\|expired\|inactive) | |
| `invitation_tokens` | id, token_hash, recipient_email, assigned_role, institution_id, expires_at (24h TTL), used_at | |
| `password_reset_tokens` | id, user_id, token_hash, expires_at (1h TTL), used_at | |
| `account_lockouts` | user_id (PK), failed_attempts, locked_until, last_attempt_at | |
| `audit_log` | id, actor_id, action, ip_address, user_agent, resource_id, metadata (JSONB) | Immutable |
| `submissions` | id, contributor_id, institution_id, event_title, event_date, caption, description, status, scheduled_at, submitted_at, published_at, platform_post_id, validator_remarks, rejection_reason, retry_count, manual_publish_started_at, published_manual_url, published_manual_notes | Full schema in V3 |
| `slot_reservations` | id, submission_id, institution_id, scheduled_at, status (held\|locked\|released) | |
| `facebook_page_tokens` | id, institution_id (UNIQUE), encrypted_token (AES-256-GCM), expires_at, last_validated_at | V5 |

**Module 2 tables (Flyway V3 + V4):**

| Table | Key Columns | Notes |
|---|---|---|
| `media_assets` | id, institution_id, uploader_id, asset_code (UNIQUE), storage_url, file_name, file_type (jpeg\|png\|webp\|gif\|mp4\|mov\|webm), file_size_bytes, ai_category, ai_confidence, ai_description, **embedding VECTOR(1024)**, deleted_at | `ivfflat` index on embedding with `vector_cosine_ops` |
| `asset_tags` | id, asset_id, tag, source (ai_generated\|custom); UNIQUE(asset_id, tag) | |
| `submission_media_assets` | id, submission_id, media_asset_id, display_order; UNIQUE(submission_id, media_asset_id) | |
| `validation_logs` | id, submission_id, validator_id, action (approved\|needs_revision\|rejected\|lock_acquired\|lock_released\|lock_expired), remarks, rejection_reason | |
| `review_locks` | id, submission_id (UNIQUE), locked_by, acquired_at, expires_at (30-min expiry) | |
| `notifications` | id, recipient_id, institution_id, trigger_code (T1–T17), category, message, resource_id, resource_url, is_read, email_sent | |
| `email_delivery_log` | id, notification_id, recipient_email, subject, status (pending\|delivered\|failed\|retrying), attempt_count, last_attempted_at | |
| `ai_interaction_log` | id, submission_id, institution_id, interaction_type (caption_suggestion\|tag_classification\|media_recommendation), action_taken, tone_selected | |

**Module 3 tables (Flyway V5):**

| Table | Key Columns | Notes |
|---|---|---|
| `publication_attempts` | id, submission_id, attempt_number (1\|2\|3), outcome (success\|failed\|retrying), error_code, error_message, attempted_at | |
| `override_requests` | id, submission_id, contributor_id, institution_id, requested_slot, violated_rule (GR-H1\|GR-H2\|GR-H3), override_reason, decision (pending\|approved\|denied\|suggested\|expired), decision_reason, suggested_slot, decided_by | |

**RLS policy pattern** (applied to all 10 institution-scoped tables):
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY institution_isolation ON <table>
  USING (
    institution_id = current_setting('app.current_institution_id')::UUID
    OR current_setting('app.current_role') = 'administrator'
  );
```

---

## Guard Rail Rules

**Hard Rules (block slot selection):**

| Rule | Description | Configurable |
|---|---|---|
| GR-H1 | No two posts within ±30 min on shared DASIG page | Yes (default 30 min) |
| GR-H2 | Scheduled time must be ≥2 hours in the future | Yes |
| GR-H3 | Scheduled time must be ≤30 days in the future | Yes |
| GR-H4 | Submission must be SCHEDULED before publishing job picks it up | No |
| GR-H5 | Validator cannot approve their own submission | No |

**Soft Rules (warning only, do not block):**

| Rule | Description | Configurable |
|---|---|---|
| GR-S1 | Max 3 scheduled-but-unpublished posts per institution at any time | Yes |
| GR-S2 | Max 6 scheduled posts per calendar day across all institutions | Yes |

**Trigger Rules (automated system actions):**

| Rule | Description | Job / Interval |
|---|---|---|
| GR-T1 | Validation timeout escalation — 30 min before scheduled_at, PENDING/IN_REVIEW escalated to admin | `ValidationTimeoutDetectorJob` — every 1 min |
| GR-T2 | Stale draft slot release — 7-day inactivity | `StaleDraftSlotReleaseJob` ✅ (M4) — daily |
| GR-T3 | FB token expiry warning — 7 days before expiry → T12 notification | `TokenHealthCheckJob` — daily |
| GR-T4 | Daily FB token health check — on failure → T13, publishing suspended | `TokenHealthCheckJob` — daily |
| GR-T5 | Publishing retry — exponential backoff: 5s, 25s, 125s (3 retries max) | `PublishingSchedulerJob` — every 1 min |
| GR-T6 | High-volume failure consolidation — >5 PUBLISH_FAILED/hour → single alert | `NotificationService` |
| GR-T7 | Embedding reconciliation — hourly retry for NULL-embedding assets with ai_description | `EmbeddingReconciliationJob` — every 1 hour |
| GR-T8 | Invitation token expiry — 24-hour TTL cleanup | `InvitationTokenExpiryJob` — hourly |
| GR-T9 | Missed publish window — SCHEDULED but scheduled_at < NOW() - 5 min → PUBLISH_FAILED | `StaleSubmissionDetectorJob` — every 5 min |

---

## API Endpoints Reference

> **Prefix standard: `/api/v1/`** — all endpoints use this prefix. SDD references to `/api/` should be read as `/api/v1/`.

### Auth (✅ Built — M2)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `PATCH /api/v1/auth/change-password`

### Invitations (✅ Built — M2)
- `POST /api/v1/invitations`
- `GET /api/v1/invitations/validate`
- `POST /api/v1/invitations/accept`
- `POST /api/v1/invitations/{id}/resend` ⬜

### Institutions (✅ Built — M4)
- `POST /api/v1/institutions`
- `GET /api/v1/institutions`
- `GET /api/v1/institutions/{id}`
- `GET /api/v1/institutions/check-code/{code}`
- `GET /api/v1/institutions/summary`

### Users (⬜ Not built)
- `GET /api/v1/me`
- `GET /api/v1/users?institutionId=`

### Submissions (⬜ Not built — UC-1.3)
- `POST /api/v1/submissions`
- `PATCH /api/v1/submissions/{id}`
- `DELETE /api/v1/submissions/{id}`
- `POST /api/v1/submissions/{id}/submit`
- `POST /api/v1/submissions/{id}/evaluate-slot`
- `GET /api/v1/submissions`
- `GET /api/v1/submissions/{id}`
- `GET /api/v1/submissions/lookups`
- `POST /api/v1/submissions/{id}/media`
- `POST /api/v1/submissions/{id}/assets`
- `POST /api/v1/submissions/{id}/override-request`

### Validation (⬜ Not built — UC-2.1)
- `GET /api/v1/validation/queue`
- `GET /api/v1/validation/{submissionId}`
- `POST /api/v1/validation/{submissionId}/lock`
- `DELETE /api/v1/validation/{submissionId}/lock`
- `POST /api/v1/validation/{submissionId}/approve`
- `POST /api/v1/validation/{submissionId}/revise`
- `POST /api/v1/validation/{submissionId}/reject`

### Media (⬜ Not built — UC-2.2)
- `POST /api/v1/media/upload`
- `GET /api/v1/media`
- `GET /api/v1/media/{assetId}`
- `POST /api/v1/media/{assetId}/tags`
- `DELETE /api/v1/media/{assetId}/tags/{tagId}`
- `GET /api/v1/media/{assetId}/deletion-check`
- `DELETE /api/v1/media/{assetId}`

### Notifications (⬜ Not built — UC-2.3)
- `GET /api/v1/notifications/stream` (SSE)
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/mark-all-read`

### Analytics (⬜ Not built — UC-2.4)
- `GET /api/v1/analytics/dashboard`
- `GET /api/v1/analytics/posts-by-institution`
- `GET /api/v1/analytics/contributors`
- `GET /api/v1/analytics/report/{metricKey}`
- `GET /api/v1/analytics/export/{metricKey}?format=csv`

### Calendar (⬜ Not built — UC-3.1)
- `GET /api/v1/calendar/events`
- `GET /api/v1/calendar/events/{submissionId}`
- `POST /api/v1/calendar/evaluate-slot`
- `PATCH /api/v1/calendar/events/{submissionId}/reschedule`

### AI (⬜ Not built — UC-3.2, UC-3.3)
- `POST /api/v1/ai/caption`
- `POST /api/v1/ai/classify/{assetId}`
- `GET /api/v1/ai/recommendations?query={title}&submissionId={id}`

### Resolution Center / Admin (⬜ Not built — UC-3.4, UC-3.5)
- `GET /api/v1/admin/resolution/counts`
- `GET /api/v1/admin/resolution/failures`
- `POST /api/v1/admin/resolution/failures/{id}/start-workflow`
- `POST /api/v1/admin/resolution/failures/{id}/mark-published`
- `DELETE /api/v1/admin/resolution/failures/{id}/cancel-workflow`
- `POST /api/v1/admin/resolution/failures/{id}/retry`
- `GET /api/v1/admin/resolution/timeouts`
- `POST /api/v1/admin/resolution/timeouts/{id}/approve`
- `POST /api/v1/admin/resolution/timeouts/{id}/defer`
- `POST /api/v1/admin/resolution/timeouts/{id}/reject`
- `GET /api/v1/admin/resolution/overrides`
- `POST /api/v1/admin/resolution/overrides/{id}/approve`
- `POST /api/v1/admin/resolution/overrides/{id}/suggest`
- `POST /api/v1/admin/resolution/overrides/{id}/deny`
- `POST /api/v1/admin/resolution/direct-post`
- `GET /api/v1/admin/resolution/tokens`
- `GET /api/v1/admin/resolution/tokens/{institutionId}/oauth-init`
- `GET /api/v1/admin/resolution/tokens/oauth-callback`

---

## External Integrations

| Service | Purpose | Key Details |
|---|---|---|
| **Facebook Graph API v25.0** | Automated post publishing to DASIG Facebook Page | Two-step photo (upload then publish), single-call video. Dev mode during project — posts visible to admins/testers only. No code change needed for Dev→Live (requires DASIG Meta Business Verification). |
| **Anthropic Claude Vision API** | AI caption generation + AI image classification | Caption: 3 variants (Professional/Community/Energetic); 10s timeout; 30/hour/user rate limit. Classification: 8-category taxonomy; ≥80% accuracy target. |
| **Voyage AI (`voyage-3-lite`)** | Vector embeddings for media recommendation | 1024-dim vectors stored via pgvector; cosine similarity `<=>` with threshold ≤0.35; top 5 results; ≤3s target. Videos skipped entirely. |
| **Supabase Storage** | Media file upload and retrieval | Image types: jpeg, png, webp, gif. Video types: mp4, mov, webm. Physical files retained during pilot (no hard delete). |

---

## Development Modules

| Branch | Status | Key Deliverables |
|---|---|---|
| `feature/M1-model-foundation` (Lerah) | ✅ Merged to main | All JPA entities, base repositories, `JWTService`, `AuditLogService`, `EmailService`, `TenantScopeService`, `JwtAuthenticationFilter`, `SecurityConfig`, Flyway V1 |
| `feature/M2-auth-backend` (Chris) | ✅ Merged to main | `AuthController`, `InvitationController`, `PasswordController`, `AuthService`, `AccountLockoutService`, `InvitationService`, `PasswordService`, `GlobalExceptionHandler` |
| `feature/M2-auth-backend-test` (Chris) | ✅ Merged to main | 57 unit + controller tests across M1 & M2 (all passing) |
| `feat/m4-institution-scheduling` (Chim) | ✅ Merged to main | `InstitutionController`, `InstitutionService`, `GuardRailService`, `SlotReservationService`, `WorkspaceProvisionerService`, `StaleDraftSlotReleaseJob` |
| `feat/M3-auth-page` (Anton) | ✅ On dev | `LoginPage`, `InvitationAcceptPage`, `ForgotPasswordPage`, `AuthContext`, `ProtectedRoute` |
| `feat/content-submission` (Jay) | 🔄 On dev | `SubmissionFormPage` UI shell, `MediaUploadZone`, `SlotPicker`, `GuardRailStatusPanel`, `SubmissionQueue` — UI complete, backend not wired |
| `dev` (active integration) | 🔄 In progress | UC-1.2 extension (`emailDomain`, V2 migration); `@ConditionalOnProperty` bean fix; 124 tests passing |
| UC-1.3 Content Submission | ⬜ Not started | `SubmissionController`, `SubmissionService`, Flyway V3 |
| UC-2.x Validation, Media, Notifications, Analytics | ⬜ Not started | All Module 2 components |
| UC-3.x Calendar, Publishing, AI, Exceptions | ⬜ Not started | All Module 3 components |

> See `TASKS.md` for the full detailed checklist.

**Methodology:** Agile / Scrum — 2-week sprints. DB migrations use Flyway (`V1__`, `V2__`, ... naming). `ddl-auto` must be `validate` in production.

---

## Key Design Decisions

- **Stateless JWT auth** — no server-side session; role + institution_id embedded in token claims; 8-hour inactivity timeout
- **Tenant isolation** — enforced at two levels: `TenantScopeService` (HandlerInterceptor sets `app.current_institution_id` PostgreSQL session variable) + PostgreSQL RLS (database); neither alone is sufficient
- **SSE over WebSocket** — real-time notifications use `EventSource` (simpler, HTTP/2 compatible, no upgrade needed)
- **pgvector for media recommendation** — `VECTOR(1024)` columns store Voyage AI embeddings; cosine similarity `<=>` operator; `ivfflat` index; threshold ≤0.35
- **HikariCP max 5 connections** — Supabase Session Pooler hard limit; do not increase without changing Supabase plan
- **Flyway migrations** — `ddl-auto` should be `validate` in prod; migrations live in `src/main/resources/db/migration/`; never edit an already-applied migration file
- **Facebook Dev mode** — API-published posts are invisible to the public until DASIG completes Meta Business Verification; expected behavior, not a bug
- **`BackendApplication` custom beans** — the `flyway` and `dbDiagnostics` `@Bean` methods are gated with `@ConditionalOnProperty(name="spring.flyway.enabled", havingValue="true", matchIfMissing=true)`; setting `spring.flyway.enabled=false` in `src/test/resources/application.properties` skips both beans — required for `@WebMvcTest` and `@SpringBootTest` isolation. Any new Flyway migration added will break Spring context tests without this gate.
- **Facebook token encryption** — AES-256-GCM; `TokenEncryptionService` encrypts before storing in `facebook_page_tokens`; never store raw token
- **Submission upload vs. library attach** — `POST /api/v1/submissions/{id}/media` uploads a new file; `POST /api/v1/submissions/{id}/assets` attaches an existing `media_assets` record. These are different endpoints with different behavior.
- **AI classification skips video** — `ClassificationService` and `EmbeddingService` only run for image assets; video assets have no embedding and no AI tags

---

## Known Issues / Open Decisions

1. **API prefix** — SDD spec uses `/api/` but M2/M4 code uses `/api/v1/`. **Resolution: use `/api/v1/`** to match existing implementation. SDD references to `/api/` should be read as `/api/v1/`.
2. **DIRECT_POST_SCHEDULED / DIRECT_POST_FAILED** — UC-3.5 references these submission states but they are absent from the DDL CHECK constraint. Flyway V6 migration required before implementing UC-3.5 Tab D.
3. **Guard Rail config panel** — SRS specifies that GR thresholds (GR-H1, GR-H2, GR-H3, GR-S1, GR-S2) are configurable by administrators via a UI panel without code changes. No SDD component spec exists for this panel yet. Needs design before implementation.
4. **UC-1.2 admin frontend unassigned** — `InstitutionController` is ready but no React page exists for institution creation/management. Needs an owner.
5. **Render cold-start** — The Render free tier sleeps the backend after inactivity. A keep-alive service (UptimeRobot ping or Render cron) must be configured before the pilot.
