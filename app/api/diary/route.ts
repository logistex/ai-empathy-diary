// /api/diary — 일기 작성(POST) / 목록 조회(GET)
//
// 계약: docs/API.md. 로그인 필요, 소유권은 세션의 내부 user_id 로 검증한다.
// AI 감정분석/공감 생성은 2B(lib/ai)가 제공하는 analyzeEntry 로 위임한다.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeEntry } from "@/lib/ai";
import { insertDiaryEntry, listDiaryEntries } from "@/lib/db";

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
  /** 감정 분석에 성공한 무료 모델 ID. 미분석이면 null. */
  model: string | null;
  created_at: string; // ISO 8601
  safety?: Safety;
}

interface CreateDiaryRequest {
  content: string;
}

// ── 공통 에러 응답 헬퍼 (계약 0.1) ─────────────────────────────
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ── POST /api/diary (일기 작성, 로그인 필요) ────────────────────
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // JSON 파싱 실패는 형식 오류(400)로 처리한다.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "요청 본문(JSON)을 해석할 수 없습니다.");
  }

  // content 검증: 문자열이어야 하며, 트림 후 1~500자(글자 수/문자 단위).
  const raw = (body as CreateDiaryRequest | null)?.content;
  const content = typeof raw === "string" ? raw.trim() : null;
  // char_length(DB CHECK)와 동일하게 코드포인트 기준으로 길이를 센다.
  const length = content === null ? 0 : [...content].length;
  if (content === null || length < 1 || length > MAX_CONTENT_LENGTH) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      `일기 내용은 1자 이상 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.`,
    );
  }

  // AI 분석: 실패/예외여도 원문은 반드시 저장한다.
  // 계약대로 emotion/empathy_message 는 null 로 두고 201 로 응답한다(500 아님).
  let emotion: string | null = null;
  let empathy_message: string | null = null;
  let model: string | null = null;
  let safety: Safety = { flagged: false, resources: [] };
  try {
    const result = await analyzeEntry(content);
    emotion = result.emotion;
    empathy_message = result.empathy_message;
    model = result.model;
    safety = result.safety;
  } catch {
    // AI 실패 → null 유지. 아래에서 원문을 저장하고 201 로 응답한다.
  }

  // 원문 저장. DB 저장 실패만 내부 오류(500)로 처리한다.
  try {
    const saved = await insertDiaryEntry({
      user_id: session.user.id,
      content,
      emotion,
      empathy_message,
      model,
    });
    const response: DiaryEntry = { ...saved, safety };
    return NextResponse.json(response, { status: 201 });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "일기를 저장하지 못했습니다.");
  }
}

// ── GET /api/diary (로그인 사용자의 일기 목록, 최신순) ───────────
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  try {
    const entries = await listDiaryEntries(session.user.id);
    return NextResponse.json({ entries }, { status: 200 });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "일기 목록을 불러오지 못했습니다.");
  }
}
