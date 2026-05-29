package com.dasigconnect.backend.controller;

import com.dasigconnect.backend.model.dto.media.BulkMoveRequestDto;
import com.dasigconnect.backend.model.dto.media.BulkOperationResponseDto;
import com.dasigconnect.backend.model.dto.media.BulkTagRequestDto;
import com.dasigconnect.backend.security.JwtUserDetails;
import com.dasigconnect.backend.service.MediaOrganizationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bulk organization endpoints for UC-4.1. Base path: /api/v1/media-assets.
 * (Bulk delete lives on {@link MediaAssetController}; move/tag are here.)
 */
@RestController
@RequestMapping("/api/v1/media-assets")
public class MediaOrganizationController {

    private final MediaOrganizationService mediaOrganizationService;

    public MediaOrganizationController(MediaOrganizationService mediaOrganizationService) {
        this.mediaOrganizationService = mediaOrganizationService;
    }

    @PostMapping("/bulk-move")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BulkOperationResponseDto> bulkMove(
            @Valid @RequestBody BulkMoveRequestDto dto,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mediaOrganizationService.bulkMove(dto, user));
    }

    @PostMapping("/bulk-tag")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BulkOperationResponseDto> bulkTag(
            @Valid @RequestBody BulkTagRequestDto dto,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mediaOrganizationService.bulkTag(dto, user));
    }
}
