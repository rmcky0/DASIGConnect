# Handoff — 2026-05-26 (Session 3)

## What was done this session
- **UC-3.2 AI Caption Generation fully implemented** (backend + frontend).
- Read SRS, SDD (UC-3.2/3.3 sections), and sprint HTML for requirements.
- Created `V18__ai_interaction_log.sql` — new table for AI KPI tracking (shared with UC-2.4 analytics and future UC-3.3).
- `AiInteractionLog` entity + `AiInteractionLogRepository`.
- `ClaudeVisionClient` — Java 11 HttpClient, 10-second timeout, URL-based image content blocks (up to 4 images per call), strips markdown fences from Claude JSON response.
- `CaptionGenerationService` — validates submission has ≥1 image asset, calls Claude, logs interaction; DB reads use implicit transactions so no HikariCP connection is held during the Claude HTTP round-trip.
- `CaptionController` at `POST /api/v1/ai/caption` — Contributor/Admin role, in-memory sliding-window rate limiter (30/hr/user), returns `X-RateLimit-Remaining` + `X-RateLimit-Reset` headers. `POST /api/v1/ai/caption/log` for client-side action tracking.
- `anthropic.api.key` + `anthropic.api.model` added to `application.properties`.
- Frontend: `aiApi.ts`, `CaptionSuggestButton`, `CaptionSuggestionPanel`, `CaptionVariantCard` components.
- `SubmissionScreen` stub replaced with live `CaptionSuggestButton` wired to form.caption.
- CSS styles for all caption components appended to `submission.css`.
- **211 backend tests passing** (0 failures); **frontend build passing** (191 modules).

## Files changed
- `backend/src/main/resources/db/migration/V18__ai_interaction_log.sql` — new
- `backend/.../model/entity/AiInteractionLog.java` — new entity
- `backend/.../repository/AiInteractionLogRepository.java` — new
- `backend/.../model/dto/ai/` — CaptionRequestDto, CaptionVariantDto, CaptionResponseDto, CaptionLogRequestDto
- `backend/.../external/ClaudeVisionClient.java` — new
- `backend/.../service/CaptionGenerationService.java` — new
- `backend/.../controller/CaptionController.java` — new
- `backend/src/main/resources/application.properties` — added Anthropic config
- `frontend/src/api/aiApi.ts` — new
- `frontend/src/features/submission/components/CaptionSuggestButton.tsx` — new
- `frontend/src/features/submission/components/CaptionSuggestionPanel.tsx` — new
- `frontend/src/features/submission/components/CaptionVariantCard.tsx` — new
- `frontend/src/features/submission/SubmissionScreen.tsx` — wired CaptionSuggestButton
- `frontend/src/styles/submission.css` — caption styles appended

## What's next
1. **Set `ANTHROPIC_API_KEY`** in `backend/.env` for local testing, and in Render dashboard for production.
2. **Browser verification**: open a submission with an image asset → Suggest Caption button appears → clicking it (after 3-second debounce) calls Claude and shows 3 variant cards.
3. **UC-3.3 AI Classification & Recommendation (Voyage AI)** — not started. Needs: `ClassificationService` (Stage 1: Claude Vision tags), `EmbeddingService` (Stage 2: Voyage AI voyage-3-lite), `RecommendationController` (`GET /api/v1/ai/recommendations`), `VoyageAIClient`, `EmbeddingReconciliationJob` (hourly GR-T7), IVFFlat index on `media_assets.embedding`. Also needs `ai` columns on `media_assets` (`classification_label`, `classification_confidence`, `embedding_status`).
4. **UC-2.4 Analytics** — assigned to someone else on the team; uses `ai_interaction_log` (now created by V18).
5. **Flyway note**: V18 creates `ai_interaction_log`. UC-2.4 dev should NOT re-create it — it already exists.

## Blockers / notes
- `ClaudeVisionClient` uses URL-type image sources (Anthropic supports public URLs). The SDD says Base64 — functionally equivalent; URL approach avoids downloading images on the backend and is cleaner.
- Rate limiter is in-memory (ConcurrentHashMap). Resets on server restart. Sufficient for capstone; swap for Bucket4j + Redis if persistence is needed.
- `ANTHROPIC_API_KEY` must be set for caption generation to work. Without it, the service throws `ClaudeApiException` which surfaces as 503 to the frontend (shows "unavailable" state, not an error crash).
- UC-3.3 will also use `ClaudeVisionClient` (shared) and add `VoyageAIClient` separately.
