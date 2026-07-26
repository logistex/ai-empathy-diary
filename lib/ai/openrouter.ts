// OpenRouter 최소 클라이언트 (무료 모델 폴백 체인)
//
// - Node 내장 fetch로 OpenRouter의 OpenAI 호환 chat/completions 엔드포인트를 호출한다.
// - 기본 모델(gemma-4-31b:free)은 업스트림(Google) 레이트리밋으로 429가 잦다.
//   그래서 "여러 무료 모델을 순서대로 시도"하는 폴백 체인을 둔다.
//   1순위가 429/5xx/네트워크오류/타임아웃/응답검증 실패면 다음 무료 모델로 넘어간다.
// - 과한 재시도를 피하기 위해 모델당 1회만 시도하고, 실패하면 곧바로 다음 모델로 넘어간다
//   (지수 백오프 재시도 대신 "다른 무료 모델"로 폴백하는 편이 성공률·지연 모두 유리).
// - 인증 키(OPENROUTER_API_KEY)는 환경변수로만 읽고 로그에 절대 출력하지 않는다.
// - 유료 모델은 절대 사용하지 않는다. 아래 FREE_MODELS는 전부 :free(무료) 텍스트 모델이다.

/** OpenRouter chat/completions 엔드포인트. */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * 무료 모델 폴백 체인(전부 OpenRouter `:free` 텍스트 모델, 유료 없음).
 * 앞에서부터 순서대로 시도하며, 실패하면 다음 모델로 넘어간다.
 * (2026-07-26 실제 호출로 접근 가능·JSON 응답 가능함을 확인.
 *  1순위 gemma-4-31b는 업스트림 429가 잦아 폴백 대상이 필요함.)
 */
export const FREE_MODELS = [
  "google/gemma-4-31b-it:free", // 1순위. 무료. 429 잦음 → 폴백 필요.
  "openai/gpt-oss-20b:free", // 무료. 추론형이나 400토큰 내 JSON 정상 출력.
  "google/gemma-4-26b-a4b-it:free", // 무료. 응답 안정적.
  "inclusionai/ling-3.0-flash:free", // 무료. 추론형. 토큰 여유 필요.
  "nvidia/nemotron-3-super-120b-a12b:free", // 무료. 추론형. 백업.
] as const;

/** 기본(1순위) 모델 — OpenRouter 무료 모델(:free). 유료 모델은 사용하지 않는다. */
export const DEFAULT_MODEL = FREE_MODELS[0];

/**
 * 모델 한 번 호출의 타임아웃(ms).
 * 모델마다 1회만 시도하고 여러 모델로 폴백하므로, 전체 지연이 커지지 않도록
 * 단일 호출 타임아웃은 짧게 둔다(429는 즉시 반환되므로 대개 빠르게 다음 모델로 넘어간다).
 * 무료 모델 5개 × 10초 = 최악 50초로, 라우트의 maxDuration(60초) 안에 들도록 잡았다.
 */
const TIMEOUT_MS = 10_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  /** 시도할 모델 목록(미지정 시 FREE_MODELS 폴백 체인 전체). 유료 모델은 넣지 않는다. */
  models?: readonly string[];
  temperature?: number;
  max_tokens?: number;
}

/** 폴백 체인이 성공했을 때, 응답 텍스트와 실제로 응답한 모델을 함께 돌려준다. */
export interface ChatResult {
  content: string;
  model: string;
}

/** 디버그 로그(AI_DEBUG 설정 시에만). API 키 등 민감정보는 절대 출력하지 않는다. */
function debugLog(message: string): void {
  if (process.env.AI_DEBUG) {
    console.debug(`[ai/openrouter] ${message}`);
  }
}

/**
 * 단일 모델에 채팅 완성을 1회 요청하고 응답 텍스트를 돌려준다.
 * 실패(네트워크/타임아웃/HTTP 오류/빈 응답)하면 예외를 던진다 → 상위에서 다음 모델로 폴백.
 */
async function requestModel(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  options: ChatOptions,
): Promise<string> {
  const body = JSON.stringify({
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 400,
  });

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

    if (!res.ok) {
      // 429/5xx/4xx 모두 이 모델에서는 실패로 보고 다음 모델로 폴백한다.
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("응답에 content가 없습니다.");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 무료 모델 폴백 체인으로 채팅 완성을 요청한다.
 * FREE_MODELS를 앞에서부터 순서대로 시도하며, 어느 모델이든
 *  - 429/5xx/네트워크/타임아웃 등으로 호출 실패하거나
 *  - validate(content)가 false(예: JSON 파싱 실패)면
 * 다음 무료 모델로 넘어간다. 모델당 1회만 시도한다.
 *
 * 성공하면 { content, model }을 돌려주고(어떤 모델이 응답했는지 포함),
 * 모든 무료 모델이 실패하면 예외를 던진다. 상위(analyzeEntry)가 이를 잡아
 * emotion·empathy_message를 null로 graceful 처리한다.
 *
 * @param validate 응답 텍스트가 사용 가능한지 검사(예: JSON 파싱 성공 여부). 없으면 통과.
 */
export async function chatCompletionWithFallback(
  messages: ChatMessage[],
  options: ChatOptions = {},
  validate?: (content: string) => boolean,
): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // 키 자체는 절대 출력하지 않는다.
    throw new Error("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const models = options.models ?? FREE_MODELS;
  let lastError: unknown;

  for (const model of models) {
    try {
      const content = await requestModel(model, messages, apiKey, options);
      if (validate && !validate(content)) {
        // 호출은 됐지만 응답이 쓸모 없음(예: JSON 파싱 실패) → 다음 모델로.
        lastError = new Error("응답 검증 실패(파싱 불가 등)");
        debugLog(`모델 응답 검증 실패, 다음 모델로 폴백: ${model}`);
        continue;
      }
      debugLog(`응답 성공 모델: ${model}`);
      return { content, model };
    } catch (err) {
      lastError = err;
      const reason = err instanceof Error ? err.message : "알 수 없는 오류";
      debugLog(`모델 실패(${reason}), 다음 모델로 폴백: ${model}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("모든 무료 모델 호출에 실패했습니다.");
}
