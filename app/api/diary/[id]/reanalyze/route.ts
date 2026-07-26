// /api/diary/[id]/reanalyze — 감정 분석에 실패(null)한 일기를 다시 분석한다.
//
// 계약: docs/API.md. 로그인 필요, 소유권은 세션의 내부 user_id 로 검증한다.
// 저장된 원문으로 analyzeEntry 를 재호출해 emotion/empathy_message/model 을 갱신한다.
// 이미 분석된 일기는 갱신하지 않는다(데이터 다운그레이드 방지).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeEntry } from "@/lib/ai";
import { getDiaryEntry, updateDiaryAnalysis } from "@/lib/db";

// 폴백 체인 지연 대비. app/api/diary/route.ts 와 동일한 이유로 상한을 늘린다.
export const maxDuration = 60;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ── POST /api/diary/[id]/reanalyze (재분석, 로그인 필요) ─────────
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // id 검증: 10진수 정수 문자열만 허용한다.
  // (Number()는 "0x10"·"1e3" 등도 받아들이므로 문자열 형태를 먼저 엄격히 검사한다.)
  const { id: idParam } = await params;
  if (!/^\d+$/.test(idParam)) {
    return errorResponse(400, "VALIDATION_ERROR", "잘못된 일기 식별자입니다.");
  }
  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return errorResponse(400, "VALIDATION_ERROR", "잘못된 일기 식별자입니다.");
  }

  // 소유권 검증 겸 현재 상태 조회. 본인 일기가 아니거나 없으면 404.
  const entry = await getDiaryEntry(id, session.user.id);
  if (!entry) {
    return errorResponse(404, "NOT_FOUND", "일기를 찾을 수 없습니다.");
  }

  // 이미 분석된 일기는 재분석하지 않는다(좋은 데이터를 null 로 덮어쓰지 않기 위함).
  if (entry.emotion !== null) {
    return errorResponse(409, "CONFLICT", "이미 분석된 일기예요.");
  }

  // 재분석. analyzeEntry 는 예외를 던지지 않으며, 여전히 실패하면 emotion/model 이 null.
  const result = await analyzeEntry(entry.content);

  try {
    const updated = await updateDiaryAnalysis({
      id,
      user_id: session.user.id,
      emotion: result.emotion,
      empathy_message: result.empathy_message,
      model: result.model,
    });
    if (!updated) {
      // 조회와 갱신 사이에 이미 분석/삭제된 경우(레이스). 가드(emotion IS NULL)가 막았다.
      return errorResponse(409, "CONFLICT", "이미 분석되었거나 사라진 일기예요.");
    }
    return NextResponse.json({ ...updated, safety: result.safety }, { status: 200 });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "재분석 결과를 저장하지 못했습니다.");
  }
}
