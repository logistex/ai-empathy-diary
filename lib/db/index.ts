// lib/db — PostgreSQL 커넥션 풀 + 쿼리 헬퍼
//
// DATABASE_URL 환경변수로 접속한다. diary.users / diary.diary_entries 테이블 접근 함수를 제공한다.
// 이 앱의 테이블은 전용 diary 스키마에 있다(같은 DB의 다른 앱과 격리). db/migrations/001_init.sql 참고.

import { Pool, type QueryResultRow } from "pg";

// 개발 중 Next.js 핫 리로드로 풀이 중복 생성돼 커넥션이 고갈되는 것을 막기 위해
// globalThis 에 단일 풀을 캐시한다.
const globalForDb = globalThis as unknown as { __diaryPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__diaryPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
    }
    // Supabase(및 대다수 호스팅 PostgreSQL)는 SSL 연결이 필수다.
    globalForDb.__diaryPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForDb.__diaryPool;
}

/** 파라미터 바인딩 쿼리를 실행하고 행 배열을 돌려주는 얇은 헬퍼. */
async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

// ── 타입 ────────────────────────────────────────────────────────

/** 구글 로그인에서 얻은 사용자 프로필(upsert 입력). */
export interface GoogleUserProfile {
  google_sub: string; // 구글 OAuth의 안정적 고유 식별자(sub)
  email: string | null;
  name: string | null;
  image: string | null;
}

/** 일기 레코드(API 응답용). id 는 number, created_at 은 ISO 8601 문자열로 정규화. */
export interface DiaryRecord {
  id: number;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
  created_at: string; // ISO 8601 (UTC)
}

// ── users ──────────────────────────────────────────────────────

/**
 * google_sub 기준으로 사용자를 upsert 하고 내부 user_id 를 돌려준다.
 * 이미 존재하면 email/name/image 를 최신 값으로 갱신한다.
 */
export async function upsertUser(profile: GoogleUserProfile): Promise<number> {
  const rows = await query<{ id: string }>(
    `INSERT INTO diary.users (google_sub, email, name, image)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub)
     DO UPDATE SET email = EXCLUDED.email,
                   name  = EXCLUDED.name,
                   image = EXCLUDED.image
     RETURNING id`,
    [profile.google_sub, profile.email, profile.name, profile.image],
  );
  // BIGINT 는 pg 가 문자열로 돌려주므로 number 로 변환한다.
  return Number(rows[0].id);
}

// ── diary_entries ──────────────────────────────────────────────

interface DiaryRow {
  id: string;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
  created_at: Date;
}

function toDiaryRecord(row: DiaryRow): DiaryRecord {
  return {
    id: Number(row.id),
    content: row.content,
    emotion: row.emotion,
    empathy_message: row.empathy_message,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * 일기 원문을 저장한다. emotion/empathy_message 는 AI 분석 실패 시 null 로 저장한다.
 * 저장된 레코드(id, created_at 포함)를 돌려준다.
 */
export async function insertDiaryEntry(input: {
  user_id: number;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
}): Promise<DiaryRecord> {
  const rows = await query<DiaryRow>(
    `INSERT INTO diary.diary_entries (user_id, content, emotion, empathy_message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, content, emotion, empathy_message, created_at`,
    [input.user_id, input.content, input.emotion, input.empathy_message],
  );
  return toDiaryRecord(rows[0]);
}

/** 특정 사용자의 일기만 최신순(created_at DESC)으로 조회한다. 없으면 빈 배열. */
export async function listDiaryEntries(user_id: number): Promise<DiaryRecord[]> {
  const rows = await query<DiaryRow>(
    `SELECT id, content, emotion, empathy_message, created_at
     FROM diary.diary_entries
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user_id],
  );
  return rows.map(toDiaryRecord);
}
