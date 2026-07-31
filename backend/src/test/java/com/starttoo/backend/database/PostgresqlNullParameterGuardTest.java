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

        // 이름 붙은 파라미터도 같은 문제를 겪는다. 드라이버가 timestamptz 널에는 타입을 실어
        // 보내지 못해 서버가 'could not determine data type of parameter' 로 쿼리를 거절한다.
        // 커서 시각 파라미터는 정수형과 달리 반드시 CAST 로 타입을 박아야 한다.
        assertThat(sources)
                .as("timestamptz 널은 타입 추론이 안 된다; CAST(:cursorDttm AS timestamptz) IS NULL 로 쓸 것")
                .doesNotContain("Dttm IS NULL");
    }

    private String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
