"use client";

// 회원 탈퇴 버튼 + 확인 모달.
// 되돌릴 수 없는 파괴적 동작이므로, 반드시 확인 모달을 거쳐 DELETE /api/account 를 호출한다.
// 성공하면 세션을 정리(signOut)하고 홈으로 보낸다.
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import styles from "./DeleteAccountButton.module.css";

export default function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 모달이 열리면 취소 버튼에 포커스, ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        let message = "계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.";
        try {
          const body = await res.json();
          if (body?.error?.message) message = body.error.message;
        } catch {
          // 본문 파싱 실패 시 기본 문구 유지.
        }
        setError(message);
        setBusy(false);
        return;
      }
      // 삭제 성공 → 세션 정리 후 홈으로.
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("네트워크 오류로 탈퇴하지 못했어요. 연결을 확인해 주세요.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        회원 탈퇴
      </button>

      {open && (
        <div
          className={styles.overlay}
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-account-title" className={styles.title}>
              정말 탈퇴하시겠어요?
            </h2>
            <p className={styles.desc}>
              계정과 <strong>지금까지 쓴 모든 일기가 영구히 삭제</strong>돼요. 이
              작업은 되돌릴 수 없어요.
            </p>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-ghost"
                ref={cancelRef}
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirm}
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? "탈퇴 처리 중…" : "탈퇴하기"}
              </button>
            </div>

            {busy && (
              <span className="sr-only" role="status" aria-live="polite">
                탈퇴를 처리하고 있어요.
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
