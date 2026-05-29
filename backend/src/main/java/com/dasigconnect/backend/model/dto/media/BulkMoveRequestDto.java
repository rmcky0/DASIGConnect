package com.dasigconnect.backend.model.dto.media;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

/** Bulk-assign assets to a folder. A null folderId unfiles them (moves to top level). */
public class BulkMoveRequestDto {

    @NotEmpty
    private List<UUID> assetIds;

    private UUID folderId;

    public List<UUID> getAssetIds() { return assetIds; }
    public void setAssetIds(List<UUID> assetIds) { this.assetIds = assetIds; }

    public UUID getFolderId() { return folderId; }
    public void setFolderId(UUID folderId) { this.folderId = folderId; }
}
