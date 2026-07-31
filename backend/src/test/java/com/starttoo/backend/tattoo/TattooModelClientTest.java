package com.starttoo.backend.tattoo;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TattooModelClientTest {

    private static final String BASE_URL = "https://model.test";

    @Test
    void disabledModelUsesExplicitStub() {
        TattooModelClient client = new TattooModelClient(
                RestClient.builder(),
                properties(false)
        );

        TattooModelClient.Analysis analysis =
                client.analyze("https://minio.test/presigned");

        assertThat(analysis.primaryStyleCode()).isEqualTo("OTHER");
        assertThat(analysis.renderingStyleCodes()).containsExactly("LINE");
    }

    @Test
    void sendsPresignedUrlToDetectionAndAnalysisEndpoints() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/detect"))
                .andExpect(content().json("""
                        {"imageUrl":"https://minio.test/presigned"}
                        """))
                .andRespond(withSuccess(
                        """
                        {"isTattoo":true}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze"))
                .andExpect(content().json("""
                        {"imageUrl":"https://minio.test/presigned"}
                        """))
                .andRespond(withSuccess(
                        """
                        {
                          "primaryStyleCode":"OTHER",
                          "secondaryStyleCodes":[],
                          "renderingStyleCodes":["LINE"],
                          "colorCode":"BLACK",
                          "subjects":["타투"]
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = new TattooModelClient(builder, properties(true));

        TattooModelClient.Analysis analysis =
                client.analyze("https://minio.test/presigned");

        assertThat(analysis.primaryStyleCode()).isEqualTo("OTHER");
        server.verify();
    }

    @Test
    void nonTattooResultMapsToUnprocessableEntity() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/detect"))
                .andRespond(withSuccess(
                        """
                        {"isTattoo":false}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = new TattooModelClient(builder, properties(true));

        assertError(
                () -> client.analyze("https://minio.test/presigned"),
                ErrorCode.NOT_TATTOO_IMAGE
        );
        server.verify();
    }

    @Test
    void timeoutMapsToGatewayTimeout() {
        RestClient.Builder builder = RestClient.builder()
                .requestFactory((uri, method) -> {
                    throw new SocketTimeoutException("timed out");
                });
        TattooModelClient client = new TattooModelClient(builder, properties(true));

        assertError(
                () -> client.analyze("https://minio.test/presigned"),
                ErrorCode.PROCESSING_TIMEOUT
        );
    }

    private AiProperties properties(boolean enabled) {
        return new AiProperties(
                enabled,
                BASE_URL,
                "/v1/tattoos/detect",
                "/v1/tattoos/analyze",
                "/v1/generations",
                "/v1/coverups",
                "/v1/simulations"
        );
    }

    private void assertError(Runnable invocation, ErrorCode expected) {
        assertThatThrownBy(invocation::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(expected));
    }
}
