# 약관 동의 시스템 설계

**작성일:** 2026-05-04
**스코프:** 회원가입(이메일 + OAuth) 시 개인정보처리방침 / 서비스 이용약관 동의 수집 인프라

---

## 1. 배경 및 목표

SigLens는 한국 서비스로 「개인정보 보호법(PIPA)」상 회원가입 시 개인정보 수집·이용 동의와 서비스 이용약관 동의를 명시적으로 받아야 한다. 현재 회원가입 흐름에는 동의 단계가 없으며, `app/privacy/page.tsx`와 `app/terms/page.tsx`는 본문이 JSX로 하드코딩되어 있다.

이번 작업은 다음을 달성한다.

1. 약관 본문을 DB에 버전 단위로 저장하고, 페이지가 활성 버전을 렌더링한다.
2. 회원가입(이메일 / OAuth) 시 두 약관에 대한 명시적 동의를 수집하고 row로 기록한다.
3. 향후 선택 동의 항목 도입에 대비한 확장 가능한 스키마를 둔다.

**비목표:** 재동의 모달, 동의 철회 UI, 마케팅 동의, 약관 diff 뷰어 등은 §9에서 의도적으로 제외한다.

---

## 2. 핵심 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 콘텐츠 형식 | 마크다운 본문(body)만 DB, 페이지 chrome은 코드 유지 | 디자인 충실도 + diff 가독성 + 렌더 단순성 |
| 버전 갱신 시 기존 사용자 | 묵시적 동의 (재동의 메커니즘 없음) | 약관 §3 조항 + 비회원도 모든 기능 사용 가능한 옵션 회원제 |
| 활성 버전 식별 | 시행일 기반 자동 활성 (`effective_date <= NOW()` 중 최신) | 미리 PR 머지 + 시행일 분리 가능 |
| 마이그레이션 | 백필 없음 | 기존 사용자 없음 (도입 전 배포) |
| `agreed` 컬럼 | 유지 (boolean) | 향후 선택 동의 확장 대비 |
| 시드 전략 | 마크다운 파일 + `yarn db:seed:terms` 스크립트 | PR diff 가독성 + idempotent |
| 동의 UI 패턴 | 마스터 + 개별 (한국 표준) | 향후 선택 항목 추가 시 동일 UI |
| OAuth 동의 흐름 | Post-OAuth 동의 페이지 (Option B) | 기존 사용자 마찰 0 + 신규 confirm 단계 |

---

## 3. 데이터베이스 스키마

### 3.1 enum 추가 (`src/infrastructure/db/constants.ts`)

```ts
export const TERMS_KIND_VALUES = ['privacy', 'tos'] as const;
export type TermsKind = (typeof TERMS_KIND_VALUES)[number];
```

### 3.2 schema.ts 추가 항목

```ts
export const termsKindEnum = pgEnum('terms_kind', TERMS_KIND_VALUES);

/** Versioned legal documents (privacy policy, terms of service).
 *  Active version = WHERE kind = ? AND effective_date <= NOW()
 *                   ORDER BY effective_date DESC LIMIT 1. */
export const terms = pgTable(
    'terms',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        kind: termsKindEnum('kind').notNull(),
        version: integer('version').notNull(),
        effectiveDate: timestamp('effective_date', { withTimezone: true })
            .notNull(),
        body: text('body').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('terms_kind_version_uidx').on(table.kind, table.version),
        index('terms_kind_effective_date_idx').on(
            table.kind,
            table.effectiveDate
        ),
    ]
);

/** User agreement records — one row per (user, terms) pair.
 *  Mutable: `agreed` and `updatedAt` change if user revokes/re-grants
 *  consent (future feature for optional terms). */
export const agreements = pgTable(
    'agreements',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        termsId: uuid('terms_id')
            .notNull()
            .references(() => terms.id, { onDelete: 'restrict' }),
        agreed: boolean('agreed').notNull(),
        agreedAt: timestamp('agreed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        uniqueIndex('agreements_user_terms_uidx').on(
            table.userId,
            table.termsId
        ),
        index('agreements_user_id_idx').on(table.userId),
        index('agreements_terms_id_idx').on(table.termsId),
    ]
);
```

### 3.3 제약 의도

| 제약 | 의도 |
|---|---|
| `terms_kind_version_uidx (kind, version)` | (kind, version) 중복 방지. 시드 스크립트 idempotency 보증 |
| `effective_date timestamp tz` | 시각 단위 자동 활성화. timezone-aware로 KST/UTC 혼동 방지 |
| `body text` | 약관 분량(수 KB) 적합 |
| `agreements_user_terms_uidx` | 동일 (user, terms) 중복 방지. 변경 시 update path 강제 |
| `terms_id ON DELETE RESTRICT` | 동의 증거가 된 약관은 삭제 불가. 약관은 append-only |
| `user_id ON DELETE CASCADE` | 회원 탈퇴 = agreement 함께 파기 (privacy §4 정책과 일치) |

---

## 4. 폴더 구조

```
db/
├── scripts/
│   ├── migrate.ts          # 루트에서 이동
│   └── seedTerms.ts        # 신규
└── seeds/
    └── terms/
        ├── privacy/
        │   └── v1.md
        └── tos/
            └── v1.md

src/
├── infrastructure/
│   ├── db/
│   │   ├── schema.ts                           # terms, agreements 추가
│   │   ├── termsRepository.ts                  # 신규
│   │   └── agreementRepository.ts              # 신규
│   └── auth/
│       ├── registerAction.ts                   # 동의 검증 + 트랜잭션 추가
│       ├── pendingOAuthSignupStore.ts          # 신규 (Redis)
│       ├── finalizeOAuthSignupAction.ts        # 신규
│       ├── cancelOAuthSignupAction.ts          # 신규
│       └── use-cases/
│           ├── registerUser.ts                 # agreedTermsIds 추가
│           ├── loginExistingOAuthUser.ts       # 신규 (분리)
│           └── finalizeOAuthSignup.ts          # 신규
├── domain/
│   └── legal/
│       └── termsKind.ts                        # 신규 — TermsKind 재내보내기
├── components/
│   ├── auth/
│   │   ├── SignupForm.tsx                      # details 단계 동의 박스 삽입
│   │   ├── ConsentCheckboxGroup.tsx            # 신규
│   │   └── OAuthConsentForm.tsx                # 신규
│   └── legal/
│       └── PolicyMarkdownBody.tsx              # 신규
├── lib/
│   └── legal-toc.ts                            # 신규 — 마크다운에서 TOC 추출
└── app/
    ├── privacy/page.tsx                        # 활성 terms 렌더링으로 변경
    ├── terms/page.tsx                          # 동일
    ├── signup/oauth/consent/page.tsx           # 신규
    └── api/auth/callback/[provider]/route.ts   # 신규/기존 분기 추가

package.json scripts:
- "db:migrate":     tsx db/scripts/migrate.ts          # 경로 변경
- "db:seed:terms":  tsx db/scripts/seedTerms.ts        # 신규
```

---

## 5. 시드 전략

### 5.1 마크다운 파일 형식

```markdown
---
kind: privacy
version: 1
effectiveDate: 2026-04-30T00:00:00+09:00
---

## 1. 총칙

SigLens(이하 "운영자")는 미국 주식 시장의 기술적 분석을 제공하는...

## 2. 수집하는 개인정보 항목 및 수집 방법

**비회원**의 경우, 이용자 식별을 위한 이름·이메일·전화번호 등...
```

### 5.2 frontmatter 스펙

| 필드 | 타입 | 필수 | 검증 |
|---|---|---|---|
| `kind` | `'privacy' \| 'tos'` | ✅ | TERMS_KIND_VALUES에 포함 |
| `version` | integer ≥ 1 | ✅ | 같은 kind 내 단조 증가, gap 금지 |
| `effectiveDate` | ISO 8601 with offset | ✅ | 파싱 가능, KST 권장 |

### 5.3 seedTerms.ts 동작

```
1. db/seeds/terms/**/*.md 글롭 수집
2. gray-matter로 frontmatter + body 파싱
3. zod로 frontmatter 스키마 검증 → 실패 시 파일 경로와 함께 에러
4. 같은 kind 내 version 단조 증가 검증 (1, 2, 3 순서, 중복·gap 금지)
5. INSERT INTO terms (kind, version, effective_date, body)
   ... ON CONFLICT (kind, version) DO NOTHING
6. 콘솔 출력: "[seed] privacy v1: inserted" 또는 "skipped"
```

### 5.4 운영 정책

- 약관 본문 in-place 수정 금지. 오타도 새 version으로 올린다 (이미 받은 동의 증거 보호)
- v1 본문은 현재 `app/privacy/page.tsx`, `app/terms/page.tsx`의 PolicySection 내용을 마크다운으로 옮긴 것 (디자인 변경 없이 콘텐츠 이전)
- 새 버전 추가 시 새 .md 파일 생성 + `yarn db:seed:terms` 실행

---

## 6. 페이지 렌더링 (privacy / terms)

### 6.1 PolicyMarkdownBody 컴포넌트

`src/components/legal/PolicyMarkdownBody.tsx` (신규).

- react-markdown + remark-gfm + rehype-slug
- 커스텀 컴포넌트 매핑:
  - `h2`/`h3` → 슬러그 id 자동 부여, 기존 PolicySection 타이포그래피 재현
  - `a` → 내부 경로(`/`로 시작)면 next/link `<Link>`, 외부면 일반 `<a>` (`target="_blank" rel="noopener"`)
  - `ul`, `li`, `p`, `strong` → 기존 PolicySection 자식들과 동일 클래스

### 6.2 TOC 자동 추출

`src/lib/legal-toc.ts` (신규).

- 마크다운에서 `## 1. 총칙` 같은 h2를 정규식으로 추출
- 결과: `{ id: '1-총칙', label: '1. 총칙' }` 형태
- rehype-slug과 동일 슬러그 알고리즘 (재사용 또는 호환 함수)

### 6.3 페이지 변경 (예: privacy/page.tsx)

```tsx
export const metadata = { /* 정적 — 시행일은 LegalPageShell이 effectiveDate prop으로 받음 */ };

export default async function PrivacyPage() {
    const terms = await findActiveTerms('privacy');
    if (!terms) notFound();

    const toc = extractToc(terms.body);

    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <LegalPageShell
                breadcrumbTitle={PRIVACY_TITLE}
                eyebrow="PRIVACY POLICY"
                title={PRIVACY_TITLE}
                intro={INTRO_TEXT}
                effectiveDate={formatKoreanDate(terms.effectiveDate)}
                toc={toc}
                bottomNotice={bottomNotice}
            >
                <PolicyMarkdownBody markdown={terms.body} />
            </LegalPageShell>
        </>
    );
}
```

### 6.4 페이지 chrome 정리 (코드 유지)

| 요소 | 위치 | 변경 |
|---|---|---|
| `eyebrow`, `title`, breadcrumb | 코드 상수 | 변경 없음 |
| `intro` 단락 | 코드 상수 | 변경 없음 |
| 빨간 박스 "투자 면책 고지" (terms 상단) | 코드 JSX | 변경 없음 |
| 회색 박스 (privacy 하단) | 코드 JSX | 변경 없음 |
| TOC | 자동 추출 | **변경**: 마크다운 h2에서 추출 |
| 본문 §1~§N | DB | **변경**: PolicyMarkdownBody로 렌더 |
| 시행일 텍스트 | DB | **변경**: terms.effectiveDate 포맷 |

### 6.5 캐싱

- `findActiveTerms()` RSC 호출 시 `'use cache'` directive + `cacheLife('hours')` (Next.js 16)
- 약관 row는 거의 안 바뀜 → TTL 1시간 적정. 즉시 반영 필요해지면 `cacheTag('legal-terms')` + `revalidateTag` 도입
- 활성 row 없으면 `notFound()` 호출

### 6.6 `lib/legal.ts` 정리

- `LEGAL_EFFECTIVE_DATE` 상수: 페이지 본문에 더 이상 안 쓰임 → **제거**
- 메타데이터/OG 등에서 사용 중인 곳 검색 후 처리

---

## 7. 회원가입 동의 UI (ConsentCheckboxGroup)

### 7.1 컴포넌트 시그니처

```ts
interface ConsentCheckboxGroupProps {
    privacyChecked: boolean;
    tosChecked: boolean;
    onPrivacyChange: (checked: boolean) => void;
    onTosChange: (checked: boolean) => void;
    error?: string;
}
```

상태는 부모(SignupForm 또는 OAuthConsentForm)가 보유. 마스터 상태는 derive (`privacyChecked && tosChecked`). 마스터 클릭 시 두 개별 onChange 호출.

### 7.2 시각 (확정안)

- 컨테이너: 박스 없음. `border-y border-secondary-800 + py-4` (top/bottom 라인만)
- `<fieldset>` + `<legend class="sr-only">동의 항목</legend>` 의미론
- 마스터 위 안내: "계속하려면 아래 항목에 동의해주세요." (`text-secondary-400 text-xs`)
- 마스터 row와 개별 row 사이 divider (`border-secondary-800`)
- "(필수)" 표기: 개별 항목별 라벨 안에 포함, `text-secondary-400 text-xs` (정상 상태 회색)
- "자세히 보기" 링크: `text-secondary-400 text-xs hover:text-primary-400` + 외부링크 SVG 16×16 `aria-hidden="true"` + `<span class="sr-only">(새 탭에서 열림)</span>`
- 항목별 `aria-label="개인정보처리방침 자세히 보기"` / `"이용약관 자세히 보기"`

### 7.3 시그니처 디테일

체크 시 row 좌측에 1px `bg-primary-500` vertical accent line이 fade-in (200ms ease-out, `prefers-reduced-motion` 시 즉시).

### 7.4 체크박스 상태 명세

| 상태 | 스타일 |
|---|---|
| 미체크 idle | `size-5 rounded-sm border-secondary-500 bg-transparent` |
| 미체크 hover | `border-secondary-300` (100ms transition) |
| 미체크 focus-visible | + `ring-2 ring-primary-400 ring-offset-2 ring-offset-secondary-950` |
| 체크 | `bg-primary-500 border-primary-500` + 화이트 SVG 체크 (`stroke-2`) |
| 체크 hover | `bg-primary-400` |
| Indeterminate (마스터) | `bg-primary-500 border-primary-500` + 화이트 SVG dash |
| 에러 (미체크) | `border-ui-danger` |
| Disabled (제출 중) | `opacity-50 cursor-not-allowed` |
| Indeterminate 구현 | `useRef` + `useEffect`로 `inputRef.current.indeterminate = ...` |

체크/dash는 `<svg>`로 구현 (텍스트 글리프 ✓ 사용 금지).

### 7.5 마이크로 인터랙션

| 동작 | 모션 | 시간 |
|---|---|---|
| 체크 SVG scale 0 → 1 | transform | 150ms ease-out |
| Indeterminate dash → 체크 | dash fade-out 80ms 후 check fade-in 80ms | 160ms |
| Row 좌측 accent fade-in | opacity | 200ms ease-out |
| 에러 메시지 등장 | opacity 0→1 + translateY(-2px → 0) | 150ms |
| Hover 색상 전환 | color/border-color | 100ms linear |
| `prefers-reduced-motion` | 모든 transition `0ms` | — |

shake 등 유희적 모션 금지.

### 7.6 모바일 (≤640px)

- row: `flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between`
- 라벨: `min-w-0`, "자세히 보기": `shrink-0`
- 각 row `min-h-[44px]`, 라벨 전체 `<label>`로 입력 wrap
- 컨테이너: `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`

### 7.7 검증 / 에러 흐름

- submit 항상 enabled (disabled 차단 안티패턴 회피)
- 미체크 상태로 제출 시: 첫 미체크 row로 `scrollIntoView({ block: 'center' })` + focus
- 에러 메시지: group 전체(`<AuthErrorAlert>`) + 미체크 row 라벨 옆 inline 메시지 이중 표시
- 메시지: "**개인정보처리방침과 이용약관에 동의해주세요.**"
- 각 미체크 row에 `border-l border-ui-danger` 시각 보강 + `aria-invalid="true"`
- `aria-live="polite"` 영역에 메시지 유입

### 7.8 HTML 시맨틱

- 개별 체크박스: `required` + `aria-required="true"`
- 마스터: `required` 없음 (개별 토글 보조 도구)
- 라벨 `select-none` 미적용

---

## 8. 회원가입 흐름 변경

### 8.1 SignupForm.tsx (이메일 가입)

details 단계 변경:

```tsx
const [privacyChecked, setPrivacyChecked] = useState(false);
const [tosChecked, setTosChecked] = useState(false);

return (
    <form action={signupFormAction} className="space-y-4" noValidate>
        {/* email, code 통과 후 표시 이름, 비밀번호 입력 */}
        <input type="hidden" name="email" value={email} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input
            type="hidden"
            name="agreed_privacy"
            value={privacyChecked ? 'true' : 'false'}
        />
        <input
            type="hidden"
            name="agreed_tos"
            value={tosChecked ? 'true' : 'false'}
        />

        <AuthFieldGroup id="signup-name" name="name" label="표시 이름 (선택)" />
        <PasswordField ... />
        <ConsentCheckboxGroup
            privacyChecked={privacyChecked}
            tosChecked={tosChecked}
            onPrivacyChange={setPrivacyChecked}
            onTosChange={setTosChecked}
            error={consentErrorFromState}
        />
        <SubmitButton label="회원가입" pendingLabel="가입 중…" />
    </form>
);
```

### 8.2 registerAction 흐름

```
1. 폼 필드 추출 (email, password, name?, next, agreed_privacy, agreed_tos)
2. 동의 검증:
   IF agreed_privacy !== 'true' || agreed_tos !== 'true':
      return { error: { code: 'consent_required', message: ... } }
3. 활성 약관 조회 (트랜잭션 밖):
   termsP = termsRepository.findActive('privacy')
   termsT = termsRepository.findActive('tos')
   IF termsP === null || termsT === null:
      return { error: { code: 'service_unavailable', message: ... } }
4. registerUser({ email, password, name, agreedTermsIds: [termsP.id, termsT.id] }, deps)
   → 트랜잭션: user 생성 + agreement 2개 insert
5. registerResult 실패 시 → 기존 에러 처리
6. loginUser → 쿠키 설정 → redirect (기존 로직)
```

### 8.3 registerUser use-case 시그니처

```ts
registerUser(
    { email, password, name, agreedTermsIds: readonly string[] },
    { users, passwordHasher, emailTokens, agreements, db }
): RegisterUserResult
```

내부에서 `db.transaction()`으로 user 생성 + agreement insertMany를 atomic 처리. agreement 실패 시 user 롤백.

### 8.4 SignupFormState 확장

`error.code` 신규: `'consent_required'`, `'service_unavailable'`.

### 8.5 OAuth 동의 흐름

#### 8.5.1 시퀀스

```
[Continue with Google] click on /login or /signup
  → /api/auth/google/start (변경 없음)
  → Google OAuth
  → /api/auth/callback/google
       ├─ 기존 사용자 → 즉시 로그인 (변경 없음)
       └─ 신규 사용자 → pendingOAuthSignupStore.save → /signup/oauth/consent?token=...
              → OAuthConsentForm
                    ├─ "가입 완료" → finalizeOAuthSignupAction → user + agreement + 세션 → next로 redirect
                    └─ "취소" → cancelOAuthSignupAction → /login redirect
```

#### 8.5.2 pendingOAuthSignupStore

`src/infrastructure/auth/pendingOAuthSignupStore.ts` (신규).

```ts
interface PendingOAuthSignup {
    provider: SupportedOAuthProvider;
    email: string;
    providerAccountId: string;
    name?: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;          // ISO 8601
    next: string;
    createdAt: string;                // ISO 8601, 디버깅
}

interface PendingOAuthSignupStore {
    save(profile: PendingOAuthSignup): Promise<string>;        // 반환: token
    peek(token: string): Promise<PendingOAuthSignup | null>;   // GET only, RSC용
    consume(token: string): Promise<PendingOAuthSignup | null>; // GET + DEL atomic
    delete(token: string): Promise<void>;                      // 명시적 취소
}
```

- 토큰: `crypto.randomBytes(32).toString('hex')` (256bit)
- Redis 키: `pending_oauth_signup:<token>`
- TTL: 600초 (10분)
- `consume()`: GET 후 DEL. 단회용 토큰이라 GET-DEL 사이 ms 단위 race는 보안 영향 없음 (충돌 시 두 호출 중 하나가 빈 결과를 받음)
- 환경변수 누락 시 `null` 반환 (기존 `createEmailTokenStore` 패턴 따름)

#### 8.5.3 callback 라우트 분기

```
1. profileResult 획득 (변경 없음)
2. existingUser = users.findByOAuthAccount(provider, providerAccountId)
   IF existingUser → createSession + setCookie + redirect to next  (기존 동작)
3. ELSE:
   3a. existingByEmail = users.findByEmail(email)
       IF existingByEmail → redirect /login?error=oauth_email_conflict (기존)
   3b. ELSE:
       token = pendingOAuthSignupStore.save({ profile, next })
       redirect /signup/oauth/consent?token=<token>
```

#### 8.5.4 동의 페이지 (RSC)

`src/app/signup/oauth/consent/page.tsx`.

- `export const dynamic = 'force-dynamic'`
- searchParams.token 읽기 → 없으면 redirect `/login?error=oauth_consent_invalid`
- `pendingOAuthSignupStore.peek(token)` → 없으면 redirect `/login?error=oauth_consent_expired`
- 정상 시 `AuthCardShell` 안에 `OAuthConsentForm` 렌더 (token + profile 데이터 전달)

#### 8.5.5 OAuthConsentForm

`src/components/auth/OAuthConsentForm.tsx` (`'use client'`).

- 상단 안내: "Google 계정으로 가입" + "아래 정보로 SigLens에 가입됩니다."
- Profile 카드: avatar(`<Image>` 32×32 rounded-full) + email(`font-mono text-secondary-100`) + provider 라벨 + name
- ConsentCheckboxGroup 재사용 (이메일 가입과 동일 UX)
- hidden input `name="token"`
- "가입 완료" form action → `finalizeOAuthSignupAction`
- "취소" form action → `cancelOAuthSignupAction`
- bfcache 처리: pageshow `event.persisted === true` 시 `window.location.reload()`

#### 8.5.6 finalizeOAuthSignupAction

```
1. token, agreed_privacy, agreed_tos 추출 + 동의 검증
   미동의 → { error: { code: 'consent_required', message: ... } } 반환 (페이지 유지)
2. profile = pendingOAuthSignupStore.peek(token)   ← peek로 token 보존
   profile null → redirect /login?error=oauth_consent_expired
3. 활성 약관 조회 (트랜잭션 밖, token 보존):
   termsP = termsRepository.findActive('privacy')
   termsT = termsRepository.findActive('tos')
   IF termsP === null || termsT === null:
      → redirect /login?error=service_unavailable
      (token은 peek만 되어 보존됨 → 사용자가 잠시 후 동의 페이지 새로고침으로 재시도 가능)
4. profile = pendingOAuthSignupStore.consume(token)  ← 이 시점에 소비
   profile null → race condition → redirect /login?error=oauth_consent_expired
5. DB 트랜잭션:
   5a. users.findByEmail race 체크 → 발견 시 redirect /login?error=oauth_email_conflict
   5b. user = users.createOAuthUser(profile)
   5c. agreementRepository.insertMany([
         { userId, termsId: termsP.id, agreed: true, agreedAt: now },
         { userId, termsId: termsT.id, agreed: true, agreedAt: now },
       ])
   5d. session = createAuthSession({ userId, ... })
6. 세션 쿠키 + auth hint 쿠키 설정
7. redirect(profile.next)
```

**순서 의도:** 활성 약관 조회를 token consume 이전에 수행. 약관 누락(시드 실패 등) 시 token이 보존되어 사용자가 페이지 새로고침으로 재시도 가능. consume은 트랜잭션 직전에 수행하여 token 낭비 최소화.

#### 8.5.7 cancelOAuthSignupAction

```
1. token 검증 (없으면 /login)
2. pendingOAuthSignupStore.delete(token)
3. redirect /login
```

#### 8.5.8 /login 에러 메시지 추가

```ts
const OAUTH_ERROR_MESSAGES = {
    // 기존
    oauth_email_conflict: ...,
    oauth_profile_invalid: ...,
    oauth_unknown: ...,
    // 신규
    oauth_consent_invalid: '잘못된 가입 요청입니다. 처음부터 다시 시작해주세요.',
    oauth_consent_expired: '가입 시간이 만료되었습니다. 다시 시도해주세요.',
    service_unavailable: '서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
};
```

#### 8.5.9 SocialLoginButtons 안내 문구

`/signup` 페이지에서 SocialLoginButtons 위에 작은 안내:
"소셜 로그인 시작 후 약관 동의 단계가 있습니다." (`text-secondary-500 text-xs`)

`/login` 페이지에는 안내 없음 (기존 사용자는 동의 단계 통과 안 함).

---

## 9. 캐싱·뒤로가기(bfcache) 정책

| 위치 | 캐싱 | bfcache 처리 |
|---|---|---|
| `/signup/page.tsx` | force-dynamic (기존) | SignupForm pageshow → handleRestart (기존) |
| `/signup/oauth/consent/page.tsx` | force-dynamic (신규) | OAuthConsentForm pageshow → `window.location.reload()` (신규) |
| `/login/page.tsx` | (기존) | 기존 — OAuth 동의 미관여 |
| `/privacy/page.tsx`, `/terms/page.tsx` | `'use cache'` + cacheLife 1h | 처리 불필요 |

ConsentCheckboxGroup의 체크 상태는 항상 부모 useState로 관리, 외부 저장소 미사용. 마운트 시 무조건 unchecked. 이는 PIPA 명시 동의 원칙(자동 복원 금지)과 정합.

`useActionState`의 잔여 에러는 reload로 함께 휘발.

`window.location.reload()`를 `router.refresh()`보다 우선하는 이유: refresh는 RSC만 재실행하고 클라이언트 상태(체크박스)는 유지됨 → 부적합.

---

## 10. 테스트 전략

### 10.1 테스트 피라미드

| 레이어 | 대상 |
|---|---|
| 단위 | termsRepository, agreementRepository, seedTerms, legal-toc, PolicyMarkdownBody, pendingOAuthSignupStore, registerUser, finalizeOAuthSignup, loginExistingOAuthUser |
| 통합 | registerAction, finalizeOAuthSignupAction, cancelOAuthSignupAction, callback route |
| 컴포넌트 | ConsentCheckboxGroup, OAuthConsentForm, SignupForm details |
| RSC | privacy/page, terms/page, signup/oauth/consent/page |

### 10.2 핵심 케이스 합본

| 파일 | 케이스 |
|---|---|
| termsRepository.test.ts | findActive(최신, 미래 제외, 없으면 null), upsertFromSeed idempotent |
| agreementRepository.test.ts | insertMany 정상, unique 위반, update 시 updatedAt 갱신 |
| seedTerms.test.ts | 정상 파싱+INSERT, frontmatter 검증, version gap, 중복 idempotent |
| legal-toc.test.ts | h2 추출, 한국어/숫자/특수문자 슬러그 |
| PolicyMarkdownBody.test.tsx | 내부 링크 → Next Link, 외부 → target=_blank, 클래스 동등 |
| pendingOAuthSignupStore.test.ts | save→peek→consume→재consume null, TTL 만료, delete |
| registerUser.test.ts | termsIds 정상 → user+agreement 2개, 실패 시 user 롤백, 빈 배열 거부 |
| finalizeOAuthSignupAction.test.ts | 동의 미체크 에러, 정상 user+agreement+세션, token 만료, race conflict, 활성 terms 없음 → 롤백 |
| cancelOAuthSignupAction.test.ts | token 삭제 + /login redirect |
| callback route.test.ts | 기존 사용자 즉시 로그인(회귀), 신규 사용자 save+redirect, 이메일 충돌 (회귀) |
| registerAction.test.ts | consent 미체크 → consent_required + DB 접근 0, 정상 → agreement 2개, 활성 terms 없음 → service_unavailable |
| ConsentCheckboxGroup.test.tsx | 마스터/개별 토글, indeterminate, error prop, aria-label, focus-visible, fieldset+legend |
| OAuthConsentForm.test.tsx | profile 노출, 동의 미체크 시 finalize 미호출, 취소 → cancel, pageshow persisted → reload |
| SignupForm.test.tsx (확장) | details 동의 미체크 시 첫 미체크로 focus, 둘 다 동의 후 submit, hidden input agreed_* 포함 |
| privacy/page.test.tsx, terms/page.test.tsx | 활성 terms 200, 없을 때 notFound() |
| signup/oauth/consent/page.test.tsx | dynamic = 'force-dynamic' 검증, token 없음/만료/정상 분기 |

### 10.3 회귀 보호

- 기존 OAuth 사용자 로그인 흐름 동일 (동의 페이지 거치지 않음)
- 이메일 인증 1·2단계 동일
- bcrypt, 자동 로그인, 쿠키, redirect 동일
- /privacy, /terms 시각 디자인 동일

---

## 11. 배포·마이그레이션 순서

```
1. db/seeds/terms/privacy/v1.md, db/seeds/terms/tos/v1.md 작성 (PR 포함)
2. yarn db:generate → drizzle 마이그레이션 파일 생성
3. PR 머지 → 배포 트리거
4. Post-deploy:
   yarn db:migrate          # 스키마 적용
   yarn db:seed:terms       # v1 시딩
5. 시드 검증:
   SELECT kind, version, effective_date FROM terms;
6. 동작 검증 (수동):
   - /privacy, /terms 페이지 200 + 본문 노출
   - /signup → 동의 체크박스 노출
   - 회원가입 1건 → user + agreement 2개 row 확인
   - OAuth 가입 1건 → 동의 페이지 → 가입 완료 → user + agreement 2개
7. 24시간 모니터링: 가입 에러율, service_unavailable 0건
```

**롤백:** 시드 누락 시 즉시 `yarn db:seed:terms` 재실행. agreements 테이블 자체 문제 시 코드 롤백 (이전 버전은 agreements 미사용, user 테이블 영향 없음).

---

## 12. 의도적 비스코프

이번 PR에서 의도적으로 하지 않는 것들. 미래에 필요해지면 별도 이슈.

| # | 항목 | 근거 / 향후 |
|---|---|---|
| 1 | 재동의 모달/배너 | 약관 §3 묵시 동의 + 비회원 자유 사용. 명시 재동의 필요한 변경 발생 시 별도 이슈 |
| 2 | 동의 철회 UI | 모든 동의가 필수 → 철회 = 회원 탈퇴와 동치. 향후 선택 동의 도입 시 토글 추가 (`agreed` 컬럼 미리 준비됨) |
| 3 | 마케팅 동의 | 마케팅 발송 안 함. 도입 시 `kind = 'marketing'` 추가 |
| 4 | MDX/리치 콘텐츠 | 마크다운만. 인라인 컴포넌트 임베드 안 함 |
| 5 | 페이지 chrome 동적화 | topNotice/intro/eyebrow는 코드 상수 |
| 6 | 약관 본문 in-place 수정 | `ON CONFLICT DO NOTHING`으로 차단. 오타도 새 version |
| 7 | 다국어 | locale 컬럼 없음. 도입 시 (kind, locale) 단위 분기 |
| 8 | 약관 diff 뷰어 | 시행일 표기로만 안내 |
| 9 | OAuth 가입 시 표시 이름 편집 | profile에서 자동 설정. `/account`에서 변경 가능 |
| 10 | 운영자 약관 관리 UI | 마크다운 PR + 시드 스크립트 |
| 11 | 이메일↔OAuth 계정 통합 | `oauth_email_conflict` 동작 유지 |
| 12 | 동의 변경 audit log | mutable row만 보유. 이력 필요 시 audit 테이블 분리 |

---

## 13. 변경 파일 요약

**신규:**
- `db/scripts/seedTerms.ts`
- `db/seeds/terms/privacy/v1.md`, `db/seeds/terms/tos/v1.md`
- `src/infrastructure/db/termsRepository.ts`
- `src/infrastructure/db/agreementRepository.ts`
- `src/infrastructure/auth/pendingOAuthSignupStore.ts`
- `src/infrastructure/auth/finalizeOAuthSignupAction.ts`
- `src/infrastructure/auth/cancelOAuthSignupAction.ts`
- `src/infrastructure/auth/use-cases/loginExistingOAuthUser.ts`
- `src/infrastructure/auth/use-cases/finalizeOAuthSignup.ts`
- `src/domain/legal/termsKind.ts`
- `src/components/auth/ConsentCheckboxGroup.tsx`
- `src/components/auth/OAuthConsentForm.tsx`
- `src/components/legal/PolicyMarkdownBody.tsx`
- `src/lib/legal-toc.ts`
- `src/app/signup/oauth/consent/page.tsx`
- 테스트 파일들 (위 §10 참조)

**이동:**
- `migrate.ts` → `db/scripts/migrate.ts`

**변경:**
- `package.json` (scripts 경로 갱신 + db:seed:terms 추가)
- `src/infrastructure/db/schema.ts` (terms, agreements, terms_kind enum)
- `src/infrastructure/db/constants.ts` (TERMS_KIND_VALUES)
- `src/infrastructure/auth/registerAction.ts` (동의 검증 + 트랜잭션)
- `src/infrastructure/auth/use-cases/registerUser.ts` (agreedTermsIds)
- `src/app/api/auth/callback/[provider]/route.ts` (신규/기존 분기)
- `src/components/auth/SignupForm.tsx` (details 단계 동의 박스)
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` (DB 렌더링)
- `src/app/login/page.tsx` (에러 메시지 추가)
- `src/app/signup/page.tsx` (안내 문구 추가)
- `src/domain/auth/formTypes.ts` (SignupErrorCode 확장)
- `src/lib/legal.ts` (`LEGAL_EFFECTIVE_DATE` 사용처 정리)

**의존성 추가:**
- `react-markdown`, `remark-gfm`, `rehype-slug`, `gray-matter`
