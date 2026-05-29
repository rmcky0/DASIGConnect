package com.dasigconnect.backend.config;

import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Bounded executor for media enrichment (UC-4.2, ADR-0002). Deliberately small: with
 * HikariCP capped at 5, background enrichment workers must not starve request threads.
 * This replaces the previous fire-and-forget {@code @Async} path so a 200-asset dump
 * drains at a controlled rate instead of spawning ~600 simultaneous external calls.
 *
 * <p>Core = max = 2 workers (the concurrency cap on Claude/Voyage calls); a bounded queue
 * holds the backlog; {@link ThreadPoolExecutor.CallerRunsPolicy} provides backpressure if
 * the queue fills (the submitting thread runs the task rather than dropping it).
 */
@Configuration
public class IngestionExecutorConfig {

    public static final String INGESTION_EXECUTOR = "mediaIngestionExecutor";

    @Bean(name = INGESTION_EXECUTOR)
    public ThreadPoolTaskExecutor mediaIngestionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("media-ingest-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
