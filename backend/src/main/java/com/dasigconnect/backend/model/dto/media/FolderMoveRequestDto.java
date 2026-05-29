package com.dasigconnect.backend.model.dto.media;

import java.util.UUID;

/** Move a folder under a new parent. A null parentFolderId moves it to the top level. */
public class FolderMoveRequestDto {

    private UUID parentFolderId;

    public UUID getParentFolderId() { return parentFolderId; }
    public void setParentFolderId(UUID parentFolderId) { this.parentFolderId = parentFolderId; }
}
