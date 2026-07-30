package com.starttoo.backend.database;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class PostgresqlNullParameterGuardTest {

    @Test
    void nullableJdbcParametersDeclareTheirPostgresqlType() throws IOException {
        Path sourceRoot = Path.of("src/main/java");
        String sources;
        try (var paths = Files.walk(sourceRoot)) {
            sources = paths
                    .filter(path -> path.toString().endsWith(".java"))
                    .map(this::read)
                    .reduce("", (left, right) -> left + "\n" + right);
        }

        assertThat(sources)
                .as("PostgreSQL cannot infer an untyped null in '? IS NULL'; use CAST(? AS type)")
                .doesNotContain("? IS NULL");
    }

    private String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
