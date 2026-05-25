package com.dasigconnect.backend.service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.dasigconnect.backend.event.PostPublishedManualEvent;
import com.dasigconnect.backend.exception.SubmissionNotFoundException;
import com.dasigconnect.backend.model.dto.resolution.ManualPublishCompleteDto;
import com.dasigconnect.backend.model.entity.Submission;
import com.dasigconnect.backend.model.entity.SubmissionStatus;
import com.dasigconnect.backend.model.entity.User;
import com.dasigconnect.backend.repository.SubmissionRepository;
import com.dasigconnect.backend.security.JwtUserDetails;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * Manages the UC-3.4 manual publishing fallback workflow.
 *
 * Flow: Admin clicks "Publish Manually" → start() → Admin publishes on Facebook → complete()
 * Abandonment: AbandonmentDetectorJob calls clearAbandoned() for sessions open > 2 hours.
 */
@Service
@Transactional
public class ManualPublishingService {

    private static final Logger log = LoggerFactory.getLogger(ManualPublishingService.class);
    private static final String FACEBOOK_URL_PREFIX = "https://www.facebook.com/";

    private final SubmissionRepository submissionRepository;
    private final AuditLogService auditLogService;
    private final ApplicationEventPublisher eventPublisher;

    @PersistenceContext
    private EntityManager entityManager;

    public ManualPublishingService(
            SubmissionRepository submissionRepository,
            AuditLogService auditLogService,
            ApplicationEventPublisher eventPublisher) {
        this.submissionRepository = submissionRepository;
        this.auditLogService = auditLogService;
        this.eventPublisher = eventPublisher;
    }

    public void start(UUID submissionId, JwtUserDetails admin) {
        Submission s = loadPublishFailed(submissionId);
        s.setManualPublishStartedAt(Instant.now());
        submissionRepository.save(s);
        log.info("Admin {} started manual publish for submission {}.", admin.userId(), submissionId);
    }

    public void complete(UUID submissionId, ManualPublishCompleteDto dto, JwtUserDetails admin) {
        Submission s = loadPublishFailed(submissionId);

        if (s.getManualPublishStartedAt() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Manual publish session not started. Call /start first.");
        }

        if (dto.getPostUrl() != null && !dto.getPostUrl().isBlank()) {
            if (!dto.getPostUrl().startsWith(FACEBOOK_URL_PREFIX)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Post URL must start with " + FACEBOOK_URL_PREFIX);
            }
        }

        s.setStatus(SubmissionStatus.published_manual);
        s.setPublishedAt(Instant.now());
        s.setPublishedManualUrl(dto.getPostUrl());
        s.setPublishedManualNotes(dto.getNotes());
        s.setManualPublishStartedAt(null);
        submissionRepository.save(s);

        auditLogService.record(
                entityManager.getReference(User.class, admin.userId()),
                "MANUAL_PUBLISH_COMPLETE",
                null, null,
                submissionId,
                Map.of(
                    "postUrl", dto.getPostUrl() != null ? dto.getPostUrl() : "",
                    "notes", dto.getNotes() != null ? dto.getNotes() : ""
                )
        );

        eventPublisher.publishEvent(new PostPublishedManualEvent(s, dto.getPostUrl()));
        log.info("Admin {} completed manual publish for submission {}.", admin.userId(), submissionId);
    }

    public void cancel(UUID submissionId, JwtUserDetails admin) {
        Submission s = loadPublishFailed(submissionId);
        s.setManualPublishStartedAt(null);
        submissionRepository.save(s);
        log.info("Admin {} cancelled manual publish for submission {}.", admin.userId(), submissionId);
    }

    public void retry(UUID submissionId, JwtUserDetails admin) {
        Submission s = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));
        if (s.getStatus() != SubmissionStatus.publish_failed) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only PUBLISH_FAILED submissions can be retried.");
        }
        s.setStatus(SubmissionStatus.scheduled);
        s.setRetryCount(0);
        s.setManualPublishStartedAt(null);
        submissionRepository.save(s);
        log.info("Admin {} queued retry for submission {}.", admin.userId(), submissionId);
    }

    /** Called by AbandonmentDetectorJob — clears sessions open longer than 2 hours. */
    public void clearAbandoned(Submission s) {
        s.setManualPublishStartedAt(null);
        submissionRepository.save(s);
        log.warn("Cleared abandoned manual publish session for submission {}.", s.getId());
    }

    private Submission loadPublishFailed(UUID submissionId) {
        Submission s = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));
        if (s.getStatus() != SubmissionStatus.publish_failed) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only PUBLISH_FAILED submissions can be manually published.");
        }
        return s;
    }
}
