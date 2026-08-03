package com.starttoo.backend.database;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class FlywayMigrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17-alpine");

    @Test
    void appliesAllMigrationsToPostgresql() throws Exception {
        var result = Flyway.configure()
                .dataSource(
                        POSTGRES.getJdbcUrl(),
                        POSTGRES.getUsername(),
                        POSTGRES.getPassword()
                )
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertThat(result.migrationsExecuted).isEqualTo(8);
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        ); var statement = connection.prepareStatement("""
                SELECT COUNT(*)
                  FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name <> 'flyway_schema_history'
                """);
             var rows = statement.executeQuery()) {
            rows.next();
            assertThat(rows.getInt(1)).isEqualTo(34);
        }
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        ); var statement = connection.prepareStatement("""
                SELECT indexdef
                  FROM pg_indexes
                 WHERE schemaname = 'public'
                   AND indexname IN (
                       'uq_users_active_nickname',
                       'uq_users_active_phone_number'
                   )
                 ORDER BY indexname
                """);
             var rows = statement.executeQuery()) {
            int indexCount = 0;
            while (rows.next()) {
                indexCount++;
                assertThat(rows.getString("indexdef"))
                        .contains("account_status")
                        .contains("WITHDRAWN");
            }
            assertThat(indexCount).isEqualTo(2);
        }
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        ); var statement = connection.prepareStatement("""
                SELECT column_name, character_maximum_length
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'user_devices'
                   AND column_name IN ('firebase_installation_id', 'push_token')
                """);
             var rows = statement.executeQuery()) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString("column_name"))
                    .isEqualTo("firebase_installation_id");
            assertThat(rows.getInt("character_maximum_length")).isEqualTo(128);
            assertThat(rows.next()).isFalse();
        }
    }
}
