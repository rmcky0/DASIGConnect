package com.dasigconnect.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dasigconnect.backend.model.dto.media.BulkMoveRequestDto;
import com.dasigconnect.backend.model.dto.media.BulkOperationResponseDto;
import com.dasigconnect.backend.model.dto.media.BulkTagRequestDto;
import com.dasigconnect.backend.model.entity.AssetTag;
import com.dasigconnect.backend.model.entity.Institution;
import com.dasigconnect.backend.model.entity.MediaAsset;
import com.dasigconnect.backend.model.entity.MediaFolder;
import com.dasigconnect.backend.model.entity.User;
import com.dasigconnect.backend.repository.AssetTagRepository;
import com.dasigconnect.backend.repository.MediaAssetRepository;
import com.dasigconnect.backend.repository.MediaFolderRepository;
import com.dasigconnect.backend.repository.UserRepository;
import com.dasigconnect.backend.security.JwtUserDetails;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class MediaOrganizationServiceTest {

    @Mock private MediaAssetRepository mediaAssetRepository;
    @Mock private MediaFolderRepository folderRepository;
    @Mock private AssetTagRepository assetTagRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;

    private MediaOrganizationService service;

    private final UUID institutionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private JwtUserDetails user;
    private User actor;

    @BeforeEach
    void setUp() {
        service = new MediaOrganizationService(mediaAssetRepository, folderRepository,
                assetTagRepository, userRepository, auditLogService);
        user = new JwtUserDetails(userId, "c@x.edu", "CONTRIBUTOR", institutionId);
        actor = mock(User.class);
    }

    private MediaAsset assetIn(UUID instId) {
        Institution inst = mock(Institution.class);
        when(inst.getId()).thenReturn(instId);
        MediaAsset a = new MediaAsset();
        a.setId(UUID.randomUUID());
        a.setInstitution(inst);
        return a;
    }

    private int statusOf(ResponseStatusException ex) {
        return ex.getStatusCode().value();
    }

    @Test
    void bulkMove_adminWithoutInstitution_returns400() {
        JwtUserDetails admin = new JwtUserDetails(userId, "a@x.edu", "ADMINISTRATOR", null);
        BulkMoveRequestDto dto = new BulkMoveRequestDto();
        dto.setAssetIds(List.of(UUID.randomUUID()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.bulkMove(dto, admin));
        assertEquals(400, statusOf(ex));
    }

    @Test
    void bulkMove_toFolder_validatesFolderAndUpdates() {
        UUID folderId = UUID.randomUUID();
        List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(userRepository.findById(userId)).thenReturn(Optional.of(actor));
        when(folderRepository.findByIdAndInstitution(folderId, institutionId))
                .thenReturn(Optional.of(new MediaFolder()));
        when(mediaAssetRepository.assignToFolder(ids, folderId, institutionId)).thenReturn(3);

        BulkMoveRequestDto dto = new BulkMoveRequestDto();
        dto.setAssetIds(ids);
        dto.setFolderId(folderId);

        BulkOperationResponseDto result = service.bulkMove(dto, user);

        assertEquals(3, result.affected());
        verify(auditLogService).record(eq(actor), eq("ASSETS_MOVED"), any(), any(), eq(folderId), any());
    }

    @Test
    void bulkMove_missingFolder_returns404() {
        UUID folderId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(actor));
        when(folderRepository.findByIdAndInstitution(folderId, institutionId)).thenReturn(Optional.empty());

        BulkMoveRequestDto dto = new BulkMoveRequestDto();
        dto.setAssetIds(List.of(UUID.randomUUID()));
        dto.setFolderId(folderId);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.bulkMove(dto, user));
        assertEquals(404, statusOf(ex));
        verify(mediaAssetRepository, never()).assignToFolder(anyList(), any(), any());
    }

    @Test
    void bulkMove_nullFolder_unfiles() {
        List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID());
        when(userRepository.findById(userId)).thenReturn(Optional.of(actor));
        when(mediaAssetRepository.unfileAssets(ids, institutionId)).thenReturn(2);

        BulkMoveRequestDto dto = new BulkMoveRequestDto();
        dto.setAssetIds(ids);
        dto.setFolderId(null);

        BulkOperationResponseDto result = service.bulkMove(dto, user);

        assertEquals(2, result.affected());
        verify(mediaAssetRepository, never()).assignToFolder(anyList(), any(), any());
    }

    @Test
    void bulkTag_tagsInstitutionAssetsSkippingDuplicatesAndCrossTenant() {
        MediaAsset mine = assetIn(institutionId);
        MediaAsset foreign = assetIn(UUID.randomUUID());
        when(userRepository.findById(userId)).thenReturn(Optional.of(actor));
        when(mediaAssetRepository.findActiveByIds(anyList())).thenReturn(List.of(mine, foreign));
        when(assetTagRepository.existsByMediaAssetIdAndLabel(eq(mine.getId()), eq("Hackathon"))).thenReturn(false);

        BulkTagRequestDto dto = new BulkTagRequestDto();
        dto.setAssetIds(List.of(mine.getId(), foreign.getId()));
        dto.setLabel("  Hackathon  ");

        BulkOperationResponseDto result = service.bulkTag(dto, user);

        assertEquals(1, result.affected()); // only the in-institution, non-duplicate asset
        verify(assetTagRepository, times(1)).save(any(AssetTag.class));
        verify(auditLogService).record(eq(actor), eq("ASSETS_TAGGED"), any(), any(), any(), any());
    }
}
