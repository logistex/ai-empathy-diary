# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

**AI 공감 다이어리** — 한 줄 일기를 쓰면 AI가 감정을 분석하고 공감·위로 메시지를 돌려주는 웹앱.
(책 *혼자 공부하는 바이브 코딩 with 클로드 코드* 7장 "에이전트" 학습 프로젝트)

- 프로덕션: https://ai-empathy-diary-two.vercel.app (Vercel, git push 시 자동 배포)
- 상세 설계: [`docs/PRD.md`](docs/PRD.md) · [`docs/PLAN.md`](docs/PLAN.md) · **API 계약** [`docs/API.md`](docs/API.md)

## 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드 (배포 전 항상 통과 확인)
npm run lint         # ESLint
npx tsc --noEmit     # 타입 체크 (테스트 러너는 없음 — 빌드·tsc·스모크로 검증)
npx vercel --prod    # 수동 배포 (git push origin main 으로도 자동 배포됨)
```

**DB 마이그레이션**은 러너 스크립트가 없다. `db/migrations/*.sql`을 순서대로 DB에 직접 적용한다:
```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql   # psql 미설치 시 pg 사용 일회성 스크립트로 실행
```
(마이그레이션 SQL은 `CREATE ... IF NOT EXISTS` 등 멱등하게 작성돼 있다.)

## 아키텍처 (Next.js 16 App Router)

```
브라우저 UI ──▶ Next.js API 라우트(서버) ──▶ OpenRouter(무료 LLM)
                     │                              │
                  Auth.js 세션                 감정·공감 생성
                     ▼                              ▼
              PostgreSQL(Supabase, diary 스키마) ◀──┘
```

- **페이지**: `app/page.tsx`(로그인 `/`) · `app/write`(작성+결과) · `app/history`(히스토리)
- **API**: `app/api/diary`(POST 작성/GET 목록) · `app/api/diary/[id]/reanalyze`(POST 재분석) · `app/api/account`(DELETE 탈퇴) · `app/api/auth/[...nextauth]`
- **`auth.ts`**: Auth.js v5, 구글 OAuth, **JWT 전략**. `jwt` 콜백에서 `google_sub` 기준 `diary.users` upsert 후 세션에 내부 `user_id` 주입 → API가 이 `user_id`로 소유권 검증.
- **`lib/db/`**: `pg` 커넥션 풀 + 쿼리. 모든 테이블은 `diary` 스키마로 한정.
- **`lib/ai/`**: `openrouter.ts`(무료 모델 폴백 체인) + `index.ts`(`analyzeEntry`, `computeSafety`)
- **DB**: `diary.users`, `diary.diary_entries`(FK `ON DELETE CASCADE`)

## 반드시 알아야 할 설계 결정 (비자명)

1. **DB는 다른 앱과 공유된다.** `DATABASE_URL`은 `recipe4fridge` 앱과 **같은 Supabase DB**를 가리킨다. 그 앱은 `public` 스키마(`public.users`, `saved_recipes`)를 쓴다. 충돌을 피하려고 이 앱의 테이블은 전용 **`diary` 스키마**에 둔다. **새 쿼리/테이블은 반드시 `diary.` 로 한정하고 `public`을 건드리지 말 것.**

2. **무료 모델만 + 폴백 체인.** OpenRouter 무료 모델(`:free`)은 업스트림 429가 잦다. `lib/ai/openrouter.ts`의 `FREE_MODELS`를 순서대로 시도해 성공률을 높인다. **유료 모델을 절대 추가하지 말 것.** 라우트당 총 지연이 커질 수 있어 AI 호출 라우트에는 `export const maxDuration = 60`을 둔다.

3. **원문 유실 방지.** `POST /api/diary`는 **원문을 먼저 저장(emotion=null)한 뒤 분석해 업데이트**한다. AI가 느리거나 실패/타임아웃해도 일기 원문은 절대 유실되지 않는다. 실패한 일기는 재분석 엔드포인트로 다시 분석한다.

4. **데이터 다운그레이드 방지.** `updateDiaryAnalysis`는 `WHERE ... AND emotion IS NULL` 가드가 있어, 이미 분석된 일기를 null로 덮어쓰지 않는다. 재분석은 미분석 항목에만 적용된다(이미 분석된 항목엔 409).

5. **안전(위기) 감지는 저장하지 않는다.** `computeSafety(content)`가 키워드로 위기(자해·자살)를 감지해 상담전화(109/1577-0199/1388)를 안내한다. AI 호출 없이 원문에서 계산하며, **POST·재분석·GET 응답 모두에 `safety`로 포함**된다(히스토리에서도 노출). DB 컬럼이 아니다. 패턴 수정 시 관용구("배고파 죽겠어") 오탐에 주의.

## 환경변수 (`.env`, git 제외)

`OPENROUTER_API_KEY` · `DATABASE_URL` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` · `AUTH_SECRET` · `AUTH_TRUST_HOST`(배포). `.env.example` 참고.
Vercel에는 동일 값이 프로젝트 환경변수로 등록돼 있다. 구글 OAuth 리디렉션 URI는 `http://localhost:3000/api/auth/callback/google` 와 배포 도메인 버전 둘 다 등록해야 한다.

## 서브에이전트

`.claude/agents/`에 제품팀 역할 에이전트가 있다: `product-manager`, `backend-developer`, `frontend-developer`, `ai-integration-specialist`, `qa-engineer`. 새 기능은 계약(`docs/API.md`)을 먼저 확정한 뒤 담당 영역을 나눠 진행하는 흐름을 따른다.
