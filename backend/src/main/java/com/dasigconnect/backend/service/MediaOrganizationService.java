package com.dasigconnect.backend.service;

import com.dasigconnect.backend.model.dto.media.BulkMoveRequestDto;
import com.dasigconnect.backend.model.dto.media.BulkOperationResponseDto;
import com.dasigconnect.backend.model.dto.media.BulkTagRequestDto;
import com.dasigconnect.backend.model.entity.AssetTag;
import com.dasigconnect.backend.model.entity.MediaAsset;
import com.dasigconnect.backend.model.entity.User;
import com.dasigconnect.backend.repository.AssetTagRepository;
import com.dasigconnect.backend.repository.MediaAssetRepository;
import com.dasigconnect.backend.repository.MediaFolderRepository;
import com.dasigconnect.backend.repository.UserRepository;
import com.dasigconnect.backend.security.JwtUserDetails;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * UC-4.1: bulk organization operations on media assets — move/unfile into folders and
 * bulk tagging. Institution-scoped and audited. Bulk delete already lives in
 * {@link MediaAssetService}; this service covers move and tag so the large asset service
 * is not destabilized.
 */
@Service
public class MediaOrganizationService {

    private final MediaAssetRepository mediaAssetRepository;
    private final MediaFolderRepository folderRepository;
    private final AssetTagRepository assetTagRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public MediaOrganizationService(MediaAssetRepository mediaAssetRepository,
                                    MediaFolderRepository folderRepository,
                                    AssetTagRepository assetTagRepository,
                                    UserRepository userRepository,
                                    AuditLogService auditLogService) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.folderRepository = folderRepository;
        this.assetTagRepository = assetTagRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Bulk-assigns assets to a folder, or unfiles them when folderId is null. The update is
     * institution-guarded in SQL, so assets from other tenants are never touched.
     */
    @Transactional
    public BulkOperationResponseDto bulkMove(BulkMoveRequestDto dto, JwtUserDetails user) {
        UUID institutionId = requireInstitution(user);
        User actor = loadActor(user);

        int affected;
        if (dto.getFolderId() == null) {
            affected = mediaAssetRepository.unfileAssets(dto.getAssetIds(), institutionId);
        } else {
            // Verify the target folder belongs to this institution before moving into it.
            folderRepository.findByIdAndInstitution(dto.getFolderId(), institutionId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found."));
            affected = mediaAssetRepository.assignToFolder(dto.getAssetIds(), dto.getFolderId(), institutionId);
        }

        auditLogService.record(actor, "ASSETS_MOVED", null, null, dto.getFolderId(),
                Map.of("folderId", String.valueOf(dto.getFolderId()),
                       "requested", String.valueOf(dto.getAssetIds().size()),
                       "affected", String.valueOf(affected)));
        return new BulkOperationResponseDto(affected);
    }

    /**
     * Bulk-adds a single manual tag to the given assets (those in the caller's institution),
     * skipping assets that already carry the tag.
     */
    @Transactional
    public BulkOperationResponseDto bulkTag(BulkTagRequestDto dto, JwtUserDetails user) {
        UUID institutionId = requireInstitution(user);
        User actor = loadActor(user);
        String label = dto.getLabel().trim();

        int tagged = 0;
        for (MediaAsset asset : mediaAssetRepository.findActiveByIds(dto.getAssetIds())) {
            if (!asset.getInstitution().getId().equals(institutionId)) {
                continue; // never tag cross-tenant assets
            }
            if (assetTagRepository.existsByMediaAssetIdAndLabel(asset.getId(), label)) {
                continue; // idempotent
            }
            AssetTag tag = new AssetTag();
            tag.setMediaAsset(asset);
            tag.setLabel(label);
            tag.setSource("manual");
            assetTagRepository.save(tag);
            tagged++;
        }

        auditLogService.record(actor, "ASSETS_TAGGED", null, null, null,
                Map.of("label", label,
                       "requested", String.valueOf(dto.getAssetIds().size()),
                       "tagged", String.valueOf(tagged)));
        return new BulkOperationResponseDto(tagged);
    }

    private UUID requireInstitution(JwtUserDetails user) {
        if (user.institutionId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bulk operations require an institution-scoped user.");
        }
        return user.institutionId();
    }

    private User loadActor(JwtUserDetails user) {
        return userRepository.findById(user.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Authenticated user not found."));
    }
}
