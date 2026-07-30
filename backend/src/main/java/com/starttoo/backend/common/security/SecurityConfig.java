package com.starttoo.backend.common.security;

import com.starttoo.backend.common.error.ApiErrorWriter;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.ratelimit.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApiErrorWriter errorWriter;
    private final RateLimitFilter rateLimitFilter;
    private final AccountStatusFilter accountStatusFilter;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/actuator/health/**",
                                // 변경: 실제 인증은 STOMP CONNECT 인터셉터에서 수행한다.
                                "/ws",
                                "/ws/**"
                        ).permitAll()
                        .requestMatchers("/v1/auth/**", "/v1/test/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/posts/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/comments/*/replies").permitAll()
                        // 변경: 내 프로필 API가 공개 와일드카드에 포함되지 않도록 먼저 보호한다.
                        .requestMatchers(HttpMethod.GET, "/v1/artists/me/profile").authenticated()
                        .requestMatchers(HttpMethod.GET, "/v1/artists", "/v1/artists/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/users/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/v1/users/*/posts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/users/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/images/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/tattoos/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/search/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/v1/classifications/**").permitAll()
                        .requestMatchers("/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(resource -> resource
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint((request, response, exception) ->
                                errorWriter.write(response, ErrorCode.UNAUTHORIZED)))
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint((request, response, error) ->
                                errorWriter.write(response, ErrorCode.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, error) ->
                                errorWriter.write(response, ErrorCode.FORBIDDEN)))
                .addFilterAfter(accountStatusFilter, BearerTokenAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, AccountStatusFilter.class);
        return http.build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            String role = jwt.getClaimAsString("role");
            if (role == null || role.isBlank()) {
                return List.of();
            }
            return List.of(new SimpleGrantedAuthority("ROLE_" + role));
        });
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "https://*.starttoo.com"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("X-RateLimit-Limit", "X-RateLimit-Remaining"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    FilterRegistrationBean<AccountStatusFilter> accountStatusFilterRegistration(
            AccountStatusFilter filter
    ) {
        FilterRegistrationBean<AccountStatusFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
