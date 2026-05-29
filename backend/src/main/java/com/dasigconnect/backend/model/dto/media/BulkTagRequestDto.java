package com.dasigconnect.backend.model.dto.media;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** Bulk-add a single manual tag to many assets. */
public class BulkTagRequestDto {

    @NotEmpty
    private List<UUID> assetIds;

    @NotBlank
    @Size(max = 50)
    private String label;

    public List<UUID> getAssetIds() { return assetIds; }
    public void setAssetIds(List<UUID> assetIds) { this.assetIds = assetIds; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
