-- 002_add_model.sql
-- diary.diary_entries 에 분석 모델 컬럼 추가
--   - model : 감정 분석에 성공한 무료 모델 ID(예: google/gemma-4-31b-it:free).
--             NULL = 아직 분석되지 않음(재분석 가능).
-- 실행 예: node 마이그레이션 러너 또는 psql "$DATABASE_URL" -f db/migrations/002_add_model.sql

BEGIN;

ALTER TABLE diary.diary_entries
  ADD COLUMN IF NOT EXISTS model TEXT;

COMMENT ON COLUMN diary.diary_entries.model
  IS '감정 분석에 성공한 무료 모델 ID (NULL=미분석)';

COMMIT;
