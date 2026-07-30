package com.starttoo.backend.common.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
@ConditionalOnProperty(prefix = "app.firebase", name = "enabled", havingValue = "true")
public class FirebaseConfig {

    private static final String FIREBASE_APP_NAME = "starttoo";

    @Bean(destroyMethod = "delete")
    FirebaseApp firebaseApp(FirebaseProperties properties) throws IOException {
        FirebaseApp existing = FirebaseApp.getApps().stream()
                .filter(app -> FIREBASE_APP_NAME.equals(app.getName()))
                .findFirst()
                .orElse(null);
        if (existing != null) {
            return existing;
        }

        FirebaseOptions.Builder options = FirebaseOptions.builder()
                .setCredentials(credentials(properties));
        if (properties.projectId() != null && !properties.projectId().isBlank()) {
            options.setProjectId(properties.projectId().trim());
        }
        return FirebaseApp.initializeApp(options.build(), FIREBASE_APP_NAME);
    }

    @Bean
    FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
        return FirebaseMessaging.getInstance(firebaseApp);
    }

    private GoogleCredentials credentials(FirebaseProperties properties) throws IOException {
        if (properties.credentialsPath() == null || properties.credentialsPath().isBlank()) {
            return GoogleCredentials.getApplicationDefault();
        }
        Path credentialsPath = Path.of(properties.credentialsPath().trim());
        try (InputStream stream = Files.newInputStream(credentialsPath)) {
            return GoogleCredentials.fromStream(stream);
        }
    }
}
