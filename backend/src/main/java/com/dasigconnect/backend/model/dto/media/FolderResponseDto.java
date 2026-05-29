package com.dasigconnect.backend.model.dto.media;

import com.dasigconnect.backend.model.entity.MediaFolder;
import java.time.Instant;
import java.util.UUID;

public class FolderResponseDto {

    private UUID id;
    private String name;
    private UUID parentFolderId;
    private long assetCount;
    private long subfolderCount;
    private Instant createdAt;
    private Instant updatedAt;

    public static FolderResponseDto from(MediaFolder folder, long assetCount, long subfolderCount) {
        FolderResponseDto dto = new FolderResponseDto();
        dto.id = folder.getId();
        dto.name = folder.getName();
        dto.parentFolderId = folder.getParentFolder() == null ? null : folder.getParentFolder().getId();
        dto.assetCount = assetCount;
        dto.subfolderCount = subfolderCount;
        dto.createdAt = folder.getCreatedAt();
        dto.updatedAt = folder.getUpdatedAt();
        return dto;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public UUID getParentFolderId() { return parentFolderId; }
    public long getAssetCount() { return assetCount; }
    public long getSubfolderCount() { return subfolderCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
