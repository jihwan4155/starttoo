# DB 변경 SQL 관리

최초 서버 DB는 상위의 `starttoo_schema.sql`로 생성한다. 이후 스키마를 변경할 때는 이 디렉터리에 실행 순서를 포함한 SQL 파일을 추가한다.

```text
001_add_example_column.sql
002_add_example_index.sql
```

적용 순서는 다음과 같다.

1. 변경 SQL을 로컬 MySQL에서 검증한다.
2. 서버 DB를 백업한다.
3. 서버 DB에 변경 SQL을 직접 실행한다.
4. 서버에 변경된 애플리케이션을 배포한다.
5. 시작 시 JPA `ddl-auto=validate` 통과 여부를 확인한다.

서버에 적용한 SQL 파일은 수정하거나 삭제하지 않는다. 추가 변경이 필요하면 다음 번호의 새 파일을 만든다.
