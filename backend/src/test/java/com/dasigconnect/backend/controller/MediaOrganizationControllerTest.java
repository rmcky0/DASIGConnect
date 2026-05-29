package com.dasigconnect.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dasigconnect.backend.config.SecurityConfig;
import com.dasigconnect.backend.model.dto.media.BulkOperationResponseDto;
import com.dasigconnect.backend.service.JWTService;
import com.dasigconnect.backend.service.MediaOrganizationService;
import com.dasigconnect.backend.service.TenantScopeService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MediaOrganizationController.class)
@Import(SecurityConfig.class)
class MediaOrganizationControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private MediaOrganizationService mediaOrganizationService;
    @MockitoBean private JWTService jwtService;
    @MockitoBean private TenantScopeService tenantScopeService;

    @Test
    void bulkMove_withoutAuth_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/media-assets/bulk-move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[\"" + UUID.randomUUID() + "\"]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void bulkMove_authenticated_returns200() throws Exception {
        when(mediaOrganizationService.bulkMove(any(), any())).thenReturn(new BulkOperationResponseDto(3));
        mockMvc.perform(post("/api/v1/media-assets/bulk-move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[\"" + UUID.randomUUID() + "\"],\"folderId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affected").value(3));
    }

    @Test
    @WithMockUser
    void bulkMove_emptyAssetIds_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/media-assets/bulk-move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void bulkTag_authenticated_returns200() throws Exception {
        when(mediaOrganizationService.bulkTag(any(), any())).thenReturn(new BulkOperationResponseDto(2));
        mockMvc.perform(post("/api/v1/media-assets/bulk-tag")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[\"" + UUID.randomUUID() + "\"],\"label\":\"Hackathon\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affected").value(2));
    }

    @Test
    @WithMockUser
    void bulkTag_blankLabel_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/media-assets/bulk-tag")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[\"" + UUID.randomUUID() + "\"],\"label\":\"\"}"))
                .andExpect(status().isBadRequest());
    }
}
