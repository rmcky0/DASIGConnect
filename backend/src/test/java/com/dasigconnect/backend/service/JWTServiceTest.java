package com.dasigconnect.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dasigconnect.backend.model.entity.Institution;
import com.dasigconnect.backend.model.entity.User;
import com.dasigconnect.backend.model.entity.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JWTServiceTest {

    private static final String SECRET = "test-secret-long-enough-for-hmac-sha256-minimum-size";

    private Clock fixedClock;
    private JWTService jwtService;

    @BeforeEach
    void setUp() {
        fixedClock = Clock.fixed(Instant.parse("2026-05-19T00:00:00Z"), ZoneOffset.UTC);
        jwtService = new JWTService(fixedClock, SECRET, Duration.ofMinutes(60));
    }

    @Test
    void generateAccessTokenIncludesExpectedClaims() {
        UUID institutionId = UUID.randomUUID();
        User user = buildUser(UserRole.contributor, institutionId);

        String token = jwtService.generateAccessToken(user);
        Claims claims = jwtService.extractClaims(token);

        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        assertThat(claims.get("user_id", String.class)).isEqualTo(user.getId().toString());
        assertThat(claims.get("email", String.class)).isEqualTo("user@example.com");
        assertThat(claims.get("role", String.class)).isEqualTo("contributor");
        assertThat(claims.get("institution_id", String.class)).isEqualTo(institutionId.toString());
    }

    @Test
    void administratorTokenOmitsInstitutionId() {
        User user = buildUser(UserRole.administrator, null);

        Claims claims = jwtService.extractClaims(jwtService.generateAccessToken(user));

        assertThat(claims.get("institution_id")).isNull();
    }

    @Test
    void validateTokenRejectsNullBlankAndTamperedTokens() {
        User user = buildUser(UserRole.validator, UUID.randomUUID());
        String token = jwtService.generateAccessToken(user);
        String tamperedToken = token.substring(0, token.length() - 4) + "xxxx";

        assertThat(jwtService.validateToken(null)).isFalse();
        assertThat(jwtService.validateToken("")).isFalse();
        assertThat(jwtService.validateToken("   ")).isFalse();
        assertThat(jwtService.validateToken(tamperedToken)).isFalse();
    }

    @Test
    void validateTokenRejectsExpiredToken() {
        Clock issuedAt = Clock.fixed(Instant.parse("2026-05-19T00:00:00Z"), ZoneOffset.UTC);
        JWTService issuingService = new JWTService(issuedAt, SECRET, Duration.ofSeconds(1));
        String token = issuingService.generateAccessToken(buildUser(UserRole.contributor, null));

        Clock afterExpiry = Clock.fixed(Instant.parse("2026-05-19T00:00:02Z"), ZoneOffset.UTC);
        JWTService validatingService = new JWTService(afterExpiry, SECRET, Duration.ofMinutes(60));

        assertThat(validatingService.validateToken(token)).isFalse();
    }

    @Test
    void invalidateTokenBlacklistsTokenUntilExpiry() {
        String token = jwtService.generateAccessToken(buildUser(UserRole.contributor, null));

        jwtService.invalidateToken(token);

        assertThat(jwtService.validateToken(token)).isFalse();
        assertThatThrownBy(() -> jwtService.extractClaims(token)).isInstanceOf(JwtException.class);
    }

    private User buildUser(UserRole role, UUID institutionId) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        user.setRole(role);
        if (institutionId != null) {
            Institution institution = new Institution();
            institution.setId(institutionId);
            user.setInstitution(institution);
        }
        return user;
    }
}
