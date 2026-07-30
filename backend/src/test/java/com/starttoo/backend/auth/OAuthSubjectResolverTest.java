package com.starttoo.backend.auth;

import com.starttoo.backend.auth.application.OAuthSubjectResolver;
import com.starttoo.backend.common.config.OAuthProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OAuthSubjectResolverTest {

    private static final String GOOGLE_URI = "https://oauth.test/google/userinfo";

    @Test
    void rejectsUnsupportedProvider() {
        OAuthSubjectResolver resolver = resolver(RestClient.builder());

        assertError(
                () -> resolver.resolve("APPLE", "token"),
                ErrorCode.INVALID_OAUTH_PROVIDER
        );
    }

    @Test
    void mapsRejectedProviderTokenToAuthenticationFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(GOOGLE_URI))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        OAuthSubjectResolver resolver = resolver(builder);

        assertError(
                () -> resolver.resolve("GOOGLE", "rejected-token"),
                ErrorCode.OAUTH_AUTHENTICATION_FAILED
        );
        server.verify();
    }

    @Test
    void mapsProviderServerErrorAndMissingSubjectSeparately() {
        RestClient.Builder serverErrorBuilder = RestClient.builder();
        MockRestServiceServer serverError =
                MockRestServiceServer.bindTo(serverErrorBuilder).build();
        serverError.expect(requestTo(GOOGLE_URI))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertError(
                () -> resolver(serverErrorBuilder).resolve("GOOGLE", "token"),
                ErrorCode.UPSTREAM_SERVICE_ERROR
        );
        serverError.verify();

        RestClient.Builder missingSubjectBuilder = RestClient.builder();
        MockRestServiceServer missingSubject =
                MockRestServiceServer.bindTo(missingSubjectBuilder).build();
        missingSubject.expect(requestTo(GOOGLE_URI))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertError(
                () -> resolver(missingSubjectBuilder).resolve("GOOGLE", "token"),
                ErrorCode.OAUTH_AUTHENTICATION_FAILED
        );
        missingSubject.verify();
    }

    @Test
    void mapsProviderTimeoutToProcessingTimeout() {
        RestClient.Builder builder = RestClient.builder()
                .requestFactory((uri, method) -> {
                    throw new SocketTimeoutException("timed out");
                });

        assertError(
                () -> resolver(builder).resolve("GOOGLE", "token"),
                ErrorCode.PROCESSING_TIMEOUT
        );
    }

    private OAuthSubjectResolver resolver(RestClient.Builder builder) {
        OAuthProperties.Provider google =
                new OAuthProperties.Provider("", "", "", GOOGLE_URI);
        OAuthProperties.Provider kakao =
                new OAuthProperties.Provider("", "", "", "https://oauth.test/kakao/userinfo");
        return new OAuthSubjectResolver(builder, new OAuthProperties(google, kakao));
    }

    private void assertError(Runnable invocation, ErrorCode errorCode) {
        assertThatThrownBy(invocation::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }
}
