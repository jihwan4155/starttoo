package com.starttoo.backend.tattoo;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.api.TattooDtos;
import com.starttoo.backend.tattoo.application.TattooGenerationClient;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TattooGenerationClientTest {

    private static final String BASE_URL = "https://model.test";

    @Test
    void resolvesOwnedReferenceImageAndForwardsSnakeCaseUrl() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MediaService mediaService = mock(MediaService.class);
        when(mediaService.aiReferenceDownloadUrl(7, 91L))
                .thenReturn("https://starttoo-storage.duckdns.org/reference.png?sig=test");
        server.expect(requestTo(BASE_URL + "/api/v1/generate"))
                .andExpect(content().json("""
                        {
                          "prompt":"",
                          "style":["japanese"],
                          "reference_image_url":"https://starttoo-storage.duckdns.org/reference.png?sig=test",
                          "seed":null,
                          "steps":25,
                          "guidance":7.5,
                          "size":512
                        }
                        """))
                .andRespond(withSuccess(new byte[]{1, 2, 3}, MediaType.IMAGE_PNG));
        TattooGenerationClient client = new TattooGenerationClient(
                builder.baseUrl(BASE_URL).build(),
                properties(),
                mediaService
        );

        var result = client.generate(7, new TattooDtos.GenerateTattooRequest(
                "",
                List.of("japanese"),
                91L,
                null,
                25,
                7.5,
                512
        ));

        assertThat(result.content()).containsExactly(1, 2, 3);
        verify(mediaService).aiReferenceDownloadUrl(7, 91L);
        server.verify();
    }

    @Test
    void letteringDoesNotResolveOrForwardTheReferenceImage() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MediaService mediaService = mock(MediaService.class);
        server.expect(requestTo(BASE_URL + "/api/v1/generate"))
                .andExpect(content().json("""
                        {
                          "prompt":"Forever",
                          "style":["lettering"],
                          "reference_image_url":null,
                          "seed":null,
                          "steps":25,
                          "guidance":7.5,
                          "size":512
                        }
                        """))
                .andRespond(withSuccess(new byte[]{4, 5, 6}, MediaType.IMAGE_PNG));
        TattooGenerationClient client = new TattooGenerationClient(
                builder.baseUrl(BASE_URL).build(),
                properties(),
                mediaService
        );

        client.generate(7, new TattooDtos.GenerateTattooRequest(
                "Forever",
                List.of("lettering"),
                91L,
                null,
                25,
                7.5,
                512
        ));

        verify(mediaService, never()).aiReferenceDownloadUrl(7, 91L);
        server.verify();
    }

    private AiProperties properties() {
        return new AiProperties(
                true,
                BASE_URL,
                "/v1/tattoos/detect",
                "/v1/tattoos/analyze",
                "/v1/tattoos/analyze-batch",
                "/api/v1/generate",
                "/v1/coverups",
                "/v1/simulations",
                Duration.ofSeconds(30),
                Duration.ofSeconds(10),
                "0 */5 * * * *",
                5,
                20,
                Duration.ofMinutes(5)
        );
    }
}
