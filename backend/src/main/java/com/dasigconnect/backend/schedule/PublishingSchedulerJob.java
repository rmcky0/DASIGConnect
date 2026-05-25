package com.dasigconnect.backend.schedule;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.dasigconnect.backend.model.entity.MediaAsset;
import com.dasigconnect.backend.model.entity.Submission;
import com.dasigconnect.backend.repository.SubmissionMediaAssetRepository;
import com.dasigconnect.backend.repository.SubmissionRepository;
import com.dasigconnect.backend.service.FacebookPublisherService;

/**
 * GR-T5: Fires every minute. Finds SCHEDULED submissions whose slot falls
 * within the current publish window (now-5min to now) and attempts to publish
 * each one to the DASIG Facebook Page.
 *
 * Transaction boundary: submissions are loaded in one short read transaction,
 * the transaction is closed, then the Facebook API is called outside any
 * transaction to respect the HikariCP 5-connection limit.
 */
@Component
public class PublishingSchedulerJob {

    private static final Logger log = LoggerFactory.getLogger(PublishingSchedulerJob.class);

    private final SubmissionRepository submissionRepository;
    private final SubmissionMediaAssetRepository submissionMediaAssetRepository;
    private final FacebookPublisherService facebookPublisherService;

    public PublishingSchedulerJob(
            SubmissionRepository submissionRepository,
            SubmissionMediaAssetRepository submissionMediaAssetRepository,
            FacebookPublisherService facebookPublisherService) {
        this.submissionRepository = submissionRepository;
        this.submissionMediaAssetRepository = submissionMediaAssetRepository;
        this.facebookPublisherService = facebookPublisherService;
    }

    @Scheduled(cron = "0 * * * * *", zone = "UTC")
    public void run() {
        if (!facebookPublisherService.isConfigured()) return;

        Instant now = Instant.now();
        Instant windowStart = now.minus(5, ChronoUnit.MINUTES);

        List<Submission> due = loadDueSubmissions(windowStart, now);
        if (due.isEmpty()) return;

        log.info("PublishingSchedulerJob: {} submission(s) due for publishing.", due.size());

        for (Submission submission : due) {
            try {
                List<MediaAsset> assets = loadAssets(submission);
                // Call outside transaction — Facebook API must not hold a DB connection
                facebookPublisherService.publish(submission, assets);
            } catch (Exception ex) {
                log.error("Unexpected error publishing submission {}: {}", submission.getId(), ex.getMessage(), ex);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<Submission> loadDueSubmissions(Instant from, Instant to) {
        return submissionRepository.findScheduledInPublishWindow(from, to);
    }

    @Transactional(readOnly = true)
    public List<MediaAsset> loadAssets(Submission submission) {
        return submissionMediaAssetRepository
                .findBySubmissionIdOrderByDisplayOrderAsc(submission.getId())
                .stream()
                .map(sma -> sma.getMediaAsset())
                .toList();
    }
}
