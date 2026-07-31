package com.starttoo.backend.realtime.config;

import com.starttoo.backend.common.config.CorsProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    private final CorsProperties corsProperties;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(corsProperties.allowedOrigins().toArray(new String[0]));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 변경: 현재 단일 서버에서는 Spring 인메모리 브로커를 사용한다.
        registry.enableSimpleBroker("/queue");
        registry.setApplicationDestinationPrefixes("/pub");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
                .setMessageSizeLimit(64 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(15_000);
    }
}
