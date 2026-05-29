package com.dasigconnect.backend.model.dto.media;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public class FolderCreateRequestDto {

    @NotBlank
    @Size(max = 100)
    private String name;

    /** Optional parent; null creates a top-level folder. */
    private UUID parentFolderId;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public UUID getParentFolderId() { return parentFolderId; }
    public void setParentFolderId(UUID parentFolderId) { this.parentFolderId = parentFolderId; }
}
