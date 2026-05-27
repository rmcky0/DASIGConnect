# Handoff - 2026-05-28 (Session 5)

## What was done this session

### UC-3.4 Manual Publishing Fallback

- **Backend merged from origin/module3:** local `module3` was fast-forwarded to include PR #46/#47 manual publishing fallback work.
- **Manual publishing service expanded:** `start()` writes `MANUAL_PUBLISH_STARTED`, `cancel()` writes `MANUAL_PUBLISH_CANCELLED`, `clearAbandoned()` writes `MANUAL_PUBLISH_ABANDONED`, and `complete()` audit metadata now includes prior status, scheduled time, and published time.
- **Manual publish eligibility:** manual publish can now load `PUBLISH_FAILED` and `SCHEDULED` submissions.
- **Resolution detail endpoint:** `GET /api/v1/resolution/{id}` returns full manual publish detail through `ManualPublishDetailDto`.
- **Abandonment tracking:** Flyway V19 adds `submissions.last_manual_publish_abandoned_at`; `Submission`, `FailedPublicationDto`, and `ManualPublishDetailDto` expose it.
- **Frontend workflow panel:** `ManualPublishWorkflowPanel.tsx` adds the 3-step manual publish modal with caption copy, media downloads, Facebook page link, live URL/admin notes, validation, and abandonment note UX.
- **Resolution Center wired:** `resolutionApi.ts`, `useResolutionFailures.ts`, `ResolutionCenterScreen.tsx`, and `calendar.css` now support manual publish detail open/close/start/cancel/complete flows.
- **Remote verification:** origin changes include new focused tests for manual publishing, resolution controller, caption controller, and caption generation.

### UC-3.3 AI Media Suggestion / Recommendation

- **Media suggestion backend started:** Added `AIRecommendationController`, `AIRecommendationService`, `VoyageAIClient`, media suggestion DTOs, and `EmbeddingReconciliationJob`.
- **Text-context media suggestions:** `POST /api/v1/ai/submissions/{id}/suggest-media` embeds event title/caption/category/tags with Voyage AI and returns ranked media assets from the institution library using pgvector similarity, excluding assets already attached to the submission.
- **Similar-media backend path:** `GET /api/v1/ai/submissions/{id}/similar-media` finds related library assets from the first attached asset with an embedding.
- **AI interaction logging:** `POST /api/v1/ai/submissions/{id}/log-interaction` records best-effort media recommendation actions.
- **Image classification/embedding support pipeline:** `AIClassificationService` calls Claude Vision for uploaded image classification, persists `ai_category`, `ai_confidence`, `ai_description`, and AI tags, then stores Voyage embeddings. If Claude classification fails, metadata-only embedding still runs from stable asset metadata.
- **Media library search expanded:** `GET /api/v1/media-assets` accepts `query`, `aiCategory`, `mediaType`, pagination, and admin network scope filters.
- **Submit Content media UX rebuilt:** `SubmissionScreen` uses `MediaAssetsPicker` with Upload Files, My Library, and AI Suggestions tabs. The picker has selected-media strip, reorder controls, source badges, reusable media cards/grid, search/filter controls, skeleton/empty/error states, and sticky add-selected bars.
- **AI Suggestions tab:** contributors can generate recommendations from saved draft context, view ranked results with labels and hover/focus match reasons, select multiple assets, and add them into the current submission media order.
- **Embedding model switched:** UC-3.3 uses `voyage-4-lite` with explicit `output_dimension=1024`. V21 restores `media_assets.embedding` to `VECTOR(1024)` and clears incompatible vectors for reconciliation. V20 remains as the earlier 512-dimension correction in Flyway history.
- **Richer asset-profile recommendation:** Claude media classification asks for one broad controlled category, a detailed 2-4 sentence asset description, and 8-15 controlled tags. AI tags are persisted into `asset_tags`, embeddings include upload month, and suggestions also use already-attached media context so "find more like these selected photos" works better for complex events.
- **Lightweight AI provenance:** V22 adds `ai_classified_at`, `ai_classification_model`, `embedding_generated_at`, `embedding_model`, and `asset_tags.source`. User-added tags are `manual`, Claude-generated tags are `ai_generated`, and recommendation ranking weights manual tag matches higher than AI-detected tag matches.
- **AI media pipeline clarified:** the feature is an AI asset enrichment + semantic indexing pipeline. Upload saves base metadata, Claude Vision enriches images, Voyage vectorizes the enriched asset profile into `media_assets.embedding`, pgvector retrieves semantically similar assets when AI Suggestions is clicked, and the backend re-ranks/explains candidates with deterministic signals.
- **AI media suggestion color adjusted:** AI suggestion accents in the media picker use the existing DASIGConnect blue tokens instead of violet.

## Files changed

### Backend

- `backend/src/main/java/com/dasigconnect/backend/controller/AIRecommendationController.java` - UC-3.3 recommendation endpoints.
- `backend/src/main/java/com/dasigconnect/backend/controller/ResolutionController.java` - UC-3.4 detail endpoint from origin.
- `backend/src/main/java/com/dasigconnect/backend/service/AIRecommendationService.java` - recommendation, hybrid ranking, match reasons, and interaction logging.
- `backend/src/main/java/com/dasigconnect/backend/service/AIClassificationService.java` - async Claude classification + Voyage embedding pipeline.
- `backend/src/main/java/com/dasigconnect/backend/service/ManualPublishingService.java` - UC-3.4 audit, eligible status, and abandonment updates from origin.
- `backend/src/main/java/com/dasigconnect/backend/external/VoyageAIClient.java` - Voyage embeddings client using `voyage-4-lite`.
- `backend/src/main/java/com/dasigconnect/backend/external/ClaudeVisionClient.java` - richer image classification prompt and model metadata support.
- `backend/src/main/java/com/dasigconnect/backend/schedule/EmbeddingReconciliationJob.java` - embedding retry/reconciliation job.
- `backend/src/main/java/com/dasigconnect/backend/model/entity/MediaAsset.java` - AI provenance fields.
- `backend/src/main/java/com/dasigconnect/backend/model/entity/AssetTag.java` - tag source tracking.
- `backend/src/main/java/com/dasigconnect/backend/model/entity/Submission.java` - manual publish abandoned timestamp from origin.
- `backend/src/main/java/com/dasigconnect/backend/model/dto/resolution/ManualPublishDetailDto.java` - UC-3.4 detail DTO from origin.
- `backend/src/main/java/com/dasigconnect/backend/model/dto/resolution/FailedPublicationDto.java` - abandonment timestamp from origin.
- `backend/src/main/java/com/dasigconnect/backend/model/dto/ai/` - UC-3.3 AI DTOs.
- `backend/src/main/java/com/dasigconnect/backend/model/dto/media/AssetTagDto.java` - exposes tag source.
- `backend/src/main/java/com/dasigconnect/backend/model/dto/media/MediaAssetDetailDto.java` - exposes AI provenance.
- `backend/src/main/java/com/dasigconnect/backend/repository/MediaAssetRepository.java` - pgvector update/search and provenance writes.
- `backend/src/main/java/com/dasigconnect/backend/repository/AssetTagRepository.java` - tag label/source lookups.
- `backend/src/main/resources/db/migration/V19__submission_manual_publish_abandoned_at.sql` - UC-3.4 abandonment timestamp.
- `backend/src/main/resources/db/migration/V20__media_embedding_512_dimensions.sql` - earlier 512-dimension correction retained for Flyway history compatibility.
- `backend/src/main/resources/db/migration/V21__media_embedding_1024_dimensions.sql` - final migration restoring media embeddings to `VECTOR(1024)`.
- `backend/src/main/resources/db/migration/V22__media_ai_provenance.sql` - media AI provenance and tag source tracking.
- `backend/src/test/java/com/dasigconnect/backend/service/AIRecommendationServiceTest.java` - UC-3.3 focused recommendation tests.

### Frontend

- `frontend/src/features/resolution/ManualPublishWorkflowPanel.tsx` - UC-3.4 3-step workflow panel from origin.
- `frontend/src/features/resolution/ResolutionCenterScreen.tsx` - manual workflow panel wiring from origin.
- `frontend/src/api/resolutionApi.ts` - manual publish detail API from origin.
- `frontend/src/hooks/useResolutionFailures.ts` - detail panel state/actions from origin.
- `frontend/src/styles/calendar.css` - manual workflow styles from origin.
- `frontend/src/features/submission/SubmissionScreen.tsx` - new media picker in Submit Content.
- `frontend/src/components/media/` - reusable media picker/upload/library/AI suggestion/grid/card/strip components.
- `frontend/src/hooks/useAiMediaSuggestions.ts` - user-triggered AI media suggestions hook.
- `frontend/src/hooks/useMediaLibraryAssets.ts` - library search/filter/pagination hook.
- `frontend/src/api/aiApi.ts` - UC-3.3 recommendation API calls and logging helpers.
- `frontend/src/api/mediaApi.ts` - media asset search/filter mappings.
- `frontend/src/types/media.ts` - unified submission media item model.
- `frontend/src/styles/media-picker.css` - media picker UI styles.
- `frontend/src/app/main.tsx` - imports media picker styles.

## What's next

1. **Resolve post-sync verification** - after conflict resolution, run backend tests and frontend build again on the combined origin + AI media work.
2. **UC-3.3 browser E2E** - save a draft with title/caption/category/tags, open Submit Content > Media Assets > AI Suggestions, generate recommendations, add selected assets, save/submit, and verify order/attachments persist.
3. **Recommendation data seeding** - upload or reprocess representative images so media assets have Claude descriptions, tags, provenance, and `voyage-4-lite` embeddings.
4. **UC-3.4 browser test** - run with authenticated admin and test manual publish start, copy/download, Facebook page open, completion URL validation, cancel, retry, and abandonment-note paths.
5. **Category AI suggestion cut** - do not continue the contributor-facing category/tag suggestion UX or `/api/v1/ai/submissions/{id}/suggestions` unless scope changes. Media suggestion is the higher-impact UC-3.3 path.
6. **AI caption browser E2E** - restart backend to activate Java changes, then test instruction and draft-refine paths in Submit Content.
7. **Browser test analytics views** - run contributor, validator, and admin `/analytics` views against live data.

## Blockers / notes

- UC-3.3 requires `VOYAGE_API_KEY` for embeddings and `ANTHROPIC_API_KEY` for image classification.
- Existing media assets without embeddings will not produce semantic recommendations until embedded or reconciled. After backend restart, confirm Flyway applied V21/V22, `media_assets.embedding` reports `vector(1024)`, and new uploads populate AI provenance fields.
- V19 now comes from `origin/module3`; the local untracked V19 was identical and was skipped during stash pop.
- Full-project `npm.cmd run lint` fails due to pre-existing lint debt in older frontend files. Targeted UC-3.3 lint still needs to be run.
- Backend restart is required before testing UC-3.2, UC-3.3, and UC-3.4 Java changes.
- All UC-2.4, UC-3.2, UC-3.3, and UC-3.4 work is on the `module3` branch; not yet merged to `main`.
