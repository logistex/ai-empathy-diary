// /api/diary/[id]/reanalyze — 감정 분석에 실패(null)한 일기를 다시 분석한다.
//
// 계약: docs/API.md. 로그인 필요, 소유권은 세션의 내부 user_id 로 검증한다.
// 저장된 원문으로 analyzeEntry 를 재호출해 emotion/empathy_message/model 을 갱신한다.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeEntry } from "@/lib/ai";
import { getDiaryContent, updateDiaryAnalysis } from "@/lib/db";

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

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    return errorResponse(400, "VALIDATION_ERROR", "잘못된 일기 식별자입니다.");
  }

  // 소유권 검증 겸 원문 조회. 본인 일기가 아니거나 없으면 404.
  const content = await getDiaryContent(id, session.user.id);
  if (content === null) {
    return errorResponse(404, "NOT_FOUND", "일기를 찾을 수 없습니다.");
  }

  // 재분석. analyzeEntry 는 예외를 던지지 않으며, 여전히 실패하면 emotion/model 이 null.
  const result = await analyzeEntry(content);

  try {
    const updated = await updateDiaryAnalysis({
      id,
      user_id: session.user.id,
      emotion: result.emotion,
      empathy_message: result.empathy_message,
      model: result.model,
    });
    if (!updated) {
      // 조회와 갱신 사이에 삭제된 경우 등.
      return errorResponse(404, "NOT_FOUND", "일기를 찾을 수 없습니다.");
    }
    return NextResponse.json({ ...updated, safety: result.safety }, { status: 200 });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "재분석 결과를 저장하지 못했습니다.");
  }
}
