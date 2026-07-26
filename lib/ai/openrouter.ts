// OpenRouter 최소 클라이언트
//
// - Node 내장 fetch로 OpenRouter의 OpenAI 호환 chat/completions 엔드포인트를 호출한다.
// - 무료 모델(gemma-4-31b:free)은 지연·레이트리밋이 잦으므로 타임아웃과
//   1회 재시도(지수 백오프)를 둔다.
// - 인증 키(OPENROUTER_API_KEY)는 환경변수로만 읽고 로그에 출력하지 않는다.

/** OpenRouter chat/completions 엔드포인트. */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** 기본 모델 — OpenRouter 무료 모델(:free). 유료 모델은 사용하지 않는다. */
export const DEFAULT_MODEL = "google/gemma-4-31b-it:free";

/** 한 번의 호출 타임아웃(ms). 무료 모델 지연 대비 넉넉히 둔다. */
const TIMEOUT_MS = 25_000;

/** 재시도 횟수(최초 시도 외 추가 시도). */
const MAX_RETRIES = 1;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenRouter에 채팅 완성을 요청하고 첫 번째 메시지의 텍스트를 돌려준다.
 * 실패(키 없음/네트워크/타임아웃/HTTP 오류/빈 응답)하면 예외를 던진다.
 * 상위 호출부(analyzeEntry)가 예외를 잡아 graceful 하게 처리한다.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // 키 자체는 절대 출력하지 않는다.
    throw new Error("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const body = JSON.stringify({
    model: options.model ?? DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 400,
  });

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 재시도 전 지수 백오프 대기(0회차는 즉시).
    if (attempt > 0) {
      await sleep(500 * 2 ** (attempt - 1));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      // 레이트리밋(429)·서버 오류(5xx)는 재시도 가치가 있다.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenRouter 일시 오류: HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) {
        // 400 등 재시도해도 소용없는 오류는 즉시 중단.
        throw new Error(`OpenRouter 호출 실패: HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenRouter 응답에 content가 없습니다.");
      }
      return content;
    } catch (err) {
      // 타임아웃(abort)·네트워크 오류는 재시도 대상.
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter 호출에 실패했습니다.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
