package com.starttoo.backend.tattoo;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooModelRestClientFactory;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TattooModelClientTest {

    private static final String BASE_URL = "https://model.test";

    @Test
    void disabledModelUsesExplicitStub() {
        TattooModelClient client = new TattooModelClient(
                readTimeout -> RestClient.builder().build(),
                properties(false)
        );

        TattooModelClient.Analysis analysis =
                client.analyze("https://minio.test/presigned");

        assertThat(analysis.primaryStyleCode()).isEqualTo("OTHER");
        assertThat(analysis.renderingStyleCodes()).containsExactly("LINE");
    }

    @Test
    void sendsPresignedUrlsToBatchAnalysisEndpoint() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andExpect(content().json("""
                        {"items":[
                          {"imageUrl":"https://minio.test/one"},
                          {"imageUrl":"https://minio.test/two"}
                        ]}
                        """))
                .andRespond(withSuccess(
                        """
                        {
                          "results": [
                            {
                              "status": "TATTOO",
                              "analysis": {
                                "primaryStyleCode": "OTHER",
                                "secondaryStyleCodes": [],
                                "renderingStyleCodes": ["LINE"],
                                "colorCode": "BLACK",
                                "subjects": ["SAMPLE"]
                              }
                            },
                            {"status": "NOT_TATTOO", "analysis": null}
                          ]
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = client(builder, properties(true));

        var results = client.analyzeBatch(List.of(
                "https://minio.test/one",
                "https://minio.test/two"
        ));

        assertThat(results).hasSize(2);
        assertThat(results.get(0).tattoo()).isTrue();
        assertThat(results.get(0).analysis().primaryStyleCode()).isEqualTo("OTHER");
        assertThat(results.get(1).tattoo()).isFalse();
        assertThat(results.get(1).failed()).isFalse();
        server.verify();
    }

    @Test
    void sendsImageIdentityAndDesignUploadTargetForPostImages() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andExpect(content().json("""
                        {"items":[{
                          "imageSeq":61,
                          "imageUrl":"https://minio.test/source",
                          "designObjectKey":"users/7/extraction/design.png",
                          "designUploadUrl":"https://minio.test/upload"
                        }]}
                        """))
                .andRespond(withSuccess(
                        """
                        {"results":[{
                          "imageSeq":61,
                          "status":"TATTOO",
                          "analysis":{
                            "primaryStyleCode":"OTHER",
                            "secondaryStyleCodes":[],
                            "renderingStyleCodes":["LINE"],
                            "colorCode":"BLACK",
                            "subjects":["SAMPLE"]
                          },
                          "design":{"objectKey":"users/7/extraction/design.png"}
                        }]}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = client(builder, properties(true));

        var results = client.analyzeBatchItems(List.of(new TattooModelClient.BatchImage(
                61L,
                "https://minio.test/source",
                "users/7/extraction/design.png",
                "https://minio.test/upload"
        )));

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.imageSeq()).isEqualTo(61L);
            assertThat(result.design().objectKey())
                    .isEqualTo("users/7/extraction/design.png");
        });
        server.verify();
    }

    /**
     * FAILED 를 NOT_TATTOO 로 흡수하면 재시도해야 할 이미지가 종료 상태로 굳는다.
     */
    @Test
    void failedItemIsDistinguishedFromNonTattooItem() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andRespond(withSuccess(
                        """
                        {"results":[
                          {"status":"FAILED","analysis":null},
                          {"status":"NOT_TATTOO","analysis":null}
                        ]}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = client(builder, properties(true));

        var results = client.analyzeBatch(List.of(
                "https://minio.test/one",
                "https://minio.test/two"
        ));

        assertThat(results.get(0).failed()).isTrue();
        assertThat(results.get(0).tattoo()).isFalse();
        assertThat(results.get(1).failed()).isFalse();
        assertThat(results.get(1).tattoo()).isFalse();
        server.verify();
    }

    @Test
    void nonTattooResultMapsToUnprocessableEntityForSingleAnalyze() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andRespond(withSuccess(
                        """
                        {"results":[{"status":"NOT_TATTOO","analysis":null}]}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = client(builder, properties(true));

        assertError(
                () -> client.analyze("https://minio.test/presigned"),
                ErrorCode.NOT_TATTOO_IMAGE
        );
        server.verify();
    }

    /**
     * 모델 처리 실패는 사용자 잘못(422)이 아니라 업스트림 장애(502)로 올려야 한다.
     */
    @Test
    void failedResultMapsToUpstreamErrorForSingleAnalyze() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andRespond(withSuccess(
                        """
                        {"results":[{"status":"FAILED","analysis":null}]}
                        """,
                        MediaType.APPLICATION_JSON
                ));
        TattooModelClient client = client(builder, properties(true));

        assertError(
                () -> client.analyze("https://minio.test/presigned"),
                ErrorCode.UPSTREAM_SERVICE_ERROR
        );
        server.verify();
    }

    @Test
    void serverErrorMapsToUpstreamError() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                .andRespond(withServerError());
        TattooModelClient client = client(builder, properties(true));

        assertError(
                () -> client.analyzeBatch(List.of("https://minio.test/one")),
                ErrorCode.UPSTREAM_SERVICE_ERROR
        );
        server.verify();
    }

    @Test
    void timeoutMapsToGatewayTimeout() {
        RestClient.Builder builder = RestClient.builder()
                .requestFactory((uri, method) -> {
                    throw new SocketTimeoutException("timed out");
                });
        TattooModelClient client = client(builder, properties(true));

        assertError(
                () -> client.analyze("https://minio.test/presigned"),
                ErrorCode.PROCESSING_TIMEOUT
        );
    }

    /**
     * 배치는 이미지를 한 장씩 순차로 추론하므로 타임아웃도 장수에 비례해야 한다.
     * 고정 타임아웃을 쓰면 장수가 늘어날 때 정상 처리를 타임아웃으로 잘라 버린다.
     */
    @Test
    void readTimeoutScalesWithImageCount() {
        List<Duration> requested = new ArrayList<>();
        TattooModelRestClientFactory factory = readTimeout -> {
            requested.add(readTimeout);
            RestClient.Builder builder = RestClient.builder();
            MockRestServiceServer.bindTo(builder).build()
                    .expect(requestTo(BASE_URL + "/v1/tattoos/analyze-batch"))
                    .andRespond(withSuccess(
                            """
                            {"results":[
                              {"status":"NOT_TATTOO"},
                              {"status":"NOT_TATTOO"},
                              {"status":"NOT_TATTOO"}
                            ]}
                            """,
                            MediaType.APPLICATION_JSON
                    ));
            return builder.baseUrl(BASE_URL).build();
        };
        TattooModelClient client = new TattooModelClient(factory, properties(true));

        client.analyzeBatch(List.of(
                "https://minio.test/one",
                "https://minio.test/two",
                "https://minio.test/three"
        ));

        // per-image 30초 × 3장 + overhead 10초
        assertThat(requested).containsExactly(Duration.ofSeconds(100));
    }

    private TattooModelClient client(RestClient.Builder builder, AiProperties properties) {
        RestClient restClient = builder.baseUrl(properties.baseUrl()).build();
        return new TattooModelClient(readTimeout -> restClient, properties);
    }

    private AiProperties properties(boolean enabled) {
        return new AiProperties(
                enabled,
                BASE_URL,
                "/v1/tattoos/detect",
                "/v1/tattoos/analyze",
                "/v1/tattoos/analyze-batch",
                "/v1/generations",
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

    private void assertError(Runnable invocation, ErrorCode expected) {
        assertThatThrownBy(invocation::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(expected));
    }
}
