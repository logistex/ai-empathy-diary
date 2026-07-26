-- 001_init.sql
-- AI 공감 다이어리 초기 스키마 (PostgreSQL)
-- 대상 테이블: users, diary_entries
--
-- 주의: 이 파일은 "실행하지 않는다". 실제 마이그레이션 적용은 사용자 확인 후 진행한다.
-- 실행 예: psql "$DATABASE_URL" -f db/migrations/001_init.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- users : 구글 로그인 사용자
--  - google_sub : 구글 OAuth의 안정적 고유 식별자(sub). 로그인 시 upsert 기준 키.
--  - email/name/image : 프로필 정보(로그인마다 갱신될 수 있음).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub  TEXT        NOT NULL UNIQUE,
  email       TEXT,
  name        TEXT,
  image       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- diary_entries : 한 줄 일기
--  - content : 일기 원문. 1~500자 제약(빈 값 금지, 최대 500자).
--  - emotion / empathy_message : AI 감정분석·공감 결과.
--      * AI 호출이 실패해도 일기 원문은 저장되어야 하므로 둘 다 NULL 허용.
--      * NULL = "아직 분석되지 않음(재시도 가능)" 을 의미.
--  - 안전(safety) 플래그는 응답 시점에 파생되는 값이며 별도 컬럼으로 저장하지 않는다
--    (데이터 모델 확정본 유지). 자세한 내용은 docs/API.md 참고.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_entries (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  emotion          TEXT,
  empathy_message  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 히스토리 조회(사용자별 최신순)를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_created
  ON diary_entries (user_id, created_at DESC);

COMMIT;
