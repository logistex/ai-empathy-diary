// /api/account — 회원 탈퇴(계정 및 모든 일기 영구 삭제)
//
// 계약: docs/API.md. 로그인 필요. 세션의 내부 user_id 본인 계정만 삭제한다.
// diary_entries 는 ON DELETE CASCADE 로 함께 삭제된다(되돌릴 수 없음).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUser } from "@/lib/db";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ── DELETE /api/account (회원 탈퇴, 로그인 필요) ────────────────
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  try {
    await deleteUser(session.user.id);
    // 성공(대상이 없던 경우 포함)은 200. 클라이언트는 이후 로그아웃 처리한다.
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "계정을 삭제하지 못했습니다.");
  }
}
