# 개발자 문서 (Development Guide)

AI 공감 다이어리 개발·운영을 위한 온보딩 문서. 아키텍처의 큰 그림과 비자명한 설계 결정은
[`../CLAUDE.md`](../CLAUDE.md)에, API 계약은 [`API.md`](API.md)에 있으니 함께 참고한다.

## 기술 스택

- **Next.js 16** (App Router, TypeScript) — 프런트엔드 + API 라우트
- **Vercel** 배포 (git push 시 자동 배포)
- **PostgreSQL** (Supabase) — 전용 `diary` 스키마
- **OpenRouter** 무료 모델 폴백 체인 (감정 분석·공감 생성)
- **Auth.js v5** (NextAuth) — 구글 OAuth, JWT 세션

## 사전 준비 (계정/키)

1. **OpenRouter** — API 키 발급 (무료 모델 사용)
2. **PostgreSQL** — Supabase 등에서 DB와 접속 URL 확보
3. **Google Cloud OAuth** — OAuth 2.0 웹 클라이언트 생성
   - 승인된 JavaScript 원본: `http://localhost:3000` (+ 배포 도메인)
   - 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google` (+ 배포 도메인 버전)
   - OAuth 동의 화면을 "테스트" 상태로 두고, 로그인할 계정을 **테스트 사용자**에 추가

## 로컬 셋업

```bash
git clone https://github.com/logistex/ai-empathy-diary.git
cd ai-empathy-diary
npm install
cp .env.example .env      # 아래 값들을 채운다
```

`.env` 항목:

| 변수 | 설명 |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API 키 |
| `DATABASE_URL` | PostgreSQL 접속 URL |
| `AUTH_GOOGLE_ID` | 구글 OAuth 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | 구글 OAuth 클라이언트 시크릿 |
| `AUTH_SECRET` | 세션(JWT) 서명 키 — `openssl rand -base64 33` 로 생성 |

> `.env`는 절대 커밋하지 않는다(`.gitignore` 처리됨). 배포 시엔 같은 값을 Vercel 환경변수로 등록하고, 추가로 `AUTH_TRUST_HOST=true`를 넣는다.

### DB 마이그레이션 실행

러너 스크립트는 없다. `db/migrations/*.sql`을 **번호 순서대로** DB에 적용한다:

```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
psql "$DATABASE_URL" -f db/migrations/002_add_model.sql
```

`psql`이 없으면 `pg`로 파일을 읽어 실행하는 일회성 Node 스크립트를 써도 된다(Supabase는 SSL 필요 →
`ssl: { rejectUnauthorized: false }`). 마이그레이션 SQL은 멱등(`IF NOT EXISTS` 등)하다.

### 실행

```bash
npm run dev     # http://localhost:3000
```

## 검증 (테스트 러너 없음)

전용 테스트 스위트는 없다. 아래로 검증한다:

```bash
npm run build        # 프로덕션 빌드 통과 (배포 전 필수)
npx tsc --noEmit     # 타입 오류 확인
npm run lint         # ESLint
```

DB/AI 동작은 `pg`로 실제 DB에 붙는 **스모크 스크립트**(임시)로 확인하는 방식을 써 왔다
(사용자 upsert·일기 저장/조회·제약·CASCADE 등). 운영 DB에 테스트 데이터를 남기면 정리한다.

## 디렉터리 구조 (요약)

```
app/
  page.tsx                       로그인(/)
  write/, history/               작성+결과, 히스토리
  api/diary/route.ts             POST 작성 / GET 목록
  api/diary/[id]/reanalyze/      POST 재분석
  api/account/route.ts           DELETE 회원 탈퇴
  api/auth/[...nextauth]/        Auth.js
auth.ts                          Auth.js 설정(구글, JWT, users upsert)
lib/db/index.ts                  pg 풀 + 쿼리(diary 스키마)
lib/ai/openrouter.ts             무료 모델 폴백 체인
lib/ai/index.ts                  analyzeEntry, computeSafety(위기 감지)
components/                      UI 컴포넌트
db/migrations/                   SQL 마이그레이션
docs/                            PRD, PLAN, API 계약, 매뉴얼, 본 문서
```

## 새 기능 추가 흐름

1. **계약 먼저**: `docs/API.md`에 엔드포인트·요청/응답·에러를 확정한다(프런트/백엔드가 이 문서로 병렬 작업 가능).
2. DB 변경이 필요하면 새 마이그레이션 파일(`003_...sql`)을 추가하고 적용한다.
3. `lib/*` → API 라우트 → `components/*` 순으로 계약에 맞춰 구현한다.
4. `build`/`tsc`/스모크로 검증 후 커밋한다.

## 배포

git 저장소가 Vercel 프로젝트에 연결돼 있어 **`git push origin main` 하면 자동 배포**된다. 수동 배포는:

```bash
npx vercel --prod
```

- 프로덕션: https://ai-empathy-diary-two.vercel.app
- 환경변수는 Vercel 프로젝트 설정에 등록(6개: `.env` 5개 + `AUTH_TRUST_HOST=true`).
- 배포 도메인을 구글 OAuth의 원본/리디렉션 URI에 추가해야 로그인이 된다.
- AI 호출 라우트는 폴백 지연 대비 `export const maxDuration = 60`을 둔다.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 로그인 시 `redirect_uri_mismatch` | 구글 OAuth에 현재 도메인의 리디렉션 URI 미등록 → `<도메인>/api/auth/callback/google` 추가 |
| 배포 후 `UntrustedHost` | Vercel에 `AUTH_TRUST_HOST=true` 미설정 |
| 감정이 자주 null | 무료 모델 429(레이트리밋). 폴백 체인이 완화하지만 여전히 실패 가능 → 재분석으로 처리 |
| DB 연결 오류 | Supabase는 SSL 필요. 커넥션 풀에 `ssl: { rejectUnauthorized: false }` 확인 |
| 배포 함수 타임아웃(504) | AI 라우트 `maxDuration` 확인 / 무료 모델 지연 |

> ⚠️ **DB 공유 주의**: `DATABASE_URL`이 가리키는 DB는 다른 앱(recipe4fridge)과 공유된다. 이 앱 테이블은
> 전용 `diary` 스키마에 있으니, **모든 쿼리를 `diary.` 로 한정하고 `public` 스키마를 건드리지 말 것.**
