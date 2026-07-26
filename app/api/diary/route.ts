// /api/diary — 일기 작성(POST) / 목록 조회(GET)
//
// ⚠️ 1단계 스텁: 계약(docs/API.md)에 맞는 타입과 빈/자리표시 응답만 둔다.
//    실제 인증 검증·DB 저장/조회·OpenRouter(AI) 연동은 2A/2B 단계에서 구현한다.

import { NextResponse } from "next/server";

// ── 계약 타입 (docs/API.md 와 일치) ─────────────────────────────

/** 일기 최대 길이(글자 수). PRD/1단계 확정값. */
export const MAX_CONTENT_LENGTH = 500;

/** 위기(자해 등) 감지 시 함께 노출할 안전 안내 자원. */
export interface SafetyResource {
  name: string; // 예: "자살예방 상담전화"
  phone: string; // 예: "109"
}

/** AI 단계에서 채워지는 안전 플래그. 기본은 비활성(flagged=false). */
export interface Safety {
  flagged: boolean;
  resources: SafetyResource[];
}

/** 단일 일기 항목. emotion/empathy_message 는 AI 실패 시 null 일 수 있다. */
export interface DiaryEntry {
  id: number;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
  created_at: string; // ISO 8601
  safety?: Safety;
}

interface CreateDiaryRequest {
  content: string;
}

// ── POST /api/diary (일기 작성, 로그인 필요) ────────────────────
export async function POST() {
  // TODO(2A): auth()로 세션 확인 → 미로그인 시 401.
  // TODO(2A): body.content 검증(빈 값 금지 / 최대 MAX_CONTENT_LENGTH 자) → 위반 시 400.
  // TODO(2A): users 소유의 diary_entries 에 원문 저장(원문은 AI 실패와 무관하게 항상 저장).
  // TODO(2B): OpenRouter(gemma) 호출로 emotion/empathy_message 생성, safety 판정.
  //           AI 실패 시 emotion/empathy_message 는 null 로 두고 201 응답(재시도 가능).
  void (0 as unknown as CreateDiaryRequest); // 계약 타입 참조용(미사용 경고 방지)

  const stub: DiaryEntry = {
    id: 0,
    content: "",
    emotion: null,
    empathy_message: null,
    created_at: new Date().toISOString(),
    safety: { flagged: false, resources: [] },
  };
  return NextResponse.json(stub, { status: 201 });
}

// ── GET /api/diary (로그인 사용자의 일기 목록, 최신순) ───────────
export async function GET() {
  // TODO(2A): auth()로 세션 확인 → 미로그인 시 401.
  // TODO(2A): 현재 사용자(user_id) 소유 일기만 created_at DESC 로 조회.
  const entries: DiaryEntry[] = [];
  return NextResponse.json({ entries }, { status: 200 });
}
