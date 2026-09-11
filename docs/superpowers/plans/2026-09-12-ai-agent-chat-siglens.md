# ai.siglens.io 에이전트 챗 — Plan B: siglens (P-1 스파이크 → P1 골격 → P2 완성)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ai.siglens.io`에서 회원이 툴 콜링 에이전트와 대화하고 대화가 저장·재개되는 제품을 siglens 앱 안에 붙인다(스펙 R1~R8).

**Architecture:** 호스트 기반 rewrite로 `app/ai/[locale]/*`가 자체 `<html>` 레이아웃을 갖는다. 에이전트 루프·툴 스키마·한도는 core 1.1.0(Plan A), siglens는 프로바이더 어댑터(DeepSeek 기본·Haiku 폴백)·툴 실행기(app 레이어)·SSE writer·Drizzle 저장·UI·인프라를 담당한다. 인증은 ai 호스트에서 host-only 쿠키로 별도 로그인(쿠키 도메인 확장 없음).

**Tech Stack:** Next.js 16 App Router(standalone), React 19, next-intl 4, Drizzle + Neon, Upstash Redis, `openai`·`@anthropic-ai/sdk` SDK, vitest(커버리지 90%), Playwright e2e, oxlint FSD 레이어 규칙, Cloudflare Tunnel. 스펙: `docs/superpowers/specs/2026-09-11-ai-siglens-agent-chat-design.md`.

**전제:** Plan A가 끝나 `@y0ngha/siglens-core@1.1.0`이 GitHub Packages에 실물로 존재한다(tarball 확인). Task 0~1(스파이크)은 core 없이도 가능하다.

**작업 규칙(CLAUDE.md·메모리):** 워크트리에서 작업, 커밋·푸시는 git-agent, 구현 후 review-agent 필수. 테스트는 `yarn test`(npx vitest 금지), 실패 루프는 실패 파일만 지정. 스코프 게이트 = `yarn typecheck` + 스코프 테스트 + `yarn lint`(경고 **수**도 확인). `--no-verify` 금지. 한국어 UI 문자열은 소스에 리터럴로 쓰고 `yarn i18n:extract --write --apply --only <dir>`로 카탈로그화한다(플래그 없으면 스캔만).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/proxy.ts` (수정) | ai 호스트 분기(rewrite·CSP·robots), 메인 `/ai/*` 301, `'ai'` 예약 |
| `src/shared/config/aiHost.ts` (신규) | `AI_HOSTS`·`AI_SITE_URL`·`isAiHost(hostHeader)` |
| `src/app/ai/[locale]/layout.tsx` (신규) | ai 전용 `<html>` 레이아웃 |
| `src/app/ai/[locale]/page.tsx`, `c/[id]/page.tsx`, `not-found.tsx` (신규) | 새 대화·대화·404 |
| `src/app/ai/[locale]/{login,signup,forgot-password,reset-password,signup/oauth/consent}/page.tsx` (신규) | 메인 인증 페이지 re-export |
| `src/entities/llm-provider/lib/serverKeys.ts` (신규) | `getServerPrimaryKey` (chatAction에서 이동) |
| `src/entities/llm-provider/api/agent/{deepseek,anthropic,router,fake,mapMessages}.ts` (신규) | 에이전트 어댑터·폴백 라우터·E2E fake |
| `src/shared/db/schema.ts` (수정) + `drizzle/0035_*.sql` | `chat_conversations`·`chat_messages` |
| `src/entities/chat-conversation/{model.ts,api.ts,index.ts,actions/*.ts}` (신규) | 리포지토리·서버 액션 |
| `src/shared/lib/sse/activeStreams.ts` (수정) | `registerActiveStream()` |
| `src/app/api/ai/chat/{turnLock.ts,agentEventStream.ts,counters.ts,resolveAgentModel.ts}` (신규) | 락·SSE writer·카운터 조립·모델 게이트 |
| `src/app/api/ai/chat/tools/{index.ts,truncate.ts,searchTicker.ts,getQuote.ts,getBarsIndicators.ts,getCachedAnalysis.ts,getNews.ts,getOptionsSummary.ts,runFreshAnalysis.ts,webSearch.ts}` (신규) | 툴 실행기 |
| `src/app/api/ai/chat/stream/route.ts` (신규) | SSE 라우트 |
| `src/features/agent-chat/hooks/useAgentStream.ts`, `lib/parseSseFrames.ts` (신규) | 클라이언트 스트림 소비 |
| `src/widgets/agent-chat/*` (신규) | ChatShell·Sidebar·MessageList·Composer·ToolActivity·EmptyState·AgentMarkdown |
| `src/features/auth-oauth/lib/providers.ts` (수정) | 요청 origin 기반 redirect base(허용목록) |
| `infra/aws/{07-alarms.sh,check-env.sh}`, `.env.example` (수정) | 알람·env |
| `e2e/specs/agent-chat.spec.ts` (신규) | e2e |
| `docs/reference/API.md`, `docs/architecture/DEPLOY_RUNBOOK.md`, `src/app/[locale]/privacy` 본문 (수정) | 문서·고지 |

---

### Task 0: 워크트리·의존성 셋업

- [ ] **Step 1: 워크트리**

```bash
cd /Users/y0ngha/Project/siglens
git fetch origin master
git worktree add .claude/worktrees/agent-chat -b feat/agent-chat origin/master
cd .claude/worktrees/agent-chat
```

- [ ] **Step 2: node_modules 하드링크** (메모리: symlink 금지, 대상이 있으면 중첩되므로 부재 확인 후 `/.` 붙여 복사)

```bash
test ! -e node_modules && cp -al /Users/y0ngha/Project/siglens/node_modules/. node_modules
ls node_modules/node_modules 2>/dev/null && echo "NESTED — rm -rf node_modules and redo" || echo ok
```

- [ ] **Step 3: 기준선**

Run: `yarn typecheck && yarn lint 2>&1 | tail -3`
Expected: 0 errors. 경고 수를 메모해 둔다(이후 늘지 않아야 함).

---

### Task 1 (P-1 스파이크): 형제 `<html>` 레이아웃이 standalone 빌드를 통과하는지

**Files:**
- Create: `src/app/ai/[locale]/layout.tsx` (최소)
- Create: `src/app/ai/[locale]/page.tsx` (최소)

- [ ] **Step 1: 최소 레이아웃·페이지**

```tsx
// src/app/ai/[locale]/layout.tsx
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import '../../globals.css';

export const dynamic = 'force-dynamic';

export default async function AiRootLayout({
    children,
    params,
}: {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    return (
        <html lang={LOCALE_HREFLANG[locale]} className="h-full antialiased scheme-dark">
            <body className="flex min-h-full flex-col">{children}</body>
        </html>
    );
}
```

```tsx
// src/app/ai/[locale]/page.tsx
export default function AiHomePage() {
    return <main className="p-4">ai spike</main>;
}
```

- [ ] **Step 2: 오프라인 프로덕션 빌드**

Run: `SIGLENS_OFFLINE_BUILD=1 UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= UPSTASH_REDIS_REST_READONLY_TOKEN= yarn build; echo "exit=$?"`
(파이프 없이 exit code를 본다 — 메모리.)
Expected: `exit=0`, 빌드 라우트 표에 `/ai/[locale]`이 `ƒ (Dynamic)`로 표시.

- [ ] **Step 3: standalone 실기동**

```bash
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
PORT=3999 node .next/standalone/server.js &
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/ai/ko      # 200
curl -s http://localhost:3999/ai/ko | grep -c '<html'                   # 1 (html이 한 번만)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/ko         # 200 (기존 트리 무영향)
kill %1
```

- [ ] **Step 4: go/no-go 기록**

통과 → `docs/superpowers/specs/2026-09-11-ai-siglens-agent-chat-design.md` §16-1 옆에 `(검증 완료 2026-09-XX: 빌드·실기동 통과)` 한 줄 추가. 실패 → 이 계획을 중단하고 스펙 §16-1의 대안(다중 루트 레이아웃)으로 재계획한다.

- [ ] **Step 5: Commit** — `chore(ai): 형제 html 레이아웃 스파이크(빌드·실기동 통과)`

---

### Task 2: core 1.1.0 bump

- [ ] **Step 1: 버전 고정**

`package.json`의 `"@y0ngha/siglens-core": "1.0.4"` → `"1.1.0"`. Run: `yarn install` (워크트리 안에서. 하드링크 node_modules는 이 시점에 자기 것으로 갈라진다 — 메모리 "워크트리 core 버전 불일치 트랩").

- [ ] **Step 2: 확인**

Run: `node -e "const c=require('@y0ngha/siglens-core');console.log(typeof c.runAgentTurn, c.AGENT_TOOL_SPECS.length)"`
Expected: `function 8`

- [ ] **Step 3: Commit** — `chore(deps): siglens-core 1.1.0 (agent loop)`

---

### Task 3: proxy 호스트 분기·robots·CSP·`'ai'` 예약

**Files:**
- Create: `src/shared/config/aiHost.ts`
- Modify: `src/proxy.ts`
- Test: `src/app/__tests__/proxy.aiHost.test.ts`

- [ ] **Step 1: 테스트** (기존 `proxy.test.ts`의 mock 방식 그대로)

```ts
// src/app/__tests__/proxy.aiHost.test.ts
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

vi.mock('@/shared/config/cookieNames', () => ({ AUTH_SESSION_COOKIE_NAME: 'siglens_session' }));
const { mockIntlMiddleware } = vi.hoisted(() => ({ mockIntlMiddleware: vi.fn(() => ({ type: 'intl' })) }));
vi.mock('next-intl/middleware', () => ({ default: () => mockIntlMiddleware }));
vi.mock('next/server', () => {
    class FakeResponse {
        headers = new Headers();
        constructor(public body: string, init?: { headers?: Record<string, string> }) {
            for (const [k, v] of Object.entries(init?.headers ?? {})) this.headers.set(k, v);
        }
    }
    return {
        NextResponse: Object.assign(FakeResponse, {
            redirect: vi.fn((url: URL, status?: number) => ({ type: 'redirect', url, status, headers: new Headers() })),
            next: vi.fn(() => ({ type: 'next', headers: new Headers() })),
            rewrite: vi.fn((url: URL) => ({ type: 'rewrite', url, headers: new Headers() })),
        }),
    };
});

import { NextResponse, type NextRequest } from 'next/server';
import { proxy, RESERVED_FIRST_SEGMENTS } from '@/proxy';

const mockRedirect = NextResponse.redirect as MockedFunction<typeof NextResponse.redirect>;
const mockRewrite = NextResponse.rewrite as MockedFunction<typeof NextResponse.rewrite>;
const mockNext = NextResponse.next as MockedFunction<typeof NextResponse.next>;

function makeRequest(host: string, path: string): NextRequest {
    return {
        url: `https://${host}${path}`,
        headers: new Headers({ host }),
        cookies: { get: () => undefined },
    } as unknown as NextRequest;
}

describe('proxy — ai host', () => {
    beforeEach(() => vi.clearAllMocks());

    it('루트를 /ai/{locale}로 rewrite하고 CSP·noindex 헤더를 붙인다', () => {
        const res = proxy(makeRequest('ai.siglens.io', '/')) as unknown as { headers: Headers };
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
        expect(res.headers.get('content-security-policy')).toBe("img-src 'self' data:");
        expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    });

    it('로케일 접두 경로는 로케일을 유지한다', () => {
        proxy(makeRequest('ai.siglens.io', '/en/c/abc'));
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/en/c/abc');
    });

    it('dev 호스트 ai.localhost:3000도 ai 호스트다', () => {
        proxy(makeRequest('ai.localhost:3000', '/'));
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
    });

    it('robots.txt는 Disallow 본문을 직접 반환한다', () => {
        const res = proxy(makeRequest('ai.siglens.io', '/robots.txt')) as unknown as { body: string; headers: Headers };
        expect(res.body).toBe('User-agent: *\nDisallow: /\n');
        expect(mockRewrite).not.toHaveBeenCalled();
    });

    it('메인 호스트의 robots.txt는 next()로 통과한다', () => {
        proxy(makeRequest('siglens.io', '/robots.txt'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });

    it('메인 호스트의 /ai/* 는 ai 호스트로 301', () => {
        proxy(makeRequest('siglens.io', '/ai/ko/c/abc'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/ko/c/abc');
        expect(status).toBe(301);
    });

    it("'ai'는 예약 세그먼트다(대문자 티커 정규화 대상 아님)", () => {
        expect(RESERVED_FIRST_SEGMENTS.has('ai')).toBe(true);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/__tests__/proxy.aiHost.test.ts` → FAIL (`RESERVED_FIRST_SEGMENTS` 미export 등).

- [ ] **Step 3: 구현**

```ts
// src/shared/config/aiHost.ts
/** Hosts served by the ai.siglens.io subtree. Port-suffixed dev host included. */
export const AI_HOSTS: ReadonlySet<string> = new Set(['ai.siglens.io', 'ai.localhost']);

export const AI_SITE_URL =
    process.env.NEXT_PUBLIC_AI_SITE_URL ?? 'https://ai.siglens.io';

/** `host` header may carry a port in dev (`ai.localhost:3000`). */
export function isAiHost(hostHeader: string | null): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.toLowerCase().split(':')[0] ?? '';
    return AI_HOSTS.has(host);
}
```

`src/proxy.ts` 변경:

1. import 추가: `import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';`
2. `const RESERVED_FIRST_SEGMENTS` → `export const RESERVED_FIRST_SEGMENTS`, 목록에 `'ai',` 추가.
3. 상수·헬퍼 추가(파일 상단, `proxy` 함수 앞):

```ts
const AI_CSP = "img-src 'self' data:";
const AI_ROBOTS_BODY = 'User-agent: *\nDisallow: /\n';

function handleAiHost(req: NextRequest): NextResponse {
    const url = new URL(req.url);
    if (url.pathname === '/robots.txt') {
        return new NextResponse(AI_ROBOTS_BODY, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    const { locale, path } = splitLocalePath(url.pathname);
    const rewriteUrl = new URL(url);
    rewriteUrl.pathname = `/ai/${locale}${path === '/' ? '' : path}`;
    const headers = new Headers(req.headers);
    headers.set('X-NEXT-INTL-LOCALE', locale);
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers } });
    response.headers.set('Content-Security-Policy', AI_CSP);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
}
```

4. `proxy()` 본문 **첫 줄**(`const hasSession` 앞)에:

```ts
    if (isAiHost(req.headers.get('host') ?? req.headers.get('x-forwarded-host'))) {
        return handleAiHost(req);
    }
    if (new URL(req.url).pathname === '/robots.txt') {
        return NextResponse.next();
    }
```

5. 메인 호스트 `/ai/*` 301 — `const firstSegment = ...` 계산 직후, 대문자 정규화 분기보다 **앞**에:

```ts
    if (firstSegment?.toLowerCase() === 'ai') {
        const rest = pathname.replace(/^\/ai(?=\/|$)/i, '') || '/';
        return NextResponse.redirect(new URL(`${localePath(locale, rest)}${reqUrl.search}`, AI_SITE_URL), 301);
    }
```

6. `config.matcher` 배열에 `'/robots.txt'` 항목 추가(기존 정규식은 그대로).

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/__tests__/proxy.aiHost.test.ts src/app/__tests__/proxy.test.ts` → PASS. 기존 proxy.test의 `RESERVED` 동기화 가드는 `src/app/[locale]`만 보므로 `'ai'` 추가로 깨지지 않는다.

- [ ] **Step 5: Commit** — `feat(proxy): ai 호스트 rewrite·robots·CSP, 메인 /ai 301, 'ai' 예약`

---

### Task 4: 서버 키 헬퍼 이동

**Files:**
- Create: `src/entities/llm-provider/lib/serverKeys.ts`
- Modify: `src/entities/chat-message/actions/chatAction.ts` (로컬 `getServerPrimaryKey` 삭제, import)
- Modify: `src/entities/llm-provider/index.ts` (export)
- Test: `src/entities/llm-provider/__tests__/lib/serverKeys.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/entities/llm-provider/__tests__/lib/serverKeys.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { getServerPrimaryKey } from '@/entities/llm-provider/lib/serverKeys';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('getServerPrimaryKey', () => {
    it('provider별 *_CHAT_API_KEY를 읽는다', () => {
        process.env.DEEPSEEK_CHAT_API_KEY = 'd';
        process.env.ANTHROPIC_CHAT_API_KEY = 'a';
        expect(getServerPrimaryKey('deepseek')).toBe('d');
        expect(getServerPrimaryKey('anthropic')).toBe('a');
    });
    it('없으면 undefined', () => {
        delete process.env.OPENAI_CHAT_API_KEY;
        expect(getServerPrimaryKey('openai')).toBeUndefined();
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

```ts
// src/entities/llm-provider/lib/serverKeys.ts
import 'server-only';
import type { LlmProvider } from '@y0ngha/siglens-core';

/**
 * Server-owned key per provider. Charged for free models (any tier) and
 * pro-tier premium models; BYOK requests use the user's key instead.
 * All four are provisioned in SSM and required by `infra/aws/check-env.sh`.
 */
export function getServerPrimaryKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        case 'deepseek':
            return process.env.DEEPSEEK_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}
```

`chatAction.ts`: 로컬 `function getServerPrimaryKey` 블록(JSDoc 포함)을 삭제하고 `import { getServerPrimaryKey } from '@/entities/llm-provider/lib/serverKeys';`를 추가한다(같은 entities 레이어 간 cross-import는 허용 규칙). `entities/llm-provider/index.ts`에 `export { getServerPrimaryKey } from './lib/serverKeys';` 추가.

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/entities/llm-provider src/entities/chat-message && yarn typecheck` → PASS.

- [ ] **Step 5: Commit** — `refactor(llm-provider): 서버 키 헬퍼를 lib/serverKeys로 이동`

---

### Task 5: 에이전트 프로바이더 어댑터(DeepSeek·Anthropic)·폴백 라우터·fake

**Files:**
- Create: `src/entities/llm-provider/api/agent/mapMessages.ts`
- Create: `src/entities/llm-provider/api/agent/deepseek.ts`
- Create: `src/entities/llm-provider/api/agent/anthropic.ts`
- Create: `src/entities/llm-provider/api/agent/router.ts`
- Create: `src/entities/llm-provider/api/agent/fake.ts`
- Create: `src/entities/llm-provider/api/agent/index.ts`
- Test: `src/entities/llm-provider/__tests__/api/agent/{mapMessages,deepseek,anthropic,router,fake}.test.ts`

- [ ] **Step 1: 메시지 매핑 테스트**

```ts
// src/entities/llm-provider/__tests__/api/agent/mapMessages.test.ts
import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@y0ngha/siglens-core';
import { toAnthropicMessages, toOpenAiChatMessages, withAgentCacheBreakpoints } from '@/entities/llm-provider/api/agent/mapMessages';

const call = { id: 'c1', name: 'get_quote', args: { symbols: ['AAPL'] } };
const call2 = { id: 'c2', name: 'get_news', args: { symbol: 'AAPL' } };
const history: AgentMessage[] = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: '', toolCalls: [call, call2] },
    { role: 'tool', content: '{"price":1}', toolCallId: 'c1', toolName: 'get_quote' },
    { role: 'tool', content: '[]', toolCallId: 'c2', toolName: 'get_news' },
    { role: 'assistant', content: 'done' },
];

describe('toOpenAiChatMessages', () => {
    it('tool_calls·tool 메시지로 매핑한다', () => {
        expect(toOpenAiChatMessages(history)).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: null, tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'get_quote', arguments: '{"symbols":["AAPL"]}' } },
                { id: 'c2', type: 'function', function: { name: 'get_news', arguments: '{"symbol":"AAPL"}' } },
            ] },
            { role: 'tool', tool_call_id: 'c1', content: '{"price":1}' },
            { role: 'tool', tool_call_id: 'c2', content: '[]' },
            { role: 'assistant', content: 'done' },
        ]);
    });
});

describe('toAnthropicMessages', () => {
    it('연속 tool 결과를 하나의 user 메시지로 합친다(병렬 호출 규칙)', () => {
        const out = toAnthropicMessages(history);
        expect(out).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: [
                { type: 'tool_use', id: 'c1', name: 'get_quote', input: { symbols: ['AAPL'] } },
                { type: 'tool_use', id: 'c2', name: 'get_news', input: { symbol: 'AAPL' } },
            ] },
            { role: 'user', content: [
                { type: 'tool_result', tool_use_id: 'c1', content: '{"price":1}' },
                { type: 'tool_result', tool_use_id: 'c2', content: '[]' },
            ] },
            { role: 'assistant', content: 'done' },
        ]);
    });
    it('assistant 텍스트+툴은 text 블록을 앞에 둔다', () => {
        const out = toAnthropicMessages([{ role: 'assistant', content: '확인할게요', toolCalls: [call] }]);
        expect(out[0].content).toEqual([
            { type: 'text', text: '확인할게요' },
            { type: 'tool_use', id: 'c1', name: 'get_quote', input: { symbols: ['AAPL'] } },
        ]);
    });
});

describe('withAgentCacheBreakpoints', () => {
    it('마지막 직전 메시지의 마지막 블록에 cache_control을 단다(문자열·블록 모두)', () => {
        const out = withAgentCacheBreakpoints(toAnthropicMessages(history));
        const target = out[out.length - 2];
        expect(Array.isArray(target.content)).toBe(true);
        const blocks = target.content as Array<Record<string, unknown>>;
        expect(blocks[blocks.length - 1].cache_control).toEqual({ type: 'ephemeral' });
        expect(out[0].content).toBe('q');
    });
    it('메시지 1개면 그대로', () => {
        const single = toAnthropicMessages([{ role: 'user', content: 'q' }]);
        expect(withAgentCacheBreakpoints(single)).toBe(single);
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 매핑 구현**

```ts
// src/entities/llm-provider/api/agent/mapMessages.ts
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

const EPHEMERAL = { type: 'ephemeral' } as const;

export function toOpenAiChatMessages(
    messages: readonly AgentMessage[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(m => {
        if (m.role === 'tool') {
            return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            return {
                role: 'assistant',
                content: m.content || null,
                tool_calls: m.toolCalls.map(c => ({
                    id: c.id,
                    type: 'function' as const,
                    function: { name: c.name, arguments: JSON.stringify(c.args) },
                })),
            };
        }
        return { role: m.role, content: m.content };
    });
}

/**
 * Anthropic requires strict user/assistant alternation and every
 * `tool_result` for a parallel batch inside ONE user message, so consecutive
 * tool messages are merged.
 */
export function toAnthropicMessages(
    messages: readonly AgentMessage[]
): Anthropic.MessageParam[] {
    const out: Anthropic.MessageParam[] = [];
    for (const m of messages) {
        if (m.role === 'tool') {
            const block: Anthropic.ToolResultBlockParam = {
                type: 'tool_result',
                tool_use_id: m.toolCallId ?? '',
                content: m.content,
            };
            const last = out[out.length - 1];
            if (last && last.role === 'user' && Array.isArray(last.content)) {
                (last.content as Anthropic.ContentBlockParam[]).push(block);
            } else {
                out.push({ role: 'user', content: [block] });
            }
            continue;
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            const blocks: Anthropic.ContentBlockParam[] = [];
            if (m.content) blocks.push({ type: 'text', text: m.content });
            for (const c of m.toolCalls) {
                blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
            }
            out.push({ role: 'assistant', content: blocks });
            continue;
        }
        out.push({ role: m.role, content: m.content });
    }
    return out;
}

/**
 * Cache breakpoint on the last block of the second-to-last message so the
 * whole conversation prefix up to the previous turn is reused. Unlike the
 * chat helper (`withHistoryCacheBreakpoint`) this handles block content —
 * agent history is mostly tool_use/tool_result blocks.
 */
export function withAgentCacheBreakpoints(
    messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
    if (messages.length < 2) return messages;
    const index = messages.length - 2;
    const target = messages[index];
    const blocks: Anthropic.ContentBlockParam[] =
        typeof target.content === 'string'
            ? [{ type: 'text', text: target.content }]
            : [...(target.content as Anthropic.ContentBlockParam[])];
    const last = blocks[blocks.length - 1];
    blocks[blocks.length - 1] = { ...last, cache_control: EPHEMERAL } as Anthropic.ContentBlockParam;
    return messages.map((m, i) => (i === index ? { role: m.role, content: blocks } : m));
}
```

- [ ] **Step 4: 매핑 테스트 통과** — Run: `yarn test src/entities/llm-provider/__tests__/api/agent/mapMessages.test.ts` → PASS.

- [ ] **Step 5: DeepSeek 어댑터 테스트** (SDK mock; 스트림 청크는 §14-B1 프로브 실측 shape)

```ts
// src/entities/llm-provider/__tests__/api/agent/deepseek.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const create = vi.fn();
    const ctor = vi.fn(() => ({ chat: { completions: { create } } }));
    return { mockCreate: create, MockOpenAI: ctor };
});
vi.mock('openai', () => ({ default: MockOpenAI }));

import { callDeepseekAgent } from '@/entities/llm-provider/api/agent/deepseek';
import { AGENT_TOOL_SPECS, type AgentStreamEvent } from '@y0ngha/siglens-core';

async function* chunks(items: unknown[]) { for (const i of items) yield i; }

// 실측(2026-09-11 프로브): tool_calls 델타는 index로 누적, 마지막 청크에 usage.
const TOOL_STREAM = [
    { choices: [{ delta: { role: 'assistant', content: '' } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_00_x', type: 'function', function: { name: 'get_quote', arguments: '' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"symbol' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 's": ["AAPL"]}' } }] } }] },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 284, completion_tokens: 39, prompt_cache_hit_tokens: 128, prompt_cache_miss_tokens: 156 } },
];

function opts(overrides = {}) {
    return {
        apiKey: 'k', apiModelId: 'deepseek-flash', model: 'deepseek-v4.1-flash' as const,
        system: 'sys', messages: [{ role: 'user' as const, content: 'AAPL?' }],
        tools: AGENT_TOOL_SPECS.filter(t => t.name === 'get_quote'),
        maxOutputTokens: 4096, signal: new AbortController().signal,
        onEvent: vi.fn<(e: AgentStreamEvent) => void>(),
        ...overrides,
    };
}

describe('callDeepseekAgent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('tool_calls 스트림을 누적해 toolCalls·stopReason tool_use를 돌려준다', async () => {
        mockCreate.mockResolvedValue(chunks(TOOL_STREAM));
        const o = opts();
        const r = await callDeepseekAgent(o);
        expect(r.toolCalls).toEqual([{ id: 'call_00_x', name: 'get_quote', args: { symbols: ['AAPL'] } }]);
        expect(r.stopReason).toBe('tool_use');
        expect(r.usage).toEqual({ promptTokens: 156, cachedTokens: 128, cacheWriteTokens: 0, outputTokens: 39 });
        expect(o.onEvent).toHaveBeenCalledWith({ type: 'tool_call', call: r.toolCalls[0] });
        const params = mockCreate.mock.calls[0]![0];
        expect(params.model).toBe('deepseek-flash');
        expect(params.thinking).toEqual({ type: 'disabled' });
        expect(params.tools[0]).toEqual({ type: 'function', function: { name: 'get_quote', description: expect.any(String), parameters: expect.objectContaining({ type: 'object' }) } });
        expect(params.stream).toBe(true);
        expect(mockCreate.mock.calls[0]![1]).toEqual({ signal: o.signal });
    });

    it('텍스트 델타를 onEvent로 흘리고 end로 끝난다', async () => {
        mockCreate.mockResolvedValue(chunks([
            { choices: [{ delta: { content: '231' } }] },
            { choices: [{ delta: { content: '.42' } }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
            { choices: [], usage: { prompt_tokens: 10, completion_tokens: 3 } },
        ]));
        const o = opts();
        const r = await callDeepseekAgent(o);
        expect(r.text).toBe('231.42');
        expect(r.stopReason).toBe('end');
        expect(o.onEvent).toHaveBeenCalledWith({ type: 'text', delta: '231' });
    });

    it('length → max_tokens, 깨진 인자 JSON은 {}', async () => {
        mockCreate.mockResolvedValue(chunks([
            { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'get_quote', arguments: '{bad' } }] } }] },
            { choices: [{ delta: {}, finish_reason: 'length' }] },
        ]));
        const r = await callDeepseekAgent(opts());
        expect(r.stopReason).toBe('max_tokens');
        expect(r.toolCalls[0].args).toEqual({});
    });
});
```

- [ ] **Step 6: DeepSeek 어댑터 구현**

```ts
// src/entities/llm-provider/api/agent/deepseek.ts
import 'server-only';
import OpenAI from 'openai';
import type { AgentProviderResult, AgentStopReason, AgentToolCall, CallAgentProviderOptions } from '@y0ngha/siglens-core';
import { extractDeepSeekUsage, logUsage, type DeepSeekUsageLike } from '../../lib/usage';
import { toOpenAiChatMessages } from './mapMessages';

export const AGENT_JOB_ID = 'agent';

export type AgentAdapterOptions = CallAgentProviderOptions & { apiModelId: string };

function mapStopReason(reason: string | null | undefined): AgentStopReason {
    switch (reason) {
        case 'tool_calls': return 'tool_use';
        case 'stop': return 'end';
        case 'length': return 'max_tokens';
        default: return 'other';
    }
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(raw || '{}');
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** DeepSeek via the OpenAI-compatible chat.completions stream; thinking OFF (spec §2-6). */
export async function callDeepseekAgent(o: AgentAdapterOptions): Promise<AgentProviderResult> {
    const client = new OpenAI({ apiKey: o.apiKey, baseURL: 'https://api.deepseek.com' });
    const startedAt = Date.now();
    const stream = await client.chat.completions.create(
        {
            model: o.apiModelId,
            messages: [{ role: 'system', content: o.system }, ...toOpenAiChatMessages(o.messages)],
            ...(o.tools.length > 0
                ? { tools: o.tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } })), tool_choice: 'auto' as const }
                : {}),
            max_tokens: o.maxOutputTokens,
            temperature: 0,
            // DeepSeek-specific top-level field; not in the openai SDK types.
            ...({ thinking: { type: 'disabled' } } as Record<string, unknown>),
            stream: true,
            stream_options: { include_usage: true },
        },
        { signal: o.signal }
    );

    let text = '';
    let finish: string | null | undefined;
    let usage: DeepSeekUsageLike | undefined;
    const partial = new Map<number, { id: string; name: string; args: string }>();
    for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (delta?.content) {
            text += delta.content;
            o.onEvent({ type: 'text', delta: delta.content });
        }
        for (const tc of delta?.tool_calls ?? []) {
            const slot = partial.get(tc.index) ?? { id: '', name: '', args: '' };
            if (tc.id) slot.id = tc.id;
            if (tc.function?.name) slot.name += tc.function.name;
            if (tc.function?.arguments) slot.args += tc.function.arguments;
            partial.set(tc.index, slot);
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (chunk.usage) usage = chunk.usage as DeepSeekUsageLike;
    }

    const toolCalls: AgentToolCall[] = [...partial.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, slot]) => ({ id: slot.id, name: slot.name, args: parseArgs(slot.args) }));
    for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });

    const normalized = extractDeepSeekUsage(usage);
    logUsage({ jobId: AGENT_JOB_ID, model: o.apiModelId, latencyMs: Date.now() - startedAt, ...normalized });
    o.onEvent({ type: 'usage', usage: normalized });
    const stopReason = toolCalls.length > 0 && finish === 'tool_calls' ? 'tool_use' : mapStopReason(finish);
    o.onEvent({ type: 'stop', reason: stopReason });
    return { text, toolCalls, stopReason, usage: normalized };
}
```

- [ ] **Step 7: DeepSeek 테스트 통과** — Run: `yarn test src/entities/llm-provider/__tests__/api/agent/deepseek.test.ts` → PASS.

- [ ] **Step 8: Anthropic 어댑터 테스트**

```ts
// src/entities/llm-provider/__tests__/api/agent/anthropic.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStream, MockAnthropic } = vi.hoisted(() => {
    const stream = vi.fn();
    const ctor = vi.fn(() => ({ messages: { stream } }));
    return { mockStream: stream, MockAnthropic: ctor };
});
vi.mock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));

import { callAnthropicAgent } from '@/entities/llm-provider/api/agent/anthropic';
import { AGENT_TOOL_SPECS, type AgentStreamEvent } from '@y0ngha/siglens-core';

// 실측(2026-09-11 프로브): stop_reason 'tool_use', input_json_delta 4건, finalMessage에 파싱된 input.
function fakeStream(final: unknown, deltas: Array<{ type: string; text?: string; partial_json?: string }>) {
    const handlers: Record<string, Array<(e: unknown) => void>> = {};
    const s = {
        on(event: string, fn: (e: unknown) => void) { (handlers[event] ??= []).push(fn); return s; },
        async finalMessage() {
            for (const d of deltas) for (const fn of handlers.streamEvent ?? []) fn({ type: 'content_block_delta', index: 0, delta: d });
            return final;
        },
    };
    return s;
}

function opts(overrides = {}) {
    return {
        apiKey: 'k', apiModelId: 'claude-haiku-4-5-20251001', model: 'claude-haiku-4-5' as const,
        system: 'sys', messages: [{ role: 'user' as const, content: 'AAPL?' }],
        tools: AGENT_TOOL_SPECS.filter(t => t.name === 'get_quote'),
        maxOutputTokens: 4096, signal: new AbortController().signal,
        onEvent: vi.fn<(e: AgentStreamEvent) => void>(),
        ...overrides,
    };
}

describe('callAnthropicAgent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('tool_use 블록을 toolCalls로, 시스템·툴에 cache_control', async () => {
        mockStream.mockReturnValue(fakeStream({
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_quote', input: { symbols: ['AAPL'] } }],
            usage: { input_tokens: 591, output_tokens: 57, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        }, [{ type: 'input_json_delta', partial_json: '{"symbols":' }, { type: 'input_json_delta', partial_json: '["AAPL"]}' }]));
        const o = opts();
        const r = await callAnthropicAgent(o);
        expect(r.toolCalls).toEqual([{ id: 'toolu_1', name: 'get_quote', args: { symbols: ['AAPL'] } }]);
        expect(r.stopReason).toBe('tool_use');
        expect(r.usage.promptTokens).toBe(591);
        const params = mockStream.mock.calls[0]![0];
        expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
        expect(params.tools[0].cache_control).toEqual({ type: 'ephemeral' });
        expect(params.tools[0].input_schema.type).toBe('object');
        expect(params.max_tokens).toBe(4096);
        expect(params.thinking).toBeUndefined(); // haiku = budget 모델, thinking 파라미터 없음
        expect(mockStream.mock.calls[0]![1]).toEqual({ signal: o.signal });
    });

    it('text_delta를 스트리밍하고 end_turn → end', async () => {
        mockStream.mockReturnValue(fakeStream({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: '231.42' }],
            usage: { input_tokens: 10, output_tokens: 3 },
        }, [{ type: 'text_delta', text: '231' }, { type: 'text_delta', text: '.42' }]));
        const o = opts();
        const r = await callAnthropicAgent(o);
        expect(r.text).toBe('231.42');
        expect(r.stopReason).toBe('end');
        expect(o.onEvent).toHaveBeenCalledWith({ type: 'text', delta: '231' });
    });

    it('adaptive 모델(sonnet)은 thinking disabled를 보낸다', async () => {
        mockStream.mockReturnValue(fakeStream({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 1, output_tokens: 1 } }, []));
        await callAnthropicAgent(opts({ apiModelId: 'claude-sonnet-5', model: 'claude-sonnet-5' }));
        expect(mockStream.mock.calls[0]![0].thinking).toEqual({ type: 'disabled' });
    });
});
```

- [ ] **Step 9: Anthropic 어댑터 구현**

```ts
// src/entities/llm-provider/api/agent/anthropic.ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentProviderResult, AgentStopReason, AgentToolCall } from '@y0ngha/siglens-core';
import { isClaudeAdaptiveModelSpec, resolveReasoningConfig } from '@y0ngha/siglens-core';
import { findSpecByApiModelId } from '../../lib/utils';
import { extractClaudeUsage, logUsage } from '../../lib/usage';
import { toAnthropicMessages, withAgentCacheBreakpoints } from './mapMessages';
import { AGENT_JOB_ID, type AgentAdapterOptions } from './deepseek';

const EPHEMERAL = { type: 'ephemeral' } as const;

function mapStopReason(reason: string | null | undefined): AgentStopReason {
    switch (reason) {
        case 'tool_use': return 'tool_use';
        case 'end_turn': case 'stop_sequence': return 'end';
        case 'max_tokens': return 'max_tokens';
        default: return 'other';
    }
}

/** Claude via messages.stream; reasoning OFF (adaptive → `thinking: disabled`, budget → omitted). */
export async function callAnthropicAgent(o: AgentAdapterOptions): Promise<AgentProviderResult> {
    const spec = findSpecByApiModelId(o.apiModelId);
    if (!spec) throw new Error(`Unknown model: ${o.apiModelId}`);
    const adaptive = isClaudeAdaptiveModelSpec(spec);
    const reasoning = adaptive ? resolveReasoningConfig(spec.reasoning, false) : undefined;
    const client = new Anthropic({ apiKey: o.apiKey });
    const startedAt = Date.now();

    const tools: Anthropic.Tool[] = o.tools.map((t, i) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        ...(i === o.tools.length - 1 ? { cache_control: EPHEMERAL } : {}),
    }));

    const stream = client.messages.stream(
        {
            model: o.apiModelId,
            max_tokens: o.maxOutputTokens,
            system: [{ type: 'text', text: o.system, cache_control: EPHEMERAL }],
            messages: withAgentCacheBreakpoints(toAnthropicMessages(o.messages)),
            ...(tools.length > 0 ? { tools } : {}),
            ...(reasoning !== undefined
                ? reasoning.mode === 'disabled'
                    ? { thinking: { type: 'disabled' as const } }
                    : { thinking: { type: 'adaptive' as const, display: 'omitted' as const }, output_config: { effort: reasoning.effort } }
                : { temperature: 0 }),
        },
        { signal: o.signal }
    );
    let text = '';
    stream.on('streamEvent', event => {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            text += event.delta.text;
            o.onEvent({ type: 'text', delta: event.delta.text });
        }
    });
    const message = await stream.finalMessage();

    const toolCalls: AgentToolCall[] = message.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(b => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));
    for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });
    if (!text) {
        text = message.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('');
    }
    const usage = extractClaudeUsage(message.usage);
    logUsage({ jobId: AGENT_JOB_ID, model: o.apiModelId, latencyMs: Date.now() - startedAt, ...usage });
    o.onEvent({ type: 'usage', usage });
    const stopReason = mapStopReason(message.stop_reason);
    o.onEvent({ type: 'stop', reason: stopReason });
    return { text, toolCalls, stopReason, usage };
}
```

- [ ] **Step 10: Anthropic 테스트 통과** — Run: `yarn test src/entities/llm-provider/__tests__/api/agent/anthropic.test.ts` → PASS. (`resolveReasoningConfig`가 fable처럼 `hardOff:false`면 `mode:'adaptive'` 분기로 간다 — 기존 chat 어댑터와 같은 규칙.)

- [ ] **Step 11: 라우터(키 해석·apiModelId 변환·Haiku 폴백)·fake 테스트**

```ts
// src/entities/llm-provider/__tests__/api/agent/router.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeepseek, mockAnthropic } = vi.hoisted(() => ({ mockDeepseek: vi.fn(), mockAnthropic: vi.fn() }));
vi.mock('@/entities/llm-provider/api/agent/deepseek', () => ({ callDeepseekAgent: mockDeepseek, AGENT_JOB_ID: 'agent' }));
vi.mock('@/entities/llm-provider/api/agent/anthropic', () => ({ callAnthropicAgent: mockAnthropic }));

import { createAgentProvider } from '@/entities/llm-provider/api/agent/router';
import type { AgentProviderResult } from '@y0ngha/siglens-core';

const OK: AgentProviderResult = { text: 'ok', toolCalls: [], stopReason: 'end', usage: { promptTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 1 } };
const base = { system: 's', messages: [], tools: [], maxOutputTokens: 100, signal: new AbortController().signal, onEvent: vi.fn(), apiKey: '' };

describe('createAgentProvider', () => {
    beforeEach(() => { vi.clearAllMocks(); process.env.DEEPSEEK_CHAT_API_KEY = 'ds'; process.env.ANTHROPIC_CHAT_API_KEY = 'an'; });

    it('DeepSeek 모델 → apiModelId 변환 + 서버 키', async () => {
        mockDeepseek.mockResolvedValue(OK);
        const provider = createAgentProvider({ model: 'deepseek-v4.1-flash', userApiKey: undefined });
        await provider({ ...base, model: 'deepseek-v4.1-flash' });
        expect(mockDeepseek).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'ds', apiModelId: 'deepseek-flash' }));
    });

    it('BYOK 키가 있으면 그것을 쓴다', async () => {
        mockAnthropic.mockResolvedValue(OK);
        const provider = createAgentProvider({ model: 'claude-opus-5', userApiKey: 'user-key' });
        await provider({ ...base, model: 'claude-opus-5' });
        expect(mockAnthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'user-key', apiModelId: 'claude-opus-5' }));
    });

    it('DeepSeek 5xx → 같은 스텝을 haiku로 1회 재시도하고 fallback 표시', async () => {
        mockDeepseek.mockRejectedValue(Object.assign(new Error('busy'), { status: 503 }));
        mockAnthropic.mockResolvedValue(OK);
        const provider = createAgentProvider({ model: 'deepseek-v4.1-flash', userApiKey: undefined });
        const r = await provider({ ...base, model: 'deepseek-v4.1-flash' });
        expect(mockAnthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'an', apiModelId: 'claude-haiku-4-5-20251001' }));
        expect(r).toEqual(OK);
        expect(provider.usedFallback()).toBe(true);
    });

    it('DeepSeek 4xx(429 제외)는 폴백하지 않는다', async () => {
        mockDeepseek.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
        const provider = createAgentProvider({ model: 'deepseek-v4.1-flash', userApiKey: undefined });
        await expect(provider({ ...base, model: 'deepseek-v4.1-flash' })).rejects.toThrow('bad');
        expect(mockAnthropic).not.toHaveBeenCalled();
    });

    it('서버 키 없음 → throw', async () => {
        delete process.env.DEEPSEEK_CHAT_API_KEY;
        const provider = createAgentProvider({ model: 'deepseek-v4.1-flash', userApiKey: undefined });
        await expect(provider({ ...base, model: 'deepseek-v4.1-flash' })).rejects.toThrow(/No API key/);
    });

    it('P3 전 프로바이더(openai/google)는 명시적으로 거부', async () => {
        const provider = createAgentProvider({ model: 'gpt-5.6-luna', userApiKey: undefined });
        await expect(provider({ ...base, model: 'gpt-5.6-luna' })).rejects.toThrow(/not supported/);
    });
});
```

```ts
// src/entities/llm-provider/__tests__/api/agent/fake.test.ts
import { describe, expect, it, vi } from 'vitest';
import { fakeAgentProvider } from '@/entities/llm-provider/api/agent/fake';

const base = { apiKey: '', model: 'deepseek-v4.1-flash' as const, system: 's', tools: [], maxOutputTokens: 100, signal: new AbortController().signal };

describe('fakeAgentProvider', () => {
    it('대문자 심볼이 있고 아직 툴 결과가 없으면 get_quote를 1회 호출한다', async () => {
        const onEvent = vi.fn();
        const r = await fakeAgentProvider({ ...base, onEvent, messages: [{ role: 'user', content: 'AAPL 얼마야' }] });
        expect(r.stopReason).toBe('tool_use');
        expect(r.toolCalls).toEqual([{ id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } }]);
    });
    it('툴 결과가 있으면 결정적 텍스트로 답한다', async () => {
        const onEvent = vi.fn();
        const r = await fakeAgentProvider({ ...base, onEvent, messages: [
            { role: 'user', content: 'AAPL 얼마야' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } }] },
            { role: 'tool', content: '{"price":1}', toolCallId: 'fake_1', toolName: 'get_quote' },
        ] });
        expect(r.stopReason).toBe('end');
        expect(r.text).toContain('[E2E agent]');
        expect(onEvent).toHaveBeenCalledWith({ type: 'text', delta: expect.stringContaining('[E2E agent]') });
    });
});
```

- [ ] **Step 12: 라우터·fake·index 구현**

```ts
// src/entities/llm-provider/api/agent/router.ts
import 'server-only';
import type { AgentProviderResult, CallAgentProvider, CallAgentProviderOptions, ModelId } from '@y0ngha/siglens-core';
import { MODEL_SPECS, classifyProviderError, getProviderForModel } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import { getServerPrimaryKey } from '../../lib/serverKeys';
import { callAnthropicAgent } from './anthropic';
import { callDeepseekAgent, type AgentAdapterOptions } from './deepseek';

/** Server-paid fallback when the DeepSeek call fails transiently (spec §5). */
export const FALLBACK_MODEL: ModelId = 'claude-haiku-4-5';

export interface AgentProviderConfig {
    model: ModelId;
    /** BYOK key from `resolveTierAndByok`; server key otherwise. */
    userApiKey: string | undefined;
}

export interface AgentProvider extends CallAgentProvider {
    /** True once a step was served by `FALLBACK_MODEL`. */
    usedFallback(): boolean;
}

function dispatch(model: ModelId, o: AgentAdapterOptions): Promise<AgentProviderResult> {
    const provider = getProviderForModel(model);
    switch (provider) {
        case 'deepseek': return callDeepseekAgent(o);
        case 'anthropic': return callAnthropicAgent(o);
        case 'openai':
        case 'google':
            throw new Error(`[agent-router] provider ${provider} not supported yet (P3)`);
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled provider: ${String(exhausted)}`);
        }
    }
}

function resolveKey(model: ModelId, userApiKey: string | undefined): string {
    const key = userApiKey ?? getServerPrimaryKey(getProviderForModel(model));
    if (key === undefined) throw new Error(`[agent-router] No API key for model: ${model}`);
    return key;
}

function shouldFallback(error: unknown): boolean {
    const code = classifyProviderError(error);
    if (code !== 'server_error') return true; // 429 / 503
    const status = (error as { status?: unknown })?.status;
    return typeof status !== 'number' || status >= 500; // network or 5xx
}

/**
 * Per-turn provider: resolves the effective key once, converts ModelId →
 * apiModelId, and retries a failed DeepSeek step on Haiku with the server key.
 */
export function createAgentProvider(config: AgentProviderConfig): AgentProvider {
    if (!isActiveModelId(config.model)) throw new Error(`[agent-router] Unknown model: ${config.model}`);
    let fallback = false;
    const call = async (o: CallAgentProviderOptions): Promise<AgentProviderResult> => {
        const primary: AgentAdapterOptions = { ...o, apiKey: resolveKey(config.model, config.userApiKey), apiModelId: MODEL_SPECS[config.model].apiModelId };
        try {
            return await dispatch(config.model, primary);
        } catch (error) {
            if (o.signal.aborted || getProviderForModel(config.model) !== 'deepseek' || !shouldFallback(error)) throw error;
            const fallbackKey = getServerPrimaryKey('anthropic');
            if (fallbackKey === undefined) throw error;
            console.warn('[agent-router] deepseek failed, falling back to haiku', { code: classifyProviderError(error) });
            fallback = true;
            return dispatch(FALLBACK_MODEL, { ...o, apiKey: fallbackKey, apiModelId: MODEL_SPECS[FALLBACK_MODEL].apiModelId });
        }
    };
    return Object.assign(call, { usedFallback: () => fallback });
}
```

```ts
// src/entities/llm-provider/api/agent/fake.ts
import type { AgentProviderResult, CallAgentProviderOptions } from '@y0ngha/siglens-core';

const ZERO = { promptTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };

/**
 * Deterministic E2E/test provider: first step calls get_quote for the first
 * uppercase ticker in the last user message; once a tool result exists, it
 * answers with a fixed text. Mirrors `FakeChatProvider` for the agent path.
 */
export async function fakeAgentProvider(o: CallAgentProviderOptions): Promise<AgentProviderResult> {
    const lastUser = [...o.messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const hasToolResult = o.messages.some(m => m.role === 'tool');
    const symbol = /\b[A-Z]{2,5}\b/.exec(lastUser)?.[0];
    if (symbol && !hasToolResult && o.tools.some(t => t.name === 'get_quote')) {
        const call = { id: 'fake_1', name: 'get_quote', args: { symbols: [symbol] } };
        o.onEvent({ type: 'tool_call', call });
        o.onEvent({ type: 'stop', reason: 'tool_use' });
        return { text: '', toolCalls: [call], stopReason: 'tool_use', usage: ZERO };
    }
    const text = `[E2E agent] "${lastUser}"에 대한 테스트 답변입니다.`;
    o.onEvent({ type: 'text', delta: text });
    o.onEvent({ type: 'stop', reason: 'end' });
    return { text, toolCalls: [], stopReason: 'end', usage: ZERO };
}
```

```ts
// src/entities/llm-provider/api/agent/index.ts
import 'server-only';
import type { AgentProvider, AgentProviderConfig } from './router';
import { createAgentProvider } from './router';
import { fakeAgentProvider } from './fake';
import { isE2E } from '@/shared/api/e2eEnv';

export type { AgentProvider, AgentProviderConfig };
export { FALLBACK_MODEL } from './router';

/** E2E gets the fake; otherwise the real router (same switch as `getLlmProvider`). */
export function getAgentProvider(config: AgentProviderConfig): AgentProvider {
    if (isE2E()) return Object.assign(fakeAgentProvider, { usedFallback: () => false });
    return createAgentProvider(config);
}
```

- [ ] **Step 13: 통과 확인** — Run: `yarn test src/entities/llm-provider && yarn typecheck && yarn lint` → PASS, lint 경고 수 불변.

- [ ] **Step 14: Commit** — `feat(llm-provider): 에이전트 어댑터(DeepSeek·Anthropic)·폴백 라우터·E2E fake`

---

### Task 6: DB 스키마·마이그레이션·리포지토리·서버 액션

**Files:**
- Modify: `src/shared/db/schema.ts` (파일 끝에 추가)
- Create: `drizzle/0035_agent_chat.sql` (+ meta, `yarn db:generate`가 생성)
- Create: `src/entities/chat-conversation/model.ts`, `api.ts`, `index.ts`, `actions/{listConversationsAction,getConversationAction,renameConversationAction,deleteConversationAction}.ts`, `actions.ts`
- Test: `src/entities/chat-conversation/__tests__/api.test.ts`, `__tests__/actions.test.ts`

- [ ] **Step 1: 스키마 추가**

`src/shared/db/schema.ts` 끝에:

```ts
/**
 * ai.siglens.io 대화(스펙 §6-1). 회원 전용 — 비회원은 localStorage.
 * `deleted_at`은 soft delete; 하드 삭제 크론은 저장량이 KB 단위라 두지 않는다.
 */
export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: varchar('title', { length: 120 }).notNull(),
        locale: contentLocaleEnum('locale').notNull(),
        modelId: varchar('model_id', { length: 64 }).notNull(),
        messageCount: integer('message_count').notNull().default(0),
        lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
    },
    table => [
        index('chat_conversations_user_recent_idx')
            .on(table.userId, table.lastMessageAt.desc())
            .where(sql`${table.deletedAt} is null`),
    ]
);

/**
 * 대화 메시지. `content`는 tool 행이면 실행기가 4,000자로 절단한 결과 JSON
 * **그대로**(모델이 본 것 = 저장된 것). `seq`는 같은 트랜잭션에서 max+1.
 */
export const chatMessages = pgTable(
    'chat_messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        seq: integer('seq').notNull(),
        /** 'user' | 'assistant' | 'tool' */
        role: varchar('role', { length: 16 }).notNull(),
        content: text('content').notNull(),
        toolCalls: jsonb('tool_calls'),
        toolCallId: varchar('tool_call_id', { length: 64 }),
        toolName: varchar('tool_name', { length: 64 }),
        modelId: varchar('model_id', { length: 64 }),
        usage: jsonb('usage'),
        /** 'complete' | 'aborted' | 'error' | 'superseded' */
        status: varchar('status', { length: 16 }).notNull().default('complete'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    table => [uniqueIndex('chat_messages_conversation_seq_uq').on(table.conversationId, table.seq)]
);
```

(`sql`은 이미 `drizzle-orm`에서 import돼 있는지 확인; 없으면 `import { sql } from 'drizzle-orm';` 추가.)

- [ ] **Step 2: 마이그레이션 생성** (generate는 DB에 접속하지 않는다. **`yarn db:migrate`는 이 계획에서 실행 금지** — 배포 절차 Task 15에서 사용자 확인 후.)

Run: `yarn db:generate --name agent_chat`
Expected: `drizzle/0035_agent_chat.sql` 생성, `drizzle/meta/_journal.json`에 idx 35 추가. SQL을 열어 `CREATE TABLE "chat_conversations"`·`"chat_messages"`·partial index·unique index 4개가 있는지 확인.

- [ ] **Step 3: 모델·리포지토리 테스트**

```ts
// src/entities/chat-conversation/__tests__/api.test.ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import type { SiglensDatabase } from '@/shared/db/types';

function chain<T>(result: T) {
    const obj: Record<string, unknown> = {};
    const self = () => obj;
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values', 'update', 'set', 'for']) obj[m] = vi.fn(self);
    obj.returning = vi.fn().mockResolvedValue(result);
    obj.then = (resolve: (v: T) => void) => Promise.resolve(result).then(resolve);
    return obj;
}

describe('DrizzleChatConversationRepository', () => {
    it('create는 제목을 60자로 자르고 행을 돌려준다', async () => {
        const row = { id: 'c1', userId: 'u1', title: 'x'.repeat(60), locale: 'ko', modelId: 'deepseek-v4.1-flash', messageCount: 0, lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
        const db = chain([row]);
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        const created = await repo.create({ userId: 'u1', firstMessage: 'x'.repeat(200), locale: 'ko', modelId: 'deepseek-v4.1-flash' });
        expect(created.id).toBe('c1');
        expect((db.values as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ title: 'x'.repeat(60), userId: 'u1' });
    });

    it('appendMessages는 트랜잭션 안에서 max(seq)+1부터 순번을 매긴다', async () => {
        const inserted: unknown[] = [];
        const tx = chain([{ max: 3 }]);
        tx.insert = vi.fn(() => ({ values: vi.fn((rows: unknown[]) => { inserted.push(...rows); return { returning: vi.fn().mockResolvedValue(rows) }; }) }));
        tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }));
        const db = { transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        await repo.appendMessages('c1', [
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'a', modelId: 'deepseek-v4.1-flash', usage: { steps: 1 } },
        ]);
        expect(inserted.map(r => (r as { seq: number }).seq)).toEqual([4, 5]);
        expect(inserted[1]).toMatchObject({ role: 'assistant', status: 'complete', modelId: 'deepseek-v4.1-flash' });
    });

    it('toAgentHistory는 superseded/error 행을 빼고 캐노니컬 메시지로 바꾼다', async () => {
        const rows = [
            { seq: 1, role: 'user', content: 'q', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { seq: 2, role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }], toolCallId: null, toolName: null, status: 'complete' },
            { seq: 3, role: 'tool', content: '{}', toolCalls: null, toolCallId: 'c1', toolName: 'get_quote', status: 'complete' },
            { seq: 4, role: 'assistant', content: 'old', toolCalls: null, toolCallId: null, toolName: null, status: 'superseded' },
            { seq: 5, role: 'assistant', content: 'new', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
        ];
        const { toAgentHistory } = await import('@/entities/chat-conversation/model');
        expect(toAgentHistory(rows as never)).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }] },
            { role: 'tool', content: '{}', toolCallId: 'c1', toolName: 'get_quote' },
            { role: 'assistant', content: 'new' },
        ]);
    });
});
```

- [ ] **Step 4: 실패 확인** — FAIL.

- [ ] **Step 5: 모델·리포지토리 구현**

```ts
// src/entities/chat-conversation/model.ts
import type { AgentMessage } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';

export const CONVERSATION_TITLE_MAX = 60;
export type ChatMessageRole = 'user' | 'assistant' | 'tool';
export type ChatMessageStatus = 'complete' | 'aborted' | 'error' | 'superseded';

export interface ChatConversationRecord {
    id: string;
    userId: string;
    title: string;
    locale: Locale;
    modelId: string;
    messageCount: number;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface ChatMessageRecord {
    id: string;
    conversationId: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolCallId: string | null;
    toolName: string | null;
    modelId: string | null;
    usage: Record<string, unknown> | null;
    status: ChatMessageStatus;
    createdAt: Date;
}

/** Input for one appended row; `seq` is assigned by the repository. */
export interface NewChatMessage {
    role: ChatMessageRole;
    content: string;
    toolCalls?: AgentMessage['toolCalls'];
    toolCallId?: string;
    toolName?: string;
    modelId?: string;
    usage?: Record<string, unknown>;
    status?: ChatMessageStatus;
}

/** Client-facing message shape (no usage internals). */
export interface ChatMessageView {
    id: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolName: string | null;
    modelId: string | null;
    status: ChatMessageStatus;
    createdAt: string;
}

export function deriveTitle(firstMessage: string): string {
    const line = firstMessage.trim().split('\n')[0] ?? '';
    return line.length > CONVERSATION_TITLE_MAX ? `${line.slice(0, CONVERSATION_TITLE_MAX)}…` : line || '새 대화';
}

/** Rows → core transcript, dropping superseded/error rows (regenerate/edit history). */
export function toAgentHistory(
    rows: readonly Pick<ChatMessageRecord, 'role' | 'content' | 'toolCalls' | 'toolCallId' | 'toolName' | 'status'>[]
): AgentMessage[] {
    return rows
        .filter(r => r.status === 'complete' || r.status === 'aborted')
        .map(r => ({
            role: r.role,
            content: r.content,
            ...(r.toolCalls && r.toolCalls.length > 0 ? { toolCalls: r.toolCalls } : {}),
            ...(r.toolCallId ? { toolCallId: r.toolCallId } : {}),
            ...(r.toolName ? { toolName: r.toolName } : {}),
        }));
}

export function toMessageView(r: ChatMessageRecord): ChatMessageView {
    return { id: r.id, seq: r.seq, role: r.role, content: r.content, toolCalls: r.toolCalls, toolName: r.toolName, modelId: r.modelId, status: r.status, createdAt: r.createdAt.toISOString() };
}
```

```ts
// src/entities/chat-conversation/api.ts
import 'server-only';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { chatConversations, chatMessages } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type { Locale } from '@/shared/i18n/locales';
import { deriveTitle, type ChatConversationRecord, type ChatMessageRecord, type NewChatMessage } from './model';

export class DrizzleChatConversationRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async create(input: { userId: string; firstMessage: string; locale: Locale; modelId: string }): Promise<ChatConversationRecord> {
        const now = new Date();
        const [row] = await withRetry(
            () => this.db.insert(chatConversations).values({ userId: input.userId, title: deriveTitle(input.firstMessage), locale: input.locale, modelId: input.modelId, lastMessageAt: now }).returning(),
            NEON_TRANSIENT_RETRY
        );
        return row as ChatConversationRecord;
    }

    /** Owner-scoped read; `null` for other users' or deleted conversations. */
    async findForUser(id: string, userId: string): Promise<ChatConversationRecord | null> {
        const [row] = await withRetry(
            () => this.db.select().from(chatConversations).where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId), isNull(chatConversations.deletedAt))).limit(1),
            NEON_TRANSIENT_RETRY
        );
        return (row as ChatConversationRecord | undefined) ?? null;
    }

    async listForUser(userId: string, limit = 50): Promise<ChatConversationRecord[]> {
        return withRetry(
            () => this.db.select().from(chatConversations).where(and(eq(chatConversations.userId, userId), isNull(chatConversations.deletedAt))).orderBy(desc(chatConversations.lastMessageAt)).limit(limit),
            NEON_TRANSIENT_RETRY
        ) as Promise<ChatConversationRecord[]>;
    }

    async countForUser(userId: string): Promise<number> {
        const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(chatConversations).where(and(eq(chatConversations.userId, userId), isNull(chatConversations.deletedAt)));
        return Number(row?.count ?? 0);
    }

    async rename(id: string, userId: string, title: string): Promise<void> {
        await this.db.update(chatConversations).set({ title: title.slice(0, 120), updatedAt: new Date() }).where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)));
    }

    async softDelete(id: string, userId: string): Promise<void> {
        await this.db.update(chatConversations).set({ deletedAt: new Date() }).where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)));
    }

    async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
        return withRetry(
            () => this.db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.seq),
            NEON_TRANSIENT_RETRY
        ) as Promise<ChatMessageRecord[]>;
    }

    /** Assigns `seq` = max+1… inside one transaction; the per-user turn lock prevents races across requests. */
    async appendMessages(conversationId: string, messages: readonly NewChatMessage[]): Promise<ChatMessageRecord[]> {
        if (messages.length === 0) return [];
        return this.db.transaction(async tx => {
            const [agg] = await tx.select({ max: sql<number | null>`max(${chatMessages.seq})` }).from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).for('update');
            const start = Number(agg?.max ?? 0) + 1;
            const rows = messages.map((m, i) => ({
                conversationId,
                seq: start + i,
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls ?? null,
                toolCallId: m.toolCallId ?? null,
                toolName: m.toolName ?? null,
                modelId: m.modelId ?? null,
                usage: m.usage ?? null,
                status: m.status ?? 'complete',
            }));
            const inserted = await tx.insert(chatMessages).values(rows).returning();
            await tx.update(chatConversations).set({ messageCount: sql`${chatConversations.messageCount} + ${rows.length}`, lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(chatConversations.id, conversationId));
            return inserted as ChatMessageRecord[];
        });
    }

    /** regenerate: mark the trailing assistant/tool rows after the last user row as superseded. */
    async supersedeAfterLastUser(conversationId: string): Promise<number | null> {
        const rows = await this.listMessages(conversationId);
        const lastUser = [...rows].reverse().find(r => r.role === 'user');
        if (!lastUser) return null;
        await this.db.update(chatMessages).set({ status: 'superseded' }).where(and(eq(chatMessages.conversationId, conversationId), gte(chatMessages.seq, lastUser.seq + 1)));
        return lastUser.seq;
    }

    /** edit: hard-delete every row from `seq` (the edited user row) onward. */
    async deleteFromSeq(conversationId: string, seq: number): Promise<void> {
        await this.db.delete(chatMessages).where(and(eq(chatMessages.conversationId, conversationId), gte(chatMessages.seq, seq)));
        const [agg] = await this.db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(eq(chatMessages.conversationId, conversationId));
        await this.db.update(chatConversations).set({ messageCount: Number(agg?.count ?? 0), updatedAt: new Date() }).where(eq(chatConversations.id, conversationId));
    }
}
```

`index.ts`:

```ts
// src/entities/chat-conversation/index.ts
export type { ChatConversationRecord, ChatMessageRecord, ChatMessageView, NewChatMessage, ChatMessageRole, ChatMessageStatus } from './model';
export { deriveTitle, toAgentHistory, toMessageView, CONVERSATION_TITLE_MAX } from './model';
```

- [ ] **Step 6: 서버 액션 + 테스트**

```ts
// src/entities/chat-conversation/actions/listConversationsAction.ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';

export interface ConversationListItem { id: string; title: string; lastMessageAt: string; modelId: string }

export async function listConversationsAction(): Promise<ConversationListItem[]> {
    const user = await getCurrentUser();
    if (!user) return [];
    const rows = await new DrizzleChatConversationRepository(getDatabaseClient().db).listForUser(user.id);
    return rows.map(r => ({ id: r.id, title: r.title, lastMessageAt: r.lastMessageAt.toISOString(), modelId: r.modelId }));
}
```

```ts
// src/entities/chat-conversation/actions/getConversationAction.ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { toMessageView, type ChatMessageView } from '../model';

export interface ConversationDetail { id: string; title: string; modelId: string; messages: ChatMessageView[] }

export async function getConversationAction(id: string): Promise<ConversationDetail | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    const repo = new DrizzleChatConversationRepository(getDatabaseClient().db);
    const conversation = await repo.findForUser(id, user.id);
    if (!conversation) return null;
    const messages = await repo.listMessages(id);
    return { id: conversation.id, title: conversation.title, modelId: conversation.modelId, messages: messages.filter(m => m.status !== 'superseded').map(toMessageView) };
}
```

```ts
// src/entities/chat-conversation/actions/renameConversationAction.ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';

export async function renameConversationAction(id: string, title: string): Promise<{ ok: boolean }> {
    const user = await getCurrentUser();
    const trimmed = title.trim();
    if (!user || trimmed.length === 0 || trimmed.length > 120) return { ok: false };
    await new DrizzleChatConversationRepository(getDatabaseClient().db).rename(id, user.id, trimmed);
    return { ok: true };
}
```

```ts
// src/entities/chat-conversation/actions/deleteConversationAction.ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';

export async function deleteConversationAction(id: string): Promise<{ ok: boolean }> {
    const user = await getCurrentUser();
    if (!user) return { ok: false };
    await new DrizzleChatConversationRepository(getDatabaseClient().db).softDelete(id, user.id);
    return { ok: true };
}
```

`actions.ts`(배럴, 기존 entities 관례):

```ts
// src/entities/chat-conversation/actions.ts
export { listConversationsAction, type ConversationListItem } from './actions/listConversationsAction';
export { getConversationAction, type ConversationDetail } from './actions/getConversationAction';
export { renameConversationAction } from './actions/renameConversationAction';
export { deleteConversationAction } from './actions/deleteConversationAction';
```

테스트 `__tests__/actions.test.ts`: `getCurrentUser`·`getDatabaseClient`·`DrizzleChatConversationRepository`를 `vi.mock`하고 (1) 비로그인 → `[]`/`null`/`{ok:false}`, (2) `getConversationAction`이 superseded를 거른다, (3) rename 121자 거부 — 3케이스.

```ts
// src/entities/chat-conversation/__tests__/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockUser, repo } = vi.hoisted(() => ({
    mockUser: vi.fn(),
    repo: { listForUser: vi.fn(), findForUser: vi.fn(), listMessages: vi.fn(), rename: vi.fn(), softDelete: vi.fn() },
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({ getCurrentUser: mockUser }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: () => ({ db: {} }) }));
vi.mock('@/entities/chat-conversation/api', () => ({ DrizzleChatConversationRepository: vi.fn(() => repo) }));
import { deleteConversationAction, getConversationAction, listConversationsAction, renameConversationAction } from '@/entities/chat-conversation/actions';

describe('chat-conversation actions', () => {
    beforeEach(() => vi.clearAllMocks());
    it('비로그인은 빈 결과', async () => {
        mockUser.mockResolvedValue(null);
        expect(await listConversationsAction()).toEqual([]);
        expect(await getConversationAction('c1')).toBeNull();
        expect(await deleteConversationAction('c1')).toEqual({ ok: false });
    });
    it('getConversationAction은 superseded 행을 거른다', async () => {
        mockUser.mockResolvedValue({ id: 'u1' });
        repo.findForUser.mockResolvedValue({ id: 'c1', title: 't', modelId: 'm' });
        repo.listMessages.mockResolvedValue([
            { id: 'm1', seq: 1, role: 'user', content: 'q', toolCalls: null, toolName: null, modelId: null, status: 'complete', createdAt: new Date() },
            { id: 'm2', seq: 2, role: 'assistant', content: 'old', toolCalls: null, toolName: null, modelId: null, status: 'superseded', createdAt: new Date() },
        ]);
        const r = await getConversationAction('c1');
        expect(r?.messages.map(m => m.id)).toEqual(['m1']);
        expect(repo.findForUser).toHaveBeenCalledWith('c1', 'u1');
    });
    it('rename은 121자 이상을 거부한다', async () => {
        mockUser.mockResolvedValue({ id: 'u1' });
        expect(await renameConversationAction('c1', 'x'.repeat(121))).toEqual({ ok: false });
        expect(await renameConversationAction('c1', ' 제목 ')).toEqual({ ok: true });
        expect(repo.rename).toHaveBeenCalledWith('c1', 'u1', '제목');
    });
});
```

- [ ] **Step 7: 통과 확인** — Run: `yarn test src/entities/chat-conversation && yarn typecheck` → PASS.

- [ ] **Step 8: Commit** — `feat(chat-conversation): 대화·메시지 스키마(0035), 리포지토리, 서버 액션`

---

### Task 7: `activeStreams.registerActiveStream()`

**Files:**
- Modify: `src/shared/lib/sse/activeStreams.ts`
- Modify: `src/shared/lib/sse/heartbeatStream.ts` (증감을 helper로)
- Test: `src/shared/lib/sse/__tests__/activeStreams.test.ts` (기존 파일에 케이스 추가)

- [ ] **Step 1: 테스트 추가**

```ts
it('registerActiveStream은 증가시키고 해제 함수는 한 번만 감소시킨다', () => {
    __resetActiveStreamsForTests();
    const release = registerActiveStream();
    expect(__activeStreamCount()).toBe(1);
    release();
    release();
    expect(__activeStreamCount()).toBe(0);
});
```

- [ ] **Step 2: 실패 확인** — FAIL (export 없음).

- [ ] **Step 3: 구현** — `activeStreams.ts`에 추가:

```ts
/**
 * Register one unit of in-flight server work (an analysis stream or an
 * agent turn) and get an idempotent release. Callers outside `heartbeatStream`
 * must use this instead of the raw increment/decrement pair.
 */
export function registerActiveStream(): () => void {
    incrementActiveStreams();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        decrementActiveStreams();
    };
}
```

`heartbeatStream.ts`: `incrementActiveStreams(); streamRegistered = true;` → `release = registerActiveStream();` 로, `decrement()` 본문은 `release?.()`로 바꾼다(동작 동일). `incrementActiveStreams`/`decrementActiveStreams`의 "직접 호출 금지" JSDoc에 "`registerActiveStream` 사용" 문구 추가.

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/shared/lib/sse` → PASS.

- [ ] **Step 5: Commit** — `refactor(sse): registerActiveStream 헬퍼로 활성 스트림 등록 일원화`

---

### Task 8: 동시 턴 락·카운터 조립·모델 게이트

**Files:**
- Create: `src/app/api/ai/chat/turnLock.ts`
- Create: `src/app/api/ai/chat/counters.ts`
- Create: `src/app/api/ai/chat/resolveAgentModel.ts`
- Test: `src/app/api/ai/chat/__tests__/{turnLock,counters,resolveAgentModel}.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/app/api/ai/chat/__tests__/turnLock.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { redis } = vi.hoisted(() => ({ redis: { set: vi.fn(), del: vi.fn() } }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => redis }));
import { acquireTurnLock } from '@/app/api/ai/chat/turnLock';

describe('acquireTurnLock', () => {
    beforeEach(() => vi.clearAllMocks());
    it('SET NX EX 600으로 잡고 release가 DEL한다', async () => {
        redis.set.mockResolvedValue('OK');
        const lock = await acquireTurnLock('u1');
        expect(redis.set).toHaveBeenCalledWith('agent:turn-lock:u1', expect.any(String), { nx: true, ex: 600 });
        expect(lock).not.toBeNull();
        await lock!.release();
        expect(redis.del).toHaveBeenCalledWith('agent:turn-lock:u1');
    });
    it('이미 잡혀 있으면 null', async () => {
        redis.set.mockResolvedValue(null);
        expect(await acquireTurnLock('u1')).toBeNull();
    });
    it('Redis 오류는 fail-closed(null)', async () => {
        redis.set.mockRejectedValue(new Error('down'));
        expect(await acquireTurnLock('u1')).toBeNull();
    });
});
```

```ts
// src/app/api/ai/chat/__tests__/counters.test.ts
import { describe, expect, it, vi } from 'vitest';
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn((o: unknown) => ({ o })) }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({ ...(await importOriginal<object>()), createCounterStore: mockCreate }));
import { createAgentCounters } from '@/app/api/ai/chat/counters';

describe('createAgentCounters', () => {
    it('6개 스토어를 전부 failurePolicy closed로, 월 카운터만 period month', () => {
        const c = createAgentCounters();
        expect(Object.keys(c)).toEqual(['turns', 'premiumTurns', 'freshAnalysis', 'webSearchUser', 'webSearchGlobalDay', 'webSearchGlobalMonth']);
        const opts = mockCreate.mock.calls.map(([o]) => o as { prefix: string; period: string; failurePolicy: string });
        expect(opts.every(o => o.failurePolicy === 'closed')).toBe(true);
        expect(opts.find(o => o.prefix === 'agent:q:search-month')?.period).toBe('month');
        expect(opts.filter(o => o.period === 'day')).toHaveLength(5);
    });
});
```

```ts
// src/app/api/ai/chat/__tests__/resolveAgentModel.test.ts
import { describe, expect, it, vi } from 'vitest';
const { mockGate } = vi.hoisted(() => ({ mockGate: vi.fn() }));
vi.mock('@/shared/lib/byokGate', () => ({ resolveTierAndByok: mockGate }));
import { resolveAgentModel } from '@/app/api/ai/chat/resolveAgentModel';

describe('resolveAgentModel', () => {
    it('알 수 없는 모델 → invalid_model', async () => {
        expect(await resolveAgentModel('u1', 'nope', 'ko')).toEqual({ kind: 'blocked', code: 'invalid_model' });
    });
    it('P3 전 프로바이더(openai/google) → model_not_supported', async () => {
        expect(await resolveAgentModel('u1', 'gpt-5.6-luna', 'ko')).toEqual({ kind: 'blocked', code: 'model_not_supported' });
    });
    it('게이트 통과 → tier·userApiKey 전달', async () => {
        mockGate.mockResolvedValue({ kind: 'allowed', tier: 'member', userApiKey: undefined });
        expect(await resolveAgentModel('u1', 'deepseek-v4.1-flash', 'ko')).toEqual({ kind: 'allowed', model: 'deepseek-v4.1-flash', tier: 'member', userApiKey: undefined });
    });
    it('게이트 차단은 그대로', async () => {
        mockGate.mockResolvedValue({ kind: 'blocked', error: { code: 'tier_premium_blocked', message: 'x' } });
        expect(await resolveAgentModel('u1', 'claude-opus-5', 'ko')).toEqual({ kind: 'blocked', code: 'tier_premium_blocked' });
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

```ts
// src/app/api/ai/chat/turnLock.ts
import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';

export const TURN_LOCK_TTL_SECONDS = 600; // = AGENT_TURN_CAPS.turnDeadlineMs

export interface TurnLock { release(): Promise<void> }

/**
 * One in-flight turn per user across instances (spec §4-5 동시 턴 1).
 * Fail-closed: no Redis or an error means "cannot prove exclusivity" → null.
 */
export async function acquireTurnLock(userId: string): Promise<TurnLock | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    const key = `agent:turn-lock:${userId}`;
    try {
        const ok = await redis.set(key, randomUUID(), { nx: true, ex: TURN_LOCK_TTL_SECONDS });
        if (ok !== 'OK') return null;
    } catch {
        return null;
    }
    return {
        async release() {
            try {
                await redis.del(key);
            } catch (error) {
                console.warn('[agent] turn lock release failed', error);
            }
        },
    };
}
```

```ts
// src/app/api/ai/chat/counters.ts
import 'server-only';
import { createCounterStore, type AgentCounters } from '@y0ngha/siglens-core';

/** All agent quotas are fail-closed (spec §2-10). Keys: agent:q:<feature>:<subject>:<bucket>. */
export function createAgentCounters(): AgentCounters {
    const day = (prefix: string) => createCounterStore({ prefix, period: 'day', failurePolicy: 'closed' });
    return {
        turns: day('agent:q:turns'),
        premiumTurns: day('agent:q:premium'),
        freshAnalysis: day('agent:q:fresh'),
        webSearchUser: day('agent:q:search'),
        webSearchGlobalDay: day('agent:q:search-day'),
        webSearchGlobalMonth: createCounterStore({ prefix: 'agent:q:search-month', period: 'month', failurePolicy: 'closed' }),
    };
}
```

```ts
// src/app/api/ai/chat/resolveAgentModel.ts
import 'server-only';
import { getProviderForModel, type ModelId, type Tier } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { Locale } from '@/shared/i18n/locales';

const SUPPORTED_PROVIDERS = new Set(['deepseek', 'anthropic']); // P3 adds openai/google

export type AgentModelOutcome =
    | { kind: 'allowed'; model: ModelId; tier: Tier; userApiKey: string | undefined }
    | { kind: 'blocked'; code: string };

/** Model gate for a turn: known → provider shipped → tier/BYOK via the shared gate. */
export async function resolveAgentModel(userId: string, model: string, locale: Locale): Promise<AgentModelOutcome> {
    if (!isActiveModelId(model)) return { kind: 'blocked', code: 'invalid_model' };
    if (!SUPPORTED_PROVIDERS.has(getProviderForModel(model))) return { kind: 'blocked', code: 'model_not_supported' };
    const gate = await resolveTierAndByok(userId, model, locale);
    if (gate.kind === 'blocked') return { kind: 'blocked', code: gate.error.code };
    return { kind: 'allowed', model, tier: gate.tier, userApiKey: gate.userApiKey };
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/ai/chat/__tests__` → PASS.

- [ ] **Step 5: Commit** — `feat(api/ai): 동시 턴 락·에이전트 카운터·모델 게이트`

---

### Task 9: 툴 실행기 6종(P1) + 절단 + 레지스트리

**Files:**
- Create: `src/app/api/ai/chat/tools/truncate.ts`, `index.ts`, `searchTicker.ts`, `getQuote.ts`, `getBarsIndicators.ts`, `getCachedAnalysis.ts`, `getNews.ts`, `getOptionsSummary.ts`
- Test: `src/app/api/ai/chat/tools/__tests__/*.test.ts`

- [ ] **Step 1: 절단·레지스트리 테스트**

```ts
// src/app/api/ai/chat/tools/__tests__/truncate.test.ts
import { describe, expect, it } from 'vitest';
import { TOOL_RESULT_MAX_CHARS, truncateToolResult } from '@/app/api/ai/chat/tools/truncate';

describe('truncateToolResult', () => {
    it('4,000자 이하면 그대로', () => {
        const v = { a: 1 };
        expect(truncateToolResult(v)).toBe(v);
    });
    it('초과면 preview + truncated:true', () => {
        const big = { text: 'x'.repeat(TOOL_RESULT_MAX_CHARS + 100) };
        const out = truncateToolResult(big) as { truncated: boolean; preview: string };
        expect(out.truncated).toBe(true);
        expect(out.preview).toHaveLength(TOOL_RESULT_MAX_CHARS);
        expect(JSON.stringify(out).length).toBeLessThan(TOOL_RESULT_MAX_CHARS + 60);
    });
});
```

```ts
// src/app/api/ai/chat/tools/__tests__/index.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({ searchTickerTool: search }));
vi.mock('@/app/api/ai/chat/tools/getQuote', () => ({ getQuoteTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getBarsIndicators', () => ({ getBarsIndicatorsTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getCachedAnalysis', () => ({ getCachedAnalysisTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getNews', () => ({ getNewsTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getOptionsSummary', () => ({ getOptionsSummaryTool: vi.fn() }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));
import { availableToolNames, createToolExecutor } from '@/app/api/ai/chat/tools';

const ctx = { userId: 'u1', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };

describe('tool registry', () => {
    beforeEach(() => vi.clearAllMocks());
    it('P1 가용 툴 6종(+ web_search는 키 있을 때만)', () => {
        delete process.env.BRAVE_SEARCH_API_KEY;
        expect([...availableToolNames()].sort()).toEqual(['get_bars_indicators', 'get_cached_analysis', 'get_news', 'get_options_summary', 'get_quote', 'search_ticker']);
    });
    it('심볼 형태가 아니면 실행하지 않는다', async () => {
        const exec = createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' });
        expect(await exec('get_options_summary', { symbol: '../etc' }, ctx)).toEqual({ error: 'invalid_symbol' });
    });
    it('실행기 예외는 tool_failed로 감싼다', async () => {
        search.mockRejectedValue(new Error('boom'));
        const exec = createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' });
        expect(await exec('search_ticker', { query: 'x' }, ctx)).toEqual({ error: 'tool_failed', message: 'boom' });
    });
    it('결과는 절단을 거친다', async () => {
        search.mockResolvedValue({ big: 'x'.repeat(10_000) });
        const exec = createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' });
        expect(await exec('search_ticker', { query: 'x' }, ctx)).toMatchObject({ truncated: true });
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 절단·레지스트리 구현**

```ts
// src/app/api/ai/chat/tools/truncate.ts
/** Single truncation rule (spec §7): what the model sees is what gets stored. */
export const TOOL_RESULT_MAX_CHARS = 4_000;

export function truncateToolResult(value: unknown): unknown {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized.length <= TOOL_RESULT_MAX_CHARS) return value;
    return { truncated: true, preview: serialized.slice(0, TOOL_RESULT_MAX_CHARS) };
}
```

```ts
// src/app/api/ai/chat/tools/index.ts
import 'server-only';
import type { ExecuteTool, ModelId, ToolExecutionContext } from '@y0ngha/siglens-core';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isE2E } from '@/shared/api/e2eEnv';
import { truncateToolResult } from './truncate';
import { searchTickerTool } from './searchTicker';
import { getQuoteTool } from './getQuote';
import { getBarsIndicatorsTool } from './getBarsIndicators';
import { getCachedAnalysisTool } from './getCachedAnalysis';
import { getNewsTool } from './getNews';
import { getOptionsSummaryTool } from './getOptionsSummary';

export interface ToolRuntime {
    /** The user's analysis-model selection (cache keys are per model). */
    analysisModel: ModelId;
}

export type ToolExecutor = (args: Record<string, unknown>, ctx: ToolExecutionContext, runtime: ToolRuntime) => Promise<unknown>;

const EXECUTORS: Record<string, ToolExecutor> = {
    search_ticker: searchTickerTool,
    get_quote: getQuoteTool,
    get_bars_indicators: getBarsIndicatorsTool,
    get_cached_analysis: getCachedAnalysisTool,
    get_news: getNewsTool,
    get_options_summary: getOptionsSummaryTool,
    // P2 (Task 13): run_fresh_analysis, web_search
};

/** Tools this process can execute now. `web_search` needs a Brave key and is off under E2E. */
export function availableToolNames(): Set<string> {
    const names = new Set(Object.keys(EXECUTORS));
    if (isE2E() || !process.env.BRAVE_SEARCH_API_KEY) names.delete('web_search');
    return names;
}

function symbolsIn(args: Record<string, unknown>): string[] {
    const list: unknown[] = [];
    if (args.symbol !== undefined) list.push(args.symbol);
    if (Array.isArray(args.symbols)) list.push(...args.symbols);
    return list.filter((s): s is string => typeof s === 'string');
}

export function createToolExecutor(runtime: ToolRuntime): ExecuteTool {
    return async (name, args, ctx) => {
        const executor = EXECUTORS[name];
        if (!executor) return { error: 'unknown_tool' };
        if (symbolsIn(args).some(s => !isAdmissibleSymbolShape(s))) return { error: 'invalid_symbol' };
        try {
            return truncateToolResult(await executor(args, ctx, runtime));
        } catch (error) {
            return { error: 'tool_failed', message: error instanceof Error ? error.message : String(error) };
        }
    };
}
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/ai/chat/tools/__tests__/truncate.test.ts src/app/api/ai/chat/tools/__tests__/index.test.ts` → 실행기 모듈이 없어 FAIL. 아래 6개 실행기를 만든 뒤 재실행.

- [ ] **Step 5: 실행기 6종 구현** (각 파일에 `import 'server-only'`)

```ts
// src/app/api/ai/chat/tools/searchTicker.ts
import 'server-only';
import { searchTicker } from '@/entities/ticker/lib/searchTicker';
import type { ToolExecutor } from './index';

const MAX_RESULTS = 8;

export const searchTickerTool: ToolExecutor = async args => {
    const results = await searchTicker(String(args.query));
    return {
        asOf: new Date().toISOString(),
        source: 'siglens ticker index',
        results: results.slice(0, MAX_RESULTS).map(r => ({
            symbol: r.symbol,
            name: r.name,
            koreanName: r.koreanName ?? null,
            exchange: r.exchange,
            marketProfile: r.marketProfile ?? null,
        })),
    };
};
```

```ts
// src/app/api/ai/chat/tools/getQuote.ts
import 'server-only';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import type { ToolExecutor } from './index';

const MAX_SYMBOLS = 3;

/** Per-symbol market profile → session spec (KR = Yahoo, US/crypto = FMP). Spec §7 fix. */
export const getQuoteTool: ToolExecutor = async args => {
    const symbols = (args.symbols as string[]).slice(0, MAX_SYMBOLS).map(s => s.toUpperCase());
    const quotes = await Promise.all(
        symbols.map(async symbol => {
            const profile = await resolveMarketProfile(symbol);
            const descriptor = getDescriptor(profile);
            const quote = await getCachedMarketDataProvider(sessionSpecFor(profile)).getQuote(symbol);
            if (quote === null) return { symbol, found: false };
            return {
                symbol,
                found: true,
                price: quote.price,
                changesPercentage: quote.changesPercentage,
                currency: descriptor.priceFormat.currency,
                marketProfile: profile,
            };
        })
    );
    return { asOf: new Date().toISOString(), source: 'market data provider (60s cache in session)', quotes };
};
```

```ts
// src/app/api/ai/chat/tools/getBarsIndicators.ts
import 'server-only';
import { classifyTrend, detectSignals, fetchBarsWithIndicators, type IndicatorResult, type Timeframe } from '@y0ngha/siglens-core';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import type { ToolExecutor } from './index';

const DEFAULT_BARS = 30;
const last = <T>(arr: readonly T[] | undefined): T | null => (arr && arr.length > 0 ? arr[arr.length - 1]! : null);

function latestIndicators(ind: IndicatorResult) {
    const macd = last(ind.macd);
    const bb = last(ind.bollinger);
    const ma = Object.fromEntries(Object.entries(ind.ma).map(([p, series]) => [p, last(series)]));
    const ema = Object.fromEntries(Object.entries(ind.ema).map(([p, series]) => [p, last(series)]));
    return { rsi: last(ind.rsi), macd, bollinger: bb, ma, ema, atr: last(ind.atr) };
}

export const getBarsIndicatorsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as Timeframe;
    const count = typeof args.bars === 'number' ? args.bars : DEFAULT_BARS;
    const profile = await resolveMarketProfile(symbol);
    const provider = getCachedMarketDataProvider(sessionSpecFor(profile));
    const { bars, indicators } = await fetchBarsWithIndicators(provider, symbol, timeframe);
    if (bars.length === 0) return { symbol, timeframe, found: false };
    return {
        asOf: new Date(bars[bars.length - 1]!.time * 1000).toISOString(),
        source: 'siglens bars + indicators',
        symbol,
        timeframe,
        currency: getDescriptor(profile).priceFormat.currency,
        trend: classifyTrend(bars, indicators),
        signals: detectSignals(bars, indicators).map(s => ({ type: s.type, direction: s.direction, phase: s.phase })),
        latest: latestIndicators(indicators),
        bars: bars.slice(-count).map(b => ({ t: new Date(b.time * 1000).toISOString().slice(0, 16), o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })),
    };
};
```

```ts
// src/app/api/ai/chat/tools/getCachedAnalysis.ts
import 'server-only';
import { peekAnalysisCache, peekOverallAnalysisCache, type Timeframe } from '@y0ngha/siglens-core';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { getDatabaseClient } from '@/shared/db/client';
import { MS_PER_DAY } from '@/shared/config/time';
import type { ToolExecutor } from './index';

const STALE_AFTER_MS: Record<string, number> = { technical: MS_PER_DAY, overall: MS_PER_DAY };
const DEFAULT_STALE_MS = 7 * MS_PER_DAY;
const DEFAULT_TIMEFRAME: Timeframe = '1Day';

function stale(tab: string, generatedAt: Date): boolean {
    return Date.now() - generatedAt.getTime() > (STALE_AFTER_MS[tab] ?? DEFAULT_STALE_MS);
}

/** Redis peek (technical/overall) → SEO snapshot (all tabs) → history digest (technical/overall). */
export const getCachedAnalysisTool: ToolExecutor = async (args, ctx, runtime) => {
    const symbol = String(args.symbol).toUpperCase();
    const tab = String(args.tab);
    const timeframe = (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;

    if (tab === 'technical') {
        const cached = await peekAnalysisCache(symbol, timeframe, undefined, runtime.analysisModel, false, ctx.tier);
        if (cached) {
            const generatedAt = cached.analyzedAt ? new Date(cached.analyzedAt) : new Date();
            return { found: true, source: 'redis', tab, timeframe, generatedAt: generatedAt.toISOString(), stale: stale(tab, generatedAt), analysis: { summary: cached.summary, trend: cached.trend, riskLevel: cached.riskLevel, keyLevels: cached.keyLevels, priceTargets: cached.priceTargets, actionRecommendation: cached.actionRecommendation ?? null } };
        }
    }
    if (tab === 'overall') {
        const companyName = (await getAssetInfo(symbol))?.name ?? symbol;
        const cached = await peekOverallAnalysisCache(symbol, companyName, timeframe, runtime.analysisModel, false, ctx.tier);
        if (cached) {
            return { found: true, source: 'redis', tab, timeframe, generatedAt: new Date().toISOString(), stale: false, analysis: { headline: cached.headlineKo, technical: cached.technicalBulletsKo, fundamental: cached.fundamentalBulletsKo, news: cached.newsBulletsKo, options: cached.optionsBulletsKo, conclusion: cached.integratedConclusionKo, scenarios: cached.scenarios, risks: cached.riskFactorsKo } };
        }
    }

    const { db } = getDatabaseClient();
    const snapshots = await new DrizzleSeoSnapshotRepository(db).findBySymbol(symbol, ctx.locale);
    const snapshot = snapshots.find(s => s.tab === tab);
    if (snapshot) {
        return { found: true, source: 'snapshot', tab, generatedAt: snapshot.generatedAt.toISOString(), stale: stale(tab, snapshot.generatedAt), model: snapshot.model, plain: snapshot.plain, analysis: snapshot.content };
    }
    if (tab === 'technical' || tab === 'overall') {
        const digests = await new DrizzleAnalysisHistoryRepository(db).findRecentForPrompt({ symbol, timeframe, tab });
        const latest = digests[0];
        if (latest) {
            return { found: true, source: 'history', tab, timeframe, generatedAt: latest.generatedAt.toISOString(), stale: stale(tab, latest.generatedAt), digest: latest };
        }
    }
    return { found: false, tab, symbol, hint: 'call run_fresh_analysis' };
};
```

```ts
// src/app/api/ai/chat/tools/getNews.ts
import 'server-only';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { getDatabaseClient } from '@/shared/db/client';
import { MS_PER_DAY } from '@/shared/config/time';
import type { ToolExecutor } from './index';

const DEFAULT_LOOKBACK_MS = 14 * MS_PER_DAY;
const DEFAULT_LIMIT = 5;
const BODY_ITEMS = 3;
const BODY_CHARS = 1_000;

interface NewsLike { titleEn: string; titleKo: string | null; summaryKo: string | null; bodyKo: string | null; sentiment: unknown; priceImpact: unknown; publishedAt: string; url: string; source: string }

export const getNewsTool: ToolExecutor = async (args, ctx) => {
    const { db } = getDatabaseClient();
    const since = typeof args.since === 'string' ? Date.parse(args.since) : NaN;
    const sinceMs = Number.isNaN(since) ? DEFAULT_LOOKBACK_MS : Math.max(0, Date.now() - since);
    const limit = typeof args.limit === 'number' ? args.limit : DEFAULT_LIMIT;
    const query = typeof args.query === 'string' ? args.query.toLowerCase() : null;

    let rows: NewsLike[];
    if (typeof args.symbol === 'string') {
        rows = await new DrizzleNewsRepository(db).listBySymbol(args.symbol.toUpperCase(), sinceMs);
    } else if (typeof args.category === 'string') {
        rows = await new DrizzleMarketNewsRepository(db).listByCategory(args.category, sinceMs);
    } else {
        return { error: 'invalid_args', issues: [{ path: 'symbol', message: 'symbol or category required' }] };
    }
    const filtered = query ? rows.filter(r => `${r.titleEn} ${r.titleKo ?? ''} ${r.summaryKo ?? ''}`.toLowerCase().includes(query)) : rows;
    const items = filtered.slice(0, limit).map((r, i) => ({
        title: ctx.locale === 'ko' ? (r.titleKo ?? r.titleEn) : r.titleEn,
        summary: r.summaryKo,
        sentiment: r.sentiment,
        priceImpact: r.priceImpact,
        publishedAt: r.publishedAt,
        source: r.source,
        url: r.url,
        ...(args.includeBody === true && i < BODY_ITEMS && r.bodyKo ? { body: r.bodyKo.slice(0, BODY_CHARS) } : {}),
    }));
    return { asOf: new Date().toISOString(), source: 'siglens news store', count: items.length, coverageLimited: items.length === 0, items };
};
```

```ts
// src/app/api/ai/chat/tools/getOptionsSummary.ts
import 'server-only';
import { summarizeChainForLlm } from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot, hasOptionsMarket } from '@/entities/options-chain/lib/optionsDataCache';
import type { ToolExecutor } from './index';

export const getOptionsSummaryTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await hasOptionsMarket(symbol))) return { symbol, available: false };
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null || snapshot.chains.length === 0) return { symbol, available: false };
    const chain = snapshot.chains[0]!;
    return {
        asOf: snapshot.capturedAt,
        source: 'options snapshot (cached)',
        symbol,
        available: true,
        currency: 'USD',
        underlyingPrice: snapshot.underlyingPrice,
        expiration: chain.expirationDate,
        daysToExpiration: chain.daysToExpiration,
        metrics: summarizeChainForLlm(chain, snapshot.underlyingPrice),
        otherExpirations: snapshot.chains.slice(1, 4).map(c => c.expirationDate),
    };
};
```

- [ ] **Step 6: 실행기 테스트** — 각 실행기당 소스 함수를 `vi.mock`한 테스트 1파일(핵심 케이스만):

```ts
// src/app/api/ai/chat/tools/__tests__/getQuote.test.ts
import { describe, expect, it, vi } from 'vitest';
const { profile, getQuote, spec } = vi.hoisted(() => ({ profile: vi.fn(), getQuote: vi.fn(), spec: vi.fn() }));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({ resolveMarketProfile: profile }));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({ getCachedMarketDataProvider: () => ({ getQuote }) }));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile', () => ({ getDescriptor: (id: string) => ({ priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' } }) }));
import { getQuoteTool } from '@/app/api/ai/chat/tools/getQuote';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };

describe('getQuoteTool', () => {
    it('KR 심볼은 kr-equity 프로필로 세션 스펙을 고르고 KRW를 단다', async () => {
        profile.mockImplementation(async (s: string) => (s.endsWith('.KS') ? 'kr-equity' : 'us-equity'));
        getQuote.mockResolvedValue({ symbol: 'x', price: 71000, changesPercentage: 1.2 });
        const r = (await getQuoteTool({ symbols: ['005930.KS', 'AAPL', 'MSFT', 'NVDA'] }, ctx, { analysisModel: 'deepseek-v4.1-flash' })) as { quotes: unknown[] };
        expect(r.quotes).toHaveLength(3);
        expect(spec).toHaveBeenCalledWith('kr-equity');
        expect(r.quotes[0]).toMatchObject({ symbol: '005930.KS', currency: 'KRW', found: true });
    });
});
```

같은 방식으로 `getBarsIndicators.test.ts`(빈 봉 → found:false, N봉 절단), `getCachedAnalysis.test.ts`(redis hit → source redis, miss → snapshot, none → found:false + hint), `getNews.test.ts`(symbol/category 분기, query 필터, includeBody 3건·1,000자, symbol·category 둘 다 없으면 invalid_args), `getOptionsSummary.test.ts`(시장 없음 → available:false, 체인 있음 → metrics), `searchTicker.test.ts`(8건 절단)를 작성한다. 각 파일 3~4 케이스.

- [ ] **Step 7: 통과 확인** — Run: `yarn test src/app/api/ai/chat/tools && yarn typecheck && yarn lint` → PASS. (`getDescriptor`·`MS_PER_DAY` import 경로가 다르면 `src/shared/config/time.ts`·`marketProfile/index.ts`의 실제 export를 따른다.)

- [ ] **Step 8: Commit** — `feat(api/ai): 툴 실행기 6종(검색·시세·봉/지표·캐시 분석·뉴스·옵션) + 절단 규칙`

---

### Task 10: SSE writer `agentEventStream` + 라우트 `/api/ai/chat/stream`

**Files:**
- Create: `src/app/api/ai/chat/agentEventStream.ts`
- Create: `src/app/api/ai/chat/stream/route.ts`
- Test: `src/app/api/ai/chat/__tests__/agentEventStream.test.ts`, `src/app/api/ai/chat/stream/__tests__/route.test.ts`

- [ ] **Step 1: writer 테스트**

```ts
// src/app/api/ai/chat/__tests__/agentEventStream.test.ts
import { describe, expect, it, vi } from 'vitest';
import { agentEventStream } from '@/app/api/ai/chat/agentEventStream';
import { __activeStreamCount, __resetActiveStreamsForTests } from '@/shared/lib/sse/activeStreams';

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string[]> {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) { const { value, done } = await reader.read(); if (done) break; buf += value; }
    return buf.split('\n\n').filter(Boolean);
}

describe('agentEventStream', () => {
    it('meta → 이벤트 → done 순으로 프레임을 쓰고 활성 스트림을 등록·해제한다', async () => {
        __resetActiveStreamsForTests();
        const stream = agentEventStream({
            meta: { conversationId: 'c1' },
            work: async emit => { expect(__activeStreamCount()).toBe(1); emit({ type: 'text', delta: 'hi' }); return { assistantMessageId: 'm2' }; },
            onAbort: vi.fn(),
        });
        const frames = await readAll(stream);
        expect(frames[0]).toBe('event: meta\ndata: {"conversationId":"c1"}');
        expect(frames[1]).toBe('event: text\ndata: {"delta":"hi"}');
        expect(frames[2]).toBe('event: done\ndata: {"assistantMessageId":"m2"}');
        expect(__activeStreamCount()).toBe(0);
    });

    it('work가 던지면 error 프레임 + [agent-stream] failed 로그', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stream = agentEventStream({ meta: {}, work: async () => { throw new Error('boom'); }, onAbort: vi.fn() });
        const frames = await readAll(stream);
        expect(frames.at(-1)).toBe('event: error\ndata: {"code":"server_error","message":"boom"}');
        expect(err.mock.calls[0]![0]).toBe('[agent-stream] failed:');
        err.mockRestore();
    });

    it('cancel은 onAbort를 부르고 해제한다', async () => {
        __resetActiveStreamsForTests();
        const onAbort = vi.fn();
        const stream = agentEventStream({ meta: {}, work: () => new Promise(() => {}), onAbort });
        const reader = stream.getReader();
        await reader.read(); // meta
        await reader.cancel();
        expect(onAbort).toHaveBeenCalledTimes(1);
        expect(__activeStreamCount()).toBe(0);
    });
});
```

- [ ] **Step 2: writer 구현**

```ts
// src/app/api/ai/chat/agentEventStream.ts
import 'server-only';
import type { AgentTurnEvent } from '@y0ngha/siglens-core';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';

export type AgentSseEvent =
    | AgentTurnEvent
    | { type: 'done'; assistantMessageId: string; title?: string }
    | { type: 'error'; code: string; message: string };

export interface AgentEventStreamOptions<TDone extends Record<string, unknown>> {
    meta: Record<string, unknown>;
    /** Runs the turn; `emit` forwards core events; resolves with the `done` payload. */
    work: (emit: (event: AgentTurnEvent) => void) => Promise<TDone>;
    /** Called when the client disconnects — abort the provider/tool signal here (not fresh analysis, spec §6-3). */
    onAbort: () => void;
}

function frame(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Incremental SSE writer for agent turns. `heartbeatStream` cannot be reused:
 * it carries one promise and emits only open/heartbeat/done/error (spec §2-11).
 * Keeps the `[agent-stream] failed:` marker stable for the CloudWatch filter.
 */
export function agentEventStream<TDone extends Record<string, unknown>>(options: AgentEventStreamOptions<TDone>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let release: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    return new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (text: string): void => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(text)); } catch { closed = true; }
            };
            const finish = (): void => {
                if (timer !== undefined) clearInterval(timer);
                release?.();
                if (!closed) { closed = true; try { controller.close(); } catch { /* already closed */ } }
            };
            send(frame('meta', options.meta));
            release = registerActiveStream();
            timer = setInterval(() => send('event: heartbeat\ndata: {}\n\n'), HEARTBEAT_INTERVAL_MS);
            options.work(event => {
                const { type, ...data } = event;
                send(frame(type, data));
            }).then(
                done => { send(frame('done', done)); finish(); },
                (error: unknown) => {
                    console.error('[agent-stream] failed:', error);
                    send(frame('error', { code: 'server_error', message: error instanceof Error ? error.message : String(error) }));
                    finish();
                }
            );
        },
        cancel() {
            closed = true;
            if (timer !== undefined) clearInterval(timer);
            options.onAbort();
            release?.();
        },
    });
}
```

- [ ] **Step 3: writer 테스트 통과** — Run: `yarn test src/app/api/ai/chat/__tests__/agentEventStream.test.ts` → PASS.

- [ ] **Step 4: 라우트 테스트** (분석 스트림 route.test의 mock 관례)

```ts
// src/app/api/ai/chat/stream/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    user: vi.fn(), isBot: vi.fn(() => false), resolveModel: vi.fn(), lock: vi.fn(), runTurn: vi.fn(),
    repo: { create: vi.fn(), findForUser: vi.fn(), listMessages: vi.fn(), appendMessages: vi.fn(), countForUser: vi.fn(), supersedeAfterLastUser: vi.fn(), deleteFromSeq: vi.fn() },
    canAccept: vi.fn(() => true),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({ getCurrentUser: m.user }));
vi.mock('@/shared/api/isBot', () => ({ isBot: m.isBot }));
vi.mock('@/app/api/ai/chat/resolveAgentModel', () => ({ resolveAgentModel: m.resolveModel }));
vi.mock('@/app/api/ai/chat/turnLock', () => ({ acquireTurnLock: m.lock }));
vi.mock('@/app/api/ai/chat/counters', () => ({ createAgentCounters: () => ({}) }));
vi.mock('@/app/api/ai/chat/tools', () => ({ createToolExecutor: () => vi.fn(), availableToolNames: () => new Set(['get_quote']) }));
vi.mock('@/entities/llm-provider/api/agent', () => ({ getAgentProvider: () => Object.assign(vi.fn(), { usedFallback: () => false }) }));
vi.mock('@/entities/chat-conversation/api', () => ({ DrizzleChatConversationRepository: vi.fn(() => m.repo) }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: () => ({ db: {} }) }));
vi.mock('@/shared/lib/sse/activeStreams', async importOriginal => ({ ...(await importOriginal<object>()), canAcceptAnalysisStream: m.canAccept }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({ ...(await importOriginal<object>()), runAgentTurn: m.runTurn }));

import { POST } from '@/app/api/ai/chat/stream/route';

function post(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/ai/chat/stream', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
async function frames(res: Response): Promise<string[]> {
    return (await res.text()).split('\n\n').filter(Boolean);
}
const OK_TURN = { ok: true, assistant: { role: 'assistant', content: 'hi' }, intermediate: [], usage: { promptTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 1, steps: 1, ms: 5 }, stopReason: 'end', remaining: { turns: 59, fresh: 6, search: 5 }, promptVersion: 'v', toolsUsed: [] };

describe('POST /api/ai/chat/stream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.AGENT_CHAT_DISABLED;
        m.user.mockResolvedValue({ id: 'u1', tier: 'member' });
        m.resolveModel.mockResolvedValue({ kind: 'allowed', model: 'deepseek-v4.1-flash', tier: 'member', userApiKey: undefined });
        m.lock.mockResolvedValue({ release: vi.fn() });
        m.repo.create.mockResolvedValue({ id: 'c-new', title: '제목' });
        m.repo.findForUser.mockResolvedValue({ id: 'c1', title: 't', modelId: 'deepseek-v4.1-flash' });
        m.repo.listMessages.mockResolvedValue([]);
        m.repo.countForUser.mockResolvedValue(0);
        m.repo.appendMessages.mockImplementation(async (_c: string, rows: unknown[]) => rows.map((r, i) => ({ ...(r as object), id: `m${i}`, seq: i + 1 })));
        m.runTurn.mockResolvedValue(OK_TURN);
    });

    it('킬 스위치 → 503', async () => {
        process.env.AGENT_CHAT_DISABLED = '1';
        expect((await POST(post({ message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(503);
    });
    it('비로그인 → 401, 봇 → 403', async () => {
        m.user.mockResolvedValue(null);
        expect((await POST(post({ message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(401);
        m.user.mockResolvedValue({ id: 'u1' }); m.isBot.mockReturnValue(true);
        expect((await POST(post({ message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(403);
    });
    it('본문 검증: 4,000자 초과 → 400', async () => {
        expect((await POST(post({ message: 'x'.repeat(4001), model: 'deepseek-v4.1-flash' }))).status).toBe(400);
    });
    it('남의 대화 → 404', async () => {
        m.repo.findForUser.mockResolvedValue(null);
        expect((await POST(post({ conversationId: 'c1', message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(404);
    });
    it('락 실패 → 409 server_busy', async () => {
        m.lock.mockResolvedValue(null);
        expect((await POST(post({ message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(409);
    });
    it('새 대화: 생성 → user 저장 → 턴 → assistant 저장 → meta/done 프레임, 락 해제', async () => {
        const release = vi.fn(); m.lock.mockResolvedValue({ release });
        const res = await POST(post({ conversationId: null, message: 'AAPL?', model: 'deepseek-v4.1-flash' }, { 'x-siglens-locale': 'en' }));
        expect(res.headers.get('content-type')).toContain('text/event-stream');
        const f = await frames(res);
        expect(f[0]).toContain('event: meta');
        expect(f[0]).toContain('"conversationId":"c-new"');
        expect(f.at(-1)).toContain('event: done');
        expect(m.repo.create).toHaveBeenCalledWith({ userId: 'u1', firstMessage: 'AAPL?', locale: 'en', modelId: 'deepseek-v4.1-flash' });
        expect(m.repo.appendMessages).toHaveBeenCalledTimes(2); // user, then assistant(+intermediate)
        expect(m.runTurn.mock.calls[0]![0]).toMatchObject({ userId: 'u1', tier: 'member', locale: 'en', userMessage: 'AAPL?' });
        expect(release).toHaveBeenCalledTimes(1);
    });
    it('턴이 한도 오류를 돌려주면 error 프레임(turn_limit)과 user 메시지는 남는다', async () => {
        m.runTurn.mockResolvedValue({ ok: false, error: 'turn_limit' });
        const f = await frames(await POST(post({ conversationId: 'c1', message: 'x', model: 'deepseek-v4.1-flash' })));
        expect(f.at(-1)).toBe('event: error\ndata: {"code":"turn_limit","message":"turn_limit"}');
    });
    it('regenerate는 마지막 user 이후를 superseded로 만들고 그 메시지로 재실행', async () => {
        m.repo.supersedeAfterLastUser.mockResolvedValue(3);
        m.repo.listMessages.mockResolvedValue([{ seq: 3, role: 'user', content: '다시', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' }]);
        await POST(post({ conversationId: 'c1', action: 'regenerate', model: 'deepseek-v4.1-flash' }));
        expect(m.repo.supersedeAfterLastUser).toHaveBeenCalledWith('c1');
        expect(m.runTurn.mock.calls[0]![0].userMessage).toBe('다시');
        expect(m.repo.appendMessages).toHaveBeenCalledTimes(1); // assistant만
    });
    it('동시성 상한 초과 → 503', async () => {
        m.canAccept.mockReturnValue(false);
        expect((await POST(post({ message: 'x', model: 'deepseek-v4.1-flash' }))).status).toBe(503);
    });
});
```

- [ ] **Step 5: 라우트 구현**

```ts
// src/app/api/ai/chat/stream/route.ts
import 'server-only';
import type { AgentMessage, ModelId } from '@y0ngha/siglens-core';
import { runAgentTurn, AGENT_LIMITS, agentLimit } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { toAgentHistory, type NewChatMessage } from '@/entities/chat-conversation/model';
import { getAgentProvider } from '@/entities/llm-provider/api/agent';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import { ANALYSIS_LOCALE_HEADER, DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { agentEventStream } from '../agentEventStream';
import { createAgentCounters } from '../counters';
import { resolveAgentModel } from '../resolveAgentModel';
import { availableToolNames, createToolExecutor } from '../tools';
import { acquireTurnLock } from '../turnLock';

export const dynamic = 'force-dynamic';

const SSE_HEADERS: HeadersInit = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
};
const MESSAGE_MAX_CHARS = 4_000;
/** Per-instance cap on concurrent agent turns (spec §6-3). */
const MAX_CONCURRENT_AGENT_TURNS = 4;
let activeAgentTurns = 0;

type Action = 'send' | 'regenerate' | 'edit';
interface Body { conversationId: string | null; message: string; model: ModelId; action: Action; editSeq?: number; analysisModel?: ModelId }

function parseBody(raw: unknown): Body | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const b = raw as Record<string, unknown>;
    const action: Action = b.action === 'regenerate' || b.action === 'edit' ? b.action : 'send';
    const message = typeof b.message === 'string' ? b.message.trim() : '';
    if (action !== 'regenerate' && (message.length === 0 || message.length > MESSAGE_MAX_CHARS)) return null;
    if (typeof b.model !== 'string') return null;
    if (action === 'edit' && typeof b.editSeq !== 'number') return null;
    return {
        conversationId: typeof b.conversationId === 'string' ? b.conversationId : null,
        message,
        model: b.model as ModelId,
        action,
        ...(typeof b.editSeq === 'number' ? { editSeq: b.editSeq } : {}),
        ...(typeof b.analysisModel === 'string' ? { analysisModel: b.analysisModel as ModelId } : {}),
    };
}

function requestLocale(request: Request): Locale {
    const raw = request.headers.get(ANALYSIS_LOCALE_HEADER) ?? '';
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

const json = (status: number, body: unknown, headers?: HeadersInit) => Response.json(body, { status, headers });

export async function POST(request: Request): Promise<Response> {
    if (process.env.AGENT_CHAT_DISABLED === '1') return json(503, { error: 'disabled' }, { 'Retry-After': '600' });
    const user = await getCurrentUser();
    if (!user) return json(401, { error: 'unauthenticated' });
    if (isBot(request.headers)) return json(403, { error: 'bot' });
    const body = parseBody(await request.json().catch(() => null));
    if (body === null) return json(400, { error: 'invalid_body' });
    const locale = requestLocale(request);

    const gate = await resolveAgentModel(user.id, body.model, locale);
    if (gate.kind === 'blocked') return json(403, { error: gate.code });
    if (!canAcceptAnalysisStream() || activeAgentTurns >= MAX_CONCURRENT_AGENT_TURNS) return json(503, { error: 'server_busy' }, { 'Retry-After': '30' });

    const repo = new DrizzleChatConversationRepository(getDatabaseClient().db);
    const conversation = body.conversationId === null ? null : await repo.findForUser(body.conversationId, user.id);
    if (body.conversationId !== null && conversation === null) return json(404, { error: 'not_found' });
    if (conversation === null && body.action !== 'send') return json(400, { error: 'invalid_body' });
    if (conversation === null && (await repo.countForUser(user.id)) >= agentLimit(gate.tier, 'conversationsMax')) return json(409, { error: 'conversation_limit' });

    const lock = await acquireTurnLock(user.id);
    if (lock === null) return json(409, { error: 'server_busy' });

    // Resolve the transcript and the user message for this action, persisting the user row for `send`/`edit`.
    let conversationId = conversation?.id ?? '';
    let userMessage = body.message;
    let userMessageId: string | null = null;
    let title: string | undefined;
    try {
        if (conversation === null) {
            const created = await repo.create({ userId: user.id, firstMessage: body.message, locale, modelId: body.model });
            conversationId = created.id;
            title = created.title;
        }
        if (body.action === 'regenerate') {
            const lastUserSeq = await repo.supersedeAfterLastUser(conversationId);
            if (lastUserSeq === null) { await lock.release(); return json(400, { error: 'invalid_body' }); }
        } else if (body.action === 'edit') {
            await repo.deleteFromSeq(conversationId, body.editSeq!);
        }
        const rows = await repo.listMessages(conversationId);
        if (rows.length >= AGENT_LIMITS.messagesPerConversation) { await lock.release(); return json(409, { error: 'conversation_full' }); }
        if (body.action === 'regenerate') {
            userMessage = [...rows].reverse().find(r => r.role === 'user')?.content ?? '';
        } else {
            const [saved] = await repo.appendMessages(conversationId, [{ role: 'user', content: body.message }]);
            userMessageId = saved?.id ?? null;
        }
        const history: AgentMessage[] = toAgentHistory(body.action === 'regenerate' ? rows : rows.filter(r => r.status !== 'superseded'));
        const historyForTurn = body.action === 'regenerate' ? history.slice(0, -1) : history.slice(0, -1); // drop the current user row; runAgentTurn appends userMessage itself

        const controller = new AbortController();
        const provider = getAgentProvider({ model: gate.model, userApiKey: gate.userApiKey });
        const executeTool = createToolExecutor({ analysisModel: body.analysisModel ?? gate.model });
        activeAgentTurns += 1;
        let released = false;
        const releaseAll = async (): Promise<void> => {
            if (released) return;
            released = true;
            activeAgentTurns -= 1;
            await lock.release();
        };

        const stream = agentEventStream({
            meta: { conversationId, userMessageId, model: gate.model, title },
            onAbort: () => controller.abort(),
            work: async emit => {
                try {
                    const result = await runAgentTurn(
                        { userId: user.id, tier: gate.tier, model: gate.model, locale, history: historyForTurn, userMessage, availableTools: availableToolNames(), signal: controller.signal },
                        { callAgentProvider: provider, executeTool, counters: createAgentCounters(), onEvent: emit }
                    );
                    if (!result.ok) {
                        const partial = result.partialText?.trim();
                        if (partial) await repo.appendMessages(conversationId, [{ role: 'assistant', content: partial, modelId: gate.model, status: result.error === 'aborted' ? 'aborted' : 'error' }]);
                        throw new AgentTurnError(result.error);
                    }
                    const rowsToSave: NewChatMessage[] = [
                        ...result.intermediate.map(m => ({ role: m.role, content: m.content, toolCalls: m.toolCalls, toolCallId: m.toolCallId, toolName: m.toolName })),
                        { role: 'assistant', content: result.assistant.content, modelId: gate.model, usage: { ...result.usage, fallback: provider.usedFallback(), toolsUsed: result.toolsUsed, promptVersion: result.promptVersion } },
                    ];
                    const saved = await repo.appendMessages(conversationId, rowsToSave);
                    console.info('[Agent]', JSON.stringify({ conversationId, userId: user.id, model: gate.model, steps: result.usage.steps, toolsUsed: result.toolsUsed, promptVersion: result.promptVersion, ms: result.usage.ms, fallback: provider.usedFallback(), stopReason: result.stopReason }));
                    emit({ type: 'usage', usage: result.usage });
                    return { assistantMessageId: saved.at(-1)?.id ?? '', remaining: result.remaining, stopReason: result.stopReason, ...(title !== undefined ? { title } : {}) };
                } finally {
                    await releaseAll();
                }
            },
        });
        return new Response(stream, { headers: SSE_HEADERS });
    } catch (error) {
        await lock.release();
        console.error('[agent-stream] failed:', error);
        return json(500, { error: 'server_error' });
    }
}

/** Typed turn failure so the writer emits `{code}` instead of a generic server_error. */
class AgentTurnError extends Error {
    constructor(readonly code: string) { super(code); }
}
```

`agentEventStream.ts`의 error 분기를 `AgentTurnError`를 인식하도록 바꾼다(`code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'server_error'`). `AgentTurnError`는 `agentEventStream.ts`로 옮겨 export하고 라우트가 import한다(순환 방지). 라우트 테스트의 turn_limit 케이스가 이 계약을 검증한다.

- [ ] **Step 6: 통과 확인** — Run: `yarn test src/app/api/ai/chat && yarn typecheck && yarn lint` → PASS. `historyForTurn` 계산이 두 분기 모두 `slice(0,-1)`이면 한 줄로 합친다(리뷰 지적 예상).

- [ ] **Step 7: Commit** — `feat(api/ai): 에이전트 SSE 라우트(게이트·락·저장·regenerate/edit)와 writer`

---

### Task 11: UI — 스트림 훅·위젯·페이지·인증 re-export·i18n

구현 전 스킬 순서(CLAUDE.md): `frontend-design → web-design-guidelines → seo-audit`, `vercel-react-best-practices → next-cache-components`. 디자인 규약 `docs/conventions/DESIGN.md` §새 화면(토큰만·두 테마×두 배경·`SURFACE_CARD`·포커스 링·정적 가드).

**Files:**
- Create: `src/features/agent-chat/lib/parseSseFrames.ts`, `hooks/useAgentStream.ts`, `index.ts`
- Create: `src/widgets/agent-chat/{AgentMarkdown,ToolActivity,MessageList,Composer,EmptyState,Sidebar,ChatShell}.tsx`, `index.ts`
- Create: `src/app/ai/[locale]/layout.tsx`(Task 1 파일 교체), `page.tsx`, `c/[id]/page.tsx`, `not-found.tsx`
- Create: `src/app/ai/[locale]/{login,signup,forgot-password,reset-password}/page.tsx`, `signup/oauth/consent/page.tsx`
- Test: `src/features/agent-chat/__tests__/{parseSseFrames,useAgentStream}.test.ts(x)`, `src/widgets/agent-chat/__tests__/{AgentMarkdown,MessageList,Composer}.test.tsx`

- [ ] **Step 1: 프레임 파서 테스트·구현**

```ts
// src/features/agent-chat/__tests__/parseSseFrames.test.ts
import { describe, expect, it } from 'vitest';
import { parseSseFrame, splitFrames } from '@/features/agent-chat/lib/parseSseFrames';

describe('parseSseFrames', () => {
    it('버퍼를 프레임 단위로 자르고 나머지를 돌려준다', () => {
        const { frames, rest } = splitFrames('event: a\ndata: {"x":1}\n\nevent: b\ndata: {}\n\nevent: c\ndata: {');
        expect(frames).toHaveLength(2);
        expect(rest).toBe('event: c\ndata: {');
    });
    it('event·data를 파싱하고 깨진 JSON은 null data', () => {
        expect(parseSseFrame('event: text\ndata: {"delta":"hi"}')).toEqual({ event: 'text', data: { delta: 'hi' } });
        expect(parseSseFrame('event: text\ndata: {bad')).toEqual({ event: 'text', data: null });
        expect(parseSseFrame('event: heartbeat\ndata: {}')).toEqual({ event: 'heartbeat', data: {} });
    });
});
```

```ts
// src/features/agent-chat/lib/parseSseFrames.ts
export interface SseFrame { event: string; data: Record<string, unknown> | null }

export function splitFrames(buffer: string): { frames: string[]; rest: string } {
    const parts = buffer.split('\n\n');
    const rest = parts.pop() ?? '';
    return { frames: parts.filter(Boolean), rest };
}

export function parseSseFrame(frame: string): SseFrame {
    let event = '';
    let raw = '';
    for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) raw += line.slice(5).trim();
    }
    let data: Record<string, unknown> | null = null;
    try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
        data = null;
    }
    return { event, data };
}
```

- [ ] **Step 2: 훅 테스트** (fetch mock으로 SSE 본문을 흘림)

```tsx
// src/features/agent-chat/__tests__/useAgentStream.test.tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';

function sse(frames: string[]): Response {
    const body = new ReadableStream<Uint8Array>({
        start(c) { for (const f of frames) c.enqueue(new TextEncoder().encode(`${f}\n\n`)); c.close(); },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
afterEach(() => vi.restoreAllMocks());

describe('useAgentStream', () => {
    it('send: 낙관적 user 메시지 → 텍스트 누적 → 툴 칩 → done', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([
            'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1","model":"deepseek-v4.1-flash"}',
            'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["AAPL"]}}',
            'event: tool_end\ndata: {"id":"t1","name":"get_quote","status":"ok","ms":12,"summary":"{}"}',
            'event: text\ndata: {"delta":"231"}',
            'event: text\ndata: {"delta":".42"}',
            'event: done\ndata: {"assistantMessageId":"m2","remaining":{"turns":59,"fresh":6,"search":5},"stopReason":"end"}',
        ]));
        const { result } = renderHook(() => useAgentStream({ conversationId: null, initialMessages: [], model: 'deepseek-v4.1-flash' }));
        act(() => { void result.current.send('AAPL?'); });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.conversationId).toBe('c1');
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([['user', 'AAPL?'], ['assistant', '231.42']]);
        expect(result.current.messages[1]!.tools).toEqual([{ id: 't1', name: 'get_quote', args: { symbols: ['AAPL'] }, status: 'ok', ms: 12, summary: '{}' }]);
        expect(result.current.remaining).toEqual({ turns: 59, fresh: 6, search: 5 });
        const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ action: 'send', message: 'AAPL?', model: 'deepseek-v4.1-flash' });
    });
    it('error 프레임 → status error + code', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse(['event: meta\ndata: {}', 'event: error\ndata: {"code":"turn_limit","message":"turn_limit"}']));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [], model: 'deepseek-v4.1-flash' }));
        act(() => { void result.current.send('x'); });
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.error).toBe('turn_limit');
    });
    it('HTTP 401 → error unauthenticated', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'unauthenticated' }, { status: 401 }));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [], model: 'deepseek-v4.1-flash' }));
        act(() => { void result.current.send('x'); });
        await waitFor(() => expect(result.current.error).toBe('unauthenticated'));
    });
    it('stop은 AbortController를 중단시킨다', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [], model: 'deepseek-v4.1-flash' }));
        act(() => { void result.current.send('x'); });
        act(() => result.current.stop());
        expect(abort).toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: 훅 구현**

```ts
// src/features/agent-chat/hooks/useAgentStream.ts
'use client';
import { useCallback, useRef, useState } from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import type { ChatMessageView } from '@/entities/chat-conversation';
import { ANALYSIS_LOCALE_HEADER, splitLocalePath } from '@/shared/i18n/locales';
import { parseSseFrame, splitFrames } from '../lib/parseSseFrames';

export interface ToolActivityItem { id: string; name: string; args: Record<string, unknown>; status: 'running' | 'ok' | 'error'; ms?: number; summary?: string; estimatedSeconds?: number }
export interface AgentUiMessage { id: string; seq?: number; role: 'user' | 'assistant'; content: string; tools: ToolActivityItem[]; status: 'complete' | 'streaming' | 'aborted' | 'error'; truncated?: boolean }
export interface AgentRemaining { turns: number; fresh: number; search: number }
export type StreamStatus = 'idle' | 'streaming' | 'error';

interface Options { conversationId: string | null; initialMessages: ChatMessageView[]; model: ModelId; analysisModel?: ModelId; onConversationCreated?: (id: string, title: string) => void }

function fromViews(views: ChatMessageView[]): AgentUiMessage[] {
    const out: AgentUiMessage[] = [];
    for (const v of views) {
        if (v.role === 'tool') {
            const last = out[out.length - 1];
            if (last?.role === 'assistant') last.tools.push({ id: v.id, name: v.toolName ?? 'tool', args: {}, status: 'ok', summary: v.content.slice(0, 120) });
            continue;
        }
        if (v.role === 'assistant' && v.toolCalls && v.toolCalls.length > 0 && v.content === '') {
            out.push({ id: v.id, seq: v.seq, role: 'assistant', content: '', tools: v.toolCalls.map(c => ({ id: c.id, name: c.name, args: c.args, status: 'ok' })), status: 'complete' });
            continue;
        }
        const prev = out[out.length - 1];
        if (v.role === 'assistant' && prev?.role === 'assistant' && prev.content === '') {
            prev.id = v.id; prev.seq = v.seq; prev.content = v.content; prev.status = v.status === 'aborted' ? 'aborted' : 'complete';
            continue;
        }
        out.push({ id: v.id, seq: v.seq, role: v.role, content: v.content, tools: [], status: v.status === 'aborted' ? 'aborted' : 'complete' });
    }
    return out;
}

export function useAgentStream(options: Options) {
    const [messages, setMessages] = useState<AgentUiMessage[]>(() => fromViews(options.initialMessages));
    const [conversationId, setConversationId] = useState(options.conversationId);
    const [status, setStatus] = useState<StreamStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [remaining, setRemaining] = useState<AgentRemaining | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const patchLast = useCallback((fn: (m: AgentUiMessage) => AgentUiMessage) => {
        setMessages(prev => prev.length === 0 ? prev : [...prev.slice(0, -1), fn(prev[prev.length - 1]!)]);
    }, []);

    const run = useCallback(async (body: Record<string, unknown>) => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setStatus('streaming');
        setError(null);
        setMessages(prev => [...prev, { id: `pending-${Date.now()}`, role: 'assistant', content: '', tools: [], status: 'streaming' }]);
        try {
            const response = await fetch('/api/ai/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', [ANALYSIS_LOCALE_HEADER]: splitLocalePath(window.location.pathname).locale },
                body: JSON.stringify({ conversationId, model: options.model, analysisModel: options.analysisModel, ...body }),
                signal: controller.signal,
            });
            if (!response.ok || response.body === null) {
                const payload = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(payload.error ?? `http_${response.status}`);
            }
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let buffer = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value;
                const { frames, rest } = splitFrames(buffer);
                buffer = rest;
                for (const raw of frames) {
                    const { event, data } = parseSseFrame(raw);
                    if (data === null) continue;
                    if (event === 'meta') {
                        if (typeof data.conversationId === 'string' && data.conversationId !== conversationId) {
                            setConversationId(data.conversationId);
                            options.onConversationCreated?.(data.conversationId, String(data.title ?? ''));
                        }
                    } else if (event === 'text') {
                        patchLast(m => ({ ...m, content: m.content + String(data.delta ?? '') }));
                    } else if (event === 'tool_start') {
                        patchLast(m => ({ ...m, tools: [...m.tools, { id: String(data.id), name: String(data.name), args: (data.args as Record<string, unknown>) ?? {}, status: 'running', estimatedSeconds: typeof data.estimatedSeconds === 'number' ? data.estimatedSeconds : undefined }] }));
                    } else if (event === 'tool_end') {
                        patchLast(m => ({ ...m, tools: m.tools.map(t => t.id === data.id ? { ...t, status: data.status === 'ok' ? 'ok' : 'error', ms: Number(data.ms), summary: String(data.summary ?? '') } : t) }));
                    } else if (event === 'done') {
                        patchLast(m => ({ ...m, id: String(data.assistantMessageId ?? m.id), status: 'complete', truncated: data.stopReason === 'max_tokens' }));
                        if (data.remaining) setRemaining(data.remaining as AgentRemaining);
                    } else if (event === 'error') {
                        throw new Error(String(data.code ?? 'server_error'));
                    }
                }
            }
            setStatus('idle');
        } catch (e) {
            const aborted = controller.signal.aborted;
            patchLast(m => ({ ...m, status: aborted ? 'aborted' : 'error' }));
            setStatus(aborted ? 'idle' : 'error');
            if (!aborted) setError(e instanceof Error ? e.message : 'server_error');
        }
    }, [conversationId, options, patchLast]);

    const send = useCallback((message: string) => {
        setMessages(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', content: message, tools: [], status: 'complete' }]);
        return run({ action: 'send', message });
    }, [run]);

    const regenerate = useCallback(() => {
        setMessages(prev => prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev);
        return run({ action: 'regenerate' });
    }, [run]);

    const edit = useCallback((seq: number, message: string) => {
        setMessages(prev => {
            const index = prev.findIndex(m => m.seq === seq);
            const kept = index >= 0 ? prev.slice(0, index) : prev;
            return [...kept, { id: `local-${Date.now()}`, role: 'user', content: message, tools: [], status: 'complete' }];
        });
        return run({ action: 'edit', editSeq: seq, message });
    }, [run]);

    const stop = useCallback(() => controllerRef.current?.abort(), []);

    return { messages, conversationId, status, error, remaining, send, regenerate, edit, stop };
}
```

`src/features/agent-chat/index.ts`: `export { useAgentStream } from './hooks/useAgentStream'; export type { AgentUiMessage, ToolActivityItem, StreamStatus } from './hooks/useAgentStream';`

- [ ] **Step 4: 훅 테스트 통과** — Run: `yarn test src/features/agent-chat` → PASS.

- [ ] **Step 5: 위젯 테스트(3개)**

```tsx
// src/widgets/agent-chat/__tests__/AgentMarkdown.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentMarkdown } from '@/widgets/agent-chat/AgentMarkdown';

describe('AgentMarkdown', () => {
    it('이미지는 렌더하지 않고 링크에는 rel·호스트를 단다', () => {
        const { container } = render(<AgentMarkdown>{'![x](https://evil/a.png) [뉴스](https://example.com/p)'}</AgentMarkdown>);
        expect(container.querySelector('img')).toBeNull();
        const a = screen.getByRole('link');
        expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow');
        expect(a).toHaveAttribute('target', '_blank');
        expect(a.textContent).toContain('example.com');
    });
});
```

```tsx
// src/widgets/agent-chat/__tests__/MessageList.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '@/widgets/agent-chat/MessageList';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="ko" messages={ko}>{ui}</NextIntlClientProvider>);

describe('MessageList', () => {
    it('툴 칩·재생성·잘림 배너를 그린다', () => {
        wrap(<MessageList messages={[
            { id: '1', role: 'user', content: 'q', tools: [], status: 'complete', seq: 1 },
            { id: '2', role: 'assistant', content: 'a', tools: [{ id: 't', name: 'get_quote', args: { symbols: ['AAPL'] }, status: 'ok', ms: 40 }], status: 'complete', truncated: true },
        ]} streaming={false} onRegenerate={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/get_quote/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /다시 생성/ })).toBeInTheDocument();
        expect(screen.getByText(/답변이 잘렸/)).toBeInTheDocument();
        expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    });
});
```

```tsx
// src/widgets/agent-chat/__tests__/Composer.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '@/widgets/agent-chat/Composer';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="ko" messages={ko}>{ui}</NextIntlClientProvider>);

describe('Composer', () => {
    it('Enter로 전송, Shift+Enter는 줄바꿈, 4,000자 초과는 전송 불가', () => {
        const onSend = vi.fn();
        wrap(<Composer disabled={false} streaming={false} remainingTurns={5} onSend={onSend} onStop={vi.fn()} />);
        const box = screen.getByRole('textbox');
        fireEvent.change(box, { target: { value: '안녕' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('안녕');
        fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
        expect(screen.getByRole('button', { name: /전송/ })).toBeDisabled();
    });
    it('스트리밍 중엔 중단 버튼', () => {
        const onStop = vi.fn();
        wrap(<Composer disabled={false} streaming remainingTurns={5} onSend={vi.fn()} onStop={onStop} />);
        fireEvent.click(screen.getByRole('button', { name: /중단/ }));
        expect(onStop).toHaveBeenCalled();
    });
});
```

- [ ] **Step 6: 위젯 구현** (한국어 리터럴로 작성 → Step 9에서 추출)

```tsx
// src/widgets/agent-chat/AgentMarkdown.tsx
import type { Components } from 'react-markdown';
import { MarkdownText } from '@/shared/ui/MarkdownText';

/** Output hygiene (spec §8): no images (exfil beacons), links open safely with the host shown. */
const AGENT_COMPONENTS: Components = {
    img: () => null,
    a: ({ href, children }) => {
        let host = '';
        try { host = new URL(String(href)).hostname; } catch { host = ''; }
        return (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-400 underline underline-offset-2 hover:text-primary-300">
                {children}{host ? <span className="ml-1 text-xs text-secondary-400">({host})</span> : null}
            </a>
        );
    },
};

export function AgentMarkdown({ children }: { readonly children: string }) {
    return <MarkdownText components={AGENT_COMPONENTS}>{children}</MarkdownText>;
}
```

```tsx
// src/widgets/agent-chat/ToolActivity.tsx
'use client';
import { useState } from 'react';
import type { ToolActivityItem } from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';

const ICON: Record<string, string> = { search_ticker: '🔎', get_quote: '💹', get_bars_indicators: '📊', get_cached_analysis: '🧠', get_news: '📰', get_options_summary: '🎯', run_fresh_analysis: '⚙️', web_search: '🌐' };

function label(t: ToolActivityItem): string {
    const symbol = typeof t.args.symbol === 'string' ? t.args.symbol : Array.isArray(t.args.symbols) ? (t.args.symbols as string[]).join(',') : '';
    return [t.name, symbol, typeof t.args.timeframe === 'string' ? t.args.timeframe : ''].filter(Boolean).join(' ');
}

export function ToolActivity({ tools }: { readonly tools: ToolActivityItem[] }) {
    const [open, setOpen] = useState<string | null>(null);
    if (tools.length === 0) return null;
    return (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="사용한 도구">
            {tools.map(t => (
                <li key={t.id}>
                    <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}
                        className={cn('rounded-full border border-control px-2 py-0.5 text-xs text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500', t.status === 'error' && 'text-ui-danger-text', t.status === 'running' && 'animate-pulse')}>
                        {ICON[t.name] ?? '🔧'} {label(t)}{t.ms !== undefined ? ` · ${(t.ms / 1000).toFixed(1)}s` : ''}
                        {t.status === 'running' && t.estimatedSeconds ? ` · 약 ${t.estimatedSeconds}초` : ''}
                    </button>
                    {open === t.id && t.summary ? <pre className="mt-1 max-w-full overflow-x-auto rounded bg-secondary-800 p-2 font-mono text-[10px] text-secondary-300">{t.summary}</pre> : null}
                </li>
            ))}
        </ul>
    );
}
```

```tsx
// src/widgets/agent-chat/MessageList.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { AgentUiMessage } from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import { AgentMarkdown } from './AgentMarkdown';
import { ToolActivity } from './ToolActivity';

interface Props { readonly messages: AgentUiMessage[]; readonly streaming: boolean; readonly onRegenerate: () => void; readonly onEdit: (seq: number, text: string) => void }

export function MessageList({ messages, streaming, onRegenerate, onEdit }: Props) {
    const endRef = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(true);
    const [editing, setEditing] = useState<{ seq: number; text: string } | null>(null);

    useEffect(() => { if (pinned) endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, pinned]);

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const lastUser = [...messages].reverse().find(m => m.role === 'user');

    return (
        <div role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 overflow-y-auto px-4 py-6"
            onScroll={e => { const el = e.currentTarget; setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80); }}>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                {messages.map(m => (
                    <article key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                        <div className={cn('max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-secondary-800 text-secondary-100')}>
                            {m.role === 'assistant' ? <ToolActivity tools={m.tools} /> : null}
                            {editing && editing.seq === m.seq ? (
                                <form onSubmit={e => { e.preventDefault(); onEdit(editing.seq, editing.text); setEditing(null); }} className="flex flex-col gap-2">
                                    <textarea value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} className="min-h-20 w-72 rounded border border-control bg-secondary-900 p-2 text-secondary-100" aria-label="메시지 수정" />
                                    <div className="flex gap-2"><button type="submit" className="rounded bg-primary-500 px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary-500">다시 보내기</button><button type="button" onClick={() => setEditing(null)} className="rounded px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary-500">취소</button></div>
                                </form>
                            ) : m.role === 'assistant' ? <AgentMarkdown>{m.content || (m.status === 'streaming' ? '…' : '')}</AgentMarkdown> : <p className="whitespace-pre-wrap">{m.content}</p>}
                            {m.status === 'aborted' ? <p className="mt-2 text-xs text-secondary-400">중단된 답변입니다.</p> : null}
                            {m.status === 'error' ? <p className="mt-2 text-xs text-ui-danger-text">답변 생성에 실패했습니다.</p> : null}
                            {m.truncated ? <p className="mt-2 text-xs text-ui-warning-text">답변이 잘렸습니다. 이어서 질문해 주세요.</p> : null}
                        </div>
                        <div className="mt-1 flex gap-2 text-xs text-secondary-400">
                            <button type="button" onClick={() => navigator.clipboard.writeText(m.content)} className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500">복사</button>
                            {m.role === 'assistant' && m === lastAssistant && !streaming ? <button type="button" onClick={onRegenerate} className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500">다시 생성</button> : null}
                            {m.role === 'user' && m === lastUser && m.seq !== undefined && !streaming ? <button type="button" onClick={() => setEditing({ seq: m.seq!, text: m.content })} className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500">수정</button> : null}
                        </div>
                    </article>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
```

```tsx
// src/widgets/agent-chat/Composer.tsx
'use client';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

const MAX = 4_000;
interface Props { readonly disabled: boolean; readonly streaming: boolean; readonly remainingTurns: number | null; readonly onSend: (text: string) => void; readonly onStop: () => void }

export function Composer({ disabled, streaming, remainingTurns, onSend, onStop }: Props) {
    const [text, setText] = useState('');
    const canSend = !disabled && !streaming && text.trim().length > 0 && text.length <= MAX;
    const submit = (): void => { if (!canSend) return; onSend(text.trim()); setText(''); };
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } };
    return (
        <div className="sticky bottom-0 border-t border-control bg-secondary-900 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
            <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} rows={1} disabled={disabled}
                    placeholder="종목, 시장, 뉴스에 대해 물어보세요 (Enter 전송 · Shift+Enter 줄바꿈)" aria-label="메시지 입력"
                    className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-control bg-secondary-800 px-3 py-2 text-sm text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                    style={{ height: 'auto' }} onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }} />
                {streaming
                    ? <button type="button" onClick={onStop} className="rounded-lg border border-control px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500">중단</button>
                    : <button type="button" onClick={submit} disabled={!canSend} className={cn('rounded-lg bg-primary-500 px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500', !canSend && 'bg-secondary-700 text-secondary-400')}>전송</button>}
            </div>
            <p className="mx-auto mt-1 flex w-full max-w-3xl justify-between text-xs text-secondary-400">
                <span>{text.length > MAX ? `${text.length.toLocaleString()} / ${MAX.toLocaleString()}자 — 너무 깁니다` : `${text.length.toLocaleString()} / ${MAX.toLocaleString()}`}</span>
                <span>{remainingTurns !== null ? `오늘 ${remainingTurns}턴 남음` : ''} · 정보 제공 목적이며 투자 조언이 아닙니다.</span>
            </p>
        </div>
    );
}
```

```tsx
// src/widgets/agent-chat/EmptyState.tsx
const SUGGESTIONS = ['삼성전자 최근 siglens 분석 요약해줘', 'AAPL 지금 추세랑 RSI 어때?', '이번 주 미국 시장 뉴스 중요한 것만', 'NVDA 옵션 시장은 어떻게 보고 있어?', '005930.KS 지지·저항 알려줘', 'BTCUSD 캐시된 분석 있어?'];

export function EmptyState({ onPick, signedIn, loginHref }: { readonly onPick: (text: string) => void; readonly signedIn: boolean; readonly loginHref: string }) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
            <h1 className="text-2xl font-semibold text-secondary-100">siglens AI에게 물어보세요</h1>
            <p className="max-w-md text-sm text-secondary-300">시세·지표·siglens 분석·뉴스·옵션 데이터를 직접 조회해서 답합니다. 캐시된 분석이 없으면 새로 분석합니다.</p>
            {signedIn ? (
                <ul className="grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map(s => <li key={s}><button type="button" onClick={() => onPick(s)} className="w-full rounded-lg border border-control bg-secondary-800 px-3 py-2 text-left text-sm text-secondary-200 hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500">{s}</button></li>)}
                </ul>
            ) : (
                <a href={loginHref} className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500">로그인하고 시작하기</a>
            )}
        </div>
    );
}
```

```tsx
// src/widgets/agent-chat/Sidebar.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteConversationAction, renameConversationAction, type ConversationListItem } from '@/entities/chat-conversation/actions';
import { cn } from '@/shared/lib/cn';

interface Props { readonly items: ConversationListItem[]; readonly activeId: string | null; readonly localePrefix: string }

export function Sidebar({ items, activeId, localePrefix }: Props) {
    const router = useRouter();
    const [filter, setFilter] = useState('');
    const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
    const visible = items.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()));
    return (
        <nav aria-label="대화 목록" className="flex h-full flex-col gap-2 p-3">
            <a href={`${localePrefix}/`} className="rounded-lg border border-control px-3 py-2 text-sm text-secondary-100 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500">+ 새 대화</a>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="대화 검색" aria-label="대화 검색" className="rounded border border-control bg-secondary-900 px-2 py-1 text-sm text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500" />
            <ul className="flex-1 space-y-1 overflow-y-auto">
                {visible.map(item => (
                    <li key={item.id} className={cn('group flex items-center gap-1 rounded px-2 py-1 text-sm', item.id === activeId ? 'bg-secondary-800 text-secondary-100' : 'text-secondary-300 hover:bg-secondary-800')}>
                        {renaming?.id === item.id ? (
                            <form className="flex-1" onSubmit={async e => { e.preventDefault(); await renameConversationAction(item.id, renaming.title); setRenaming(null); router.refresh(); }}>
                                <input autoFocus value={renaming.title} onChange={e => setRenaming({ id: item.id, title: e.target.value })} onBlur={() => setRenaming(null)} aria-label="대화 이름" className="w-full rounded bg-secondary-900 px-1 text-secondary-100" />
                            </form>
                        ) : <a href={`${localePrefix}/c/${item.id}`} className="flex-1 truncate focus-visible:ring-2 focus-visible:ring-primary-500">{item.title}</a>}
                        <button type="button" aria-label="이름 변경" onClick={() => setRenaming({ id: item.id, title: item.title })} className="rounded px-1 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500">✎</button>
                        <button type="button" aria-label="삭제" onClick={async () => { await deleteConversationAction(item.id); if (item.id === activeId) router.push(`${localePrefix}/`); else router.refresh(); }} className="rounded px-1 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500">✕</button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
```

```tsx
// src/widgets/agent-chat/ChatShell.tsx
'use client';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { useRouter } from 'next/navigation';
import type { ModelId } from '@y0ngha/siglens-core';
import { DEEPSEEK_V4_1_FLASH_MODEL, getAllowedModels } from '@y0ngha/siglens-core';
import type { ChatMessageView } from '@/entities/chat-conversation';
import type { ConversationListItem } from '@/entities/chat-conversation/actions';
import { useAgentStream } from '@/features/agent-chat';
import { ModelSelect } from '@/widgets/chat/ModelSelect';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { Sidebar } from './Sidebar';

interface Props {
    readonly conversationId: string | null;
    readonly initialMessages: ChatMessageView[];
    readonly conversations: ConversationListItem[];
    readonly signedIn: boolean;
    readonly tier: 'free' | 'member' | 'pro';
    readonly localePrefix: string;
    readonly siteUrl: string;
}

/** P1 agent models: DeepSeek + Claude only (router rejects openai/google until P3). */
const AGENT_MODEL_FILTER = (m: ModelId): boolean => m.startsWith('deepseek') || m.startsWith('claude');

export function ChatShell({ conversationId, initialMessages, conversations, signedIn, tier, localePrefix, siteUrl }: Props) {
    const router = useRouter();
    const [model, setModel] = useState<ModelId>(DEEPSEEK_V4_1_FLASH_MODEL);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const stream = useAgentStream({ conversationId, initialMessages, model, onConversationCreated: id => { window.history.replaceState(null, '', `${localePrefix}/c/${id}`); router.refresh(); } });
    const options = getAllowedModels(tier).filter(AGENT_MODEL_FILTER).map(id => ({ id, label: id }));

    const sidebar = <Sidebar items={conversations} activeId={stream.conversationId} localePrefix={localePrefix} />;
    return (
        <div className="flex min-h-dvh">
            <aside className="hidden w-64 shrink-0 border-r border-control lg:block">{sidebar}</aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-3 border-b border-control px-4 py-2">
                    <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction="left" modal={false}>
                        <Drawer.Trigger className="rounded px-2 py-1 text-sm lg:hidden focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="대화 목록 열기">☰</Drawer.Trigger>
                        <Drawer.Portal><Drawer.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-secondary-900"><Drawer.Title className="sr-only">대화 목록</Drawer.Title>{sidebar}</Drawer.Content></Drawer.Portal>
                    </Drawer.Root>
                    <a href={siteUrl} className="text-sm font-semibold text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500">siglens</a>
                    <span className="text-xs text-secondary-400">AI</span>
                    <div className="ml-auto flex items-center gap-2">
                        {signedIn ? <ModelSelect options={options} selected={model} onChange={setModel} isHydrated /> : <a href={`${localePrefix}/login`} className="text-sm text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500">로그인</a>}
                    </div>
                </header>
                {stream.messages.length === 0
                    ? <EmptyState signedIn={signedIn} loginHref={`${localePrefix}/login`} onPick={text => void stream.send(text)} />
                    : <MessageList messages={stream.messages} streaming={stream.status === 'streaming'} onRegenerate={() => void stream.regenerate()} onEdit={(seq, text) => void stream.edit(seq, text)} />}
                {stream.error ? <p role="alert" className="mx-auto w-full max-w-3xl px-4 text-sm text-ui-danger-text">오류: {stream.error}</p> : null}
                <Composer disabled={!signedIn} streaming={stream.status === 'streaming'} remainingTurns={stream.remaining?.turns ?? null} onSend={text => void stream.send(text)} onStop={stream.stop} />
            </div>
        </div>
    );
}
```

`src/widgets/agent-chat/index.ts`: `export { ChatShell } from './ChatShell';`

`ModelSelect`의 `options` 타입(`ModelOption`)이 `{ id, label }`와 다르면 그 타입에 맞춘다(파일 상단 `ModelOption` 정의 확인). `getAllowedModels`는 `enableTierRestrictions:false`라 전 모델을 돌려주므로 프로바이더 필터가 P1 게이트다.

- [ ] **Step 7: 페이지·레이아웃**

```tsx
// src/app/ai/[locale]/layout.tsx  (Task 1 파일을 교체)
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';
import { ReactQueryProvider } from '@/app/providers';
import { VisitorPing } from '@/features/visitor-ping';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { ThemeInitScript } from '@/shared/ui/ThemeInitScript';
import '../../globals.css';

export const dynamic = 'force-dynamic';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const pretendard = localFont({ src: '../../fonts/PretendardVariable-subset.woff2', variable: '--font-pretendard', display: 'swap', weight: '100 900' });

/** Client namespaces the ai subtree renders; the extractor can't see this root (spec §9-3). */
const AI_CLIENT_PATHS = ['widgets.agent-chat', 'widgets.chat', 'features.agent-chat', 'app.ai', 'shared.ui'];

export const metadata: Metadata = {
    metadataBase: new URL(AI_SITE_URL),
    title: { default: 'siglens AI', template: '%s | siglens AI' },
    robots: { index: false, follow: false },
};

export default async function AiRootLayout({ children, params }: { readonly children: ReactNode; readonly params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    const messages = await getMessages({ locale });
    return (
        <html lang={LOCALE_HREFLANG[locale]} className={`${geistSans.variable} ${pretendard.variable} h-full antialiased scheme-dark`}>
            <body className="flex min-h-full flex-col bg-secondary-900">
                <ThemeInitScript />
                <LocaleProvider locale={locale}>
                    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, AI_CLIENT_PATHS)}>
                        <ReactQueryProvider>
                            <VisitorPing />
                            {children}
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
```

```tsx
// src/app/ai/[locale]/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listConversationsAction } from '@/entities/chat-conversation/actions';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';

export const dynamic = 'force-dynamic';

export default async function AiHomePage({ params }: { readonly params: Promise<{ locale: string }> }) {
    const { locale: raw } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    const user = await getCurrentUser();
    const conversations = user ? await listConversationsAction() : [];
    return <ChatShell conversationId={null} initialMessages={[]} conversations={conversations} signedIn={user !== null} tier={user?.tier ?? 'free'} localePrefix={localePath(locale, '').replace(/\/$/, '')} siteUrl={SITE_URL} />;
}
```

```tsx
// src/app/ai/[locale]/c/[id]/page.tsx
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getConversationAction, listConversationsAction } from '@/entities/chat-conversation/actions';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { readonly params: Promise<{ locale: string; id: string }> }) {
    const { locale: raw, id } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    const user = await getCurrentUser();
    if (!user) notFound();
    const [conversation, conversations] = await Promise.all([getConversationAction(id), listConversationsAction()]);
    if (!conversation) notFound();
    return <ChatShell conversationId={conversation.id} initialMessages={conversation.messages} conversations={conversations} signedIn tier={user.tier} localePrefix={localePath(locale, '').replace(/\/$/, '')} siteUrl={SITE_URL} />;
}
```

```tsx
// src/app/ai/[locale]/not-found.tsx
export default function AiNotFound() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
            <h1 className="text-xl font-semibold text-secondary-100">대화를 찾을 수 없습니다</h1>
            <a href="/" className="text-primary-400 underline focus-visible:ring-2 focus-visible:ring-primary-500">새 대화 시작</a>
        </main>
    );
}
```

인증 페이지 re-export(5개 파일, 각각 동일 형태):

```tsx
// src/app/ai/[locale]/login/page.tsx
export { default, generateMetadata } from '@/app/[locale]/login/page';
```

`signup`, `forgot-password`, `reset-password`, `signup/oauth/consent`도 같은 형태로 각 원본 page를 re-export한다(원본이 `generateMetadata`를 export하지 않으면 `default`만). 이 페이지들은 ai 레이아웃(헤더·푸터 없음) 안에서 렌더된다.

- [ ] **Step 8: 위젯 테스트 통과** — Run: `yarn test src/widgets/agent-chat src/features/agent-chat` → PASS(i18n 추출 전에는 리터럴이 그대로 보이므로 통과). `yarn typecheck`.

- [ ] **Step 9: i18n 추출·번역·검증**

```bash
yarn i18n:extract --write --apply --only src/widgets/agent-chat
yarn i18n:extract --write --apply --only src/app/ai
yarn i18n:translate          # en/ja/zh (LLM, .env.local 키)
yarn i18n:verify && yarn i18n:lint
yarn test src/widgets/agent-chat src/features/agent-chat   # 추출 후에도 통과(테스트는 ko.json을 주입)
```

`--apply`가 리터럴을 `t('Component.hash')`로 치환하므로 Step 6의 한국어 텍스트는 카탈로그 `widgets.agent-chat.*`로 이동한다. `lint-baseline`이 새 파일의 미추출 리터럴을 잡으면 그 파일을 다시 `--apply`한다.

- [ ] **Step 10: 실기동 확인** — `yarn dev` 후 `http://ai.localhost:3000/` 접속: 비로그인 랜딩 → `/login`(ai 레이아웃) → 로그인 → 새 대화 → "AAPL 지금 얼마야" → 툴 칩 + 스트리밍 답변 → 새로고침 후 사이드바에 대화. Chrome 확장으로 하이드레이션 에러 0 확인(메모리: 숨김 탭 함정 — 탭을 전면에).

- [ ] **Step 11: Commit** — `feat(ai): 에이전트 챗 UI·페이지·인증 re-export·i18n`

---

### Task 12: OAuth redirect base를 호스트 인식으로 + env

**Files:**
- Modify: `src/features/auth-oauth/lib/providers.ts:44-60`
- Modify: `src/app/api/auth/[provider]/start/route.ts:43`
- Modify: `.env.example`, `infra/aws/check-env.sh`(`OPTIONAL_KEYS`), `infra/aws/04-params.sh` 실행 안내
- Test: `src/features/auth-oauth/__tests__/lib/providers.test.ts`(케이스 추가)

- [ ] **Step 1: 테스트 추가**

```ts
describe('resolveOAuthRedirectBase', () => {
    it('허용목록 호스트면 그 origin, 아니면 기본 base', () => {
        process.env.OAUTH_REDIRECT_BASE_URL = 'https://siglens.io';
        process.env.AI_SITE_URL = 'https://ai.siglens.io';
        expect(resolveOAuthRedirectBase('ai.siglens.io')).toBe('https://ai.siglens.io');
        expect(resolveOAuthRedirectBase('siglens.io')).toBe('https://siglens.io');
        expect(resolveOAuthRedirectBase('evil.siglens.io.attacker.com')).toBe('https://siglens.io');
        expect(resolveOAuthRedirectBase(null)).toBe('https://siglens.io');
    });
});
```

- [ ] **Step 2: 구현** — `providers.ts`에 추가하고 `buildOAuthRedirectUri(provider, hostHeader)`로 시그니처 확장:

```ts
/** Exact-match host allowlist (spec §9-1 OAuth). Never parses arbitrary URLs from the request. */
export function resolveOAuthRedirectBase(hostHeader: string | null): string {
    const base = getOAuthRedirectBaseUrl();
    const ai = process.env.AI_SITE_URL?.replace(/\/+$/, '');
    if (!hostHeader || !ai) return base;
    const host = hostHeader.toLowerCase().split(':')[0];
    return host === new URL(ai).hostname ? ai : base;
}

export function buildOAuthRedirectUri(provider: SupportedOAuthProvider, hostHeader: string | null = null): string {
    return `${resolveOAuthRedirectBase(hostHeader)}/api/auth/callback/${provider}`;
}
```

`start/route.ts:43`: `buildOAuthRedirectUri(provider, request.headers.get('host'))`. 콜백 라우트가 토큰 교환 시 같은 `redirect_uri`를 다시 보내야 하면(구글은 필수) 콜백에서도 `request.headers.get('host')`로 같은 값을 만든다 — 콜백 파일에서 `buildOAuthRedirectUri` 호출부를 grep해 동일하게 바꾼다.

`.env.example`에 추가:

```
# ── ai.siglens.io ────────────────────────────────────────────────────────
# ai 호스트 절대 URL. OAuth 콜백 허용목록과 메인→ai 301에 쓴다. 로컬은 http://ai.localhost:3000
# (OPTIONAL_KEYS에 등록 — 없으면 ai 호스트 OAuth가 메인 호스트로 돌아와 쿠키가 엉뚱한 호스트에 심긴다)
AI_SITE_URL=
NEXT_PUBLIC_AI_SITE_URL=
# Brave Search API 키. 없으면 web_search 툴이 카탈로그에서 빠진다(OPTIONAL_KEYS).
BRAVE_SEARCH_API_KEY=
# 킬 스위치. 1이면 /api/ai/chat/stream이 503 (OPTIONAL_KEYS).
AGENT_CHAT_DISABLED=
```

`check-env.sh`의 `OPTIONAL_KEYS=(` 배열에 `AI_SITE_URL NEXT_PUBLIC_AI_SITE_URL BRAVE_SEARCH_API_KEY AGENT_CHAT_DISABLED` 추가.

- [ ] **Step 3: 통과 확인** — Run: `yarn test src/features/auth-oauth src/app/api/auth && yarn typecheck` → PASS.

- [ ] **Step 4: Commit** — `feat(auth): OAuth redirect base 호스트 허용목록(ai.siglens.io) + env 등록`

---

### Task 13 (P2): `run_fresh_analysis`·`web_search` 실행기

**Files:**
- Create: `src/app/api/ai/chat/tools/runFreshAnalysis.ts`, `webSearch.ts`
- Modify: `src/app/api/ai/chat/tools/index.ts` (레지스트리 2개 추가)
- Test: `src/app/api/ai/chat/tools/__tests__/{runFreshAnalysis,webSearch}.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/app/api/ai/chat/tools/__tests__/webSearch.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webSearchTool } from '@/app/api/ai/chat/tools/webSearch';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };
afterEach(() => vi.restoreAllMocks());

describe('webSearchTool', () => {
    it('Brave에 q·count·freshness를 보내고 상위 5건 스니펫만 돌려준다', async () => {
        process.env.BRAVE_SEARCH_API_KEY = 'b';
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ web: { results: Array.from({ length: 8 }, (_, i) => ({ title: `t${i}`, url: `https://x/${i}`, description: `d${i}`, age: '1 day ago' })) } }));
        const r = (await webSearchTool({ query: 'Apple earnings', freshness: 'week' }, ctx, { analysisModel: 'deepseek-v4.1-flash' })) as { results: unknown[] };
        const url = new URL(String(fetchMock.mock.calls[0]![0]));
        expect(url.origin + url.pathname).toBe('https://api.search.brave.com/res/v1/web/search');
        expect(url.searchParams.get('q')).toBe('Apple earnings');
        expect(url.searchParams.get('count')).toBe('5');
        expect(url.searchParams.get('freshness')).toBe('pw');
        expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'X-Subscription-Token': 'b' });
        expect(r.results).toHaveLength(5);
        expect(r.results[0]).toEqual({ title: 't0', url: 'https://x/0', snippet: 'd0', age: '1 day ago' });
    });
    it('비 2xx → error search_failed', async () => {
        process.env.BRAVE_SEARCH_API_KEY = 'b';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 429 }));
        expect(await webSearchTool({ query: 'q' }, ctx, { analysisModel: 'deepseek-v4.1-flash' })).toEqual({ error: 'search_failed', status: 429 });
    });
});
```

```ts
// src/app/api/ai/chat/tools/__tests__/runFreshAnalysis.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ runAnalysis: vi.fn(), overall: vi.fn(), news: vi.fn(), options: vi.fn(), profile: vi.fn(async () => 'us-equity'), assetInfo: vi.fn(async () => ({ name: 'Apple' })) }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({ ...(await importOriginal<object>()), runAnalysis: m.runAnalysis }));
vi.mock('@/entities/analysis/actions', () => ({ runOverallAnalysisAction: m.overall }));
vi.mock('@/entities/news-article/actions', () => ({ submitNewsAnalysisAction: m.news }));
vi.mock('@/entities/options-chain/actions', () => ({ submitOptionsAnalysisAction: m.options }));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({ resolveMarketProfile: m.profile }));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({ getAssetInfo: m.assetInfo }));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({ getCachedMarketDataProvider: () => ({}) }));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: () => ({}) }));
vi.mock('@/shared/config/marketProfile', () => ({ getDescriptor: () => ({ assetClass: 'equity', priceFormat: { currency: 'USD' } }) }));
import { runFreshAnalysisTool, __resetFreshSemaphoreForTests } from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { __activeStreamCount, __resetActiveStreamsForTests } from '@/shared/lib/sse/activeStreams';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('runFreshAnalysisTool', () => {
    beforeEach(() => { vi.clearAllMocks(); __resetFreshSemaphoreForTests(); __resetActiveStreamsForTests(); });
    it('technical: core runAnalysis를 사용자 분석 모델·tier로 부르고 결과 요약을 돌려준다', async () => {
        m.runAnalysis.mockResolvedValue({ status: 'done', result: { summary: 's', trend: 'bullish', riskLevel: 'low', keyLevels: {}, priceTargets: {} } });
        const r = await runFreshAnalysisTool({ symbol: 'AAPL', kind: 'technical' }, ctx, rt);
        expect(r).toMatchObject({ found: true, source: 'fresh', tab: 'technical', analysis: { summary: 's' } });
        const [symbol, companyName, timeframe, force, , options] = m.runAnalysis.mock.calls[0]!;
        expect([symbol, companyName, timeframe, force]).toEqual(['AAPL', 'Apple', '1Day', false]);
        expect(options).toMatchObject({ modelId: 'deepseek-v4.1-flash', tierContext: { userId: 'u', tier: 'member' }, locale: 'ko', reasoning: false });
        expect(options.signal).toBeUndefined(); // 스펙 §6-3: abort 시그널을 넘기지 않는다
        expect(__activeStreamCount()).toBe(0); // 실행 후 슬롯 해제
    });
    it('overall/news/options 분기', async () => {
        m.overall.mockResolvedValue({ status: 'cached', result: { headlineKo: 'h' } });
        m.news.mockResolvedValue({ status: 'done', result: { summary: 'n' } });
        m.options.mockResolvedValue({ status: 'error', error: { code: 'no_chains' } });
        expect(await runFreshAnalysisTool({ symbol: 'AAPL', kind: 'overall' }, ctx, rt)).toMatchObject({ found: true, analysis: { headlineKo: 'h' } });
        expect(await runFreshAnalysisTool({ symbol: 'AAPL', kind: 'news' }, ctx, rt)).toMatchObject({ found: true });
        expect(await runFreshAnalysisTool({ symbol: 'AAPL', kind: 'options' }, ctx, rt)).toEqual({ error: 'analysis_failed', code: 'no_chains' });
    });
    it('세마포어 2 초과 → busy', async () => {
        m.runAnalysis.mockImplementation(() => new Promise(() => {}));
        void runFreshAnalysisTool({ symbol: 'A', kind: 'technical' }, ctx, rt);
        void runFreshAnalysisTool({ symbol: 'B', kind: 'technical' }, ctx, rt);
        expect(await runFreshAnalysisTool({ symbol: 'C', kind: 'technical' }, ctx, rt)).toEqual({ error: 'busy', retryAfterSeconds: 60 });
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

```ts
// src/app/api/ai/chat/tools/webSearch.ts
import 'server-only';
import type { ToolExecutor } from './index';

const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const COUNT = 5;
const FRESHNESS: Record<string, string> = { day: 'pd', week: 'pw', month: 'pm' };
const TIMEOUT_MS = 7_000;

interface BraveResult { title: string; url: string; description?: string; age?: string }

/** Snippets only — no page fetch tool exists (spec §8: no SSRF / injection surface). */
export const webSearchTool: ToolExecutor = async (args, ctx) => {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) return { error: 'search_unavailable' };
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', String(args.query));
    url.searchParams.set('count', String(COUNT));
    url.searchParams.set('search_lang', ctx.locale === 'ko' ? 'ko' : 'en');
    if (typeof args.freshness === 'string' && FRESHNESS[args.freshness]) url.searchParams.set('freshness', FRESHNESS[args.freshness]!);
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    if (!response.ok) return { error: 'search_failed', status: response.status };
    const payload = (await response.json()) as { web?: { results?: BraveResult[] } };
    return {
        asOf: new Date().toISOString(),
        source: 'Brave Search',
        results: (payload.web?.results ?? []).slice(0, COUNT).map(r => ({ title: r.title, url: r.url, snippet: r.description ?? '', age: r.age ?? null })),
    };
};
```

```ts
// src/app/api/ai/chat/tools/runFreshAnalysis.ts
import 'server-only';
import { runAnalysis, type SubmitAnalysisOptions, type Timeframe } from '@y0ngha/siglens-core';
import { runOverallAnalysisAction } from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import type { ToolExecutor } from './index';

/** Per-instance semaphore (spec §4-5): fresh analyses are the heavy path. */
const MAX_CONCURRENT_FRESH = 2;
let inFlight = 0;
export function __resetFreshSemaphoreForTests(): void { inFlight = 0; }

const DEFAULT_TIMEFRAME: Timeframe = '1Day';

type Outcome = { status: string; result?: unknown; error?: { code?: string } };
function unwrap(kind: string, timeframe: Timeframe | undefined, outcome: Outcome): unknown {
    if ((outcome.status === 'done' || outcome.status === 'cached') && outcome.result !== undefined) {
        return { found: true, source: 'fresh', tab: kind, ...(timeframe ? { timeframe } : {}), generatedAt: new Date().toISOString(), stale: false, analysis: outcome.result };
    }
    return { error: 'analysis_failed', code: outcome.error?.code ?? outcome.status };
}

/**
 * Runs a NEW analysis through the same entry points as the analysis stream
 * route. Deliberately does NOT forward `ctx.signal`: core `dedupeInFlight`
 * shares the promise with prewarm/symbol-page callers, so an aborted chat
 * must not kill their analysis (spec §6-3). Holds one activeStreams slot.
 */
export const runFreshAnalysisTool: ToolExecutor = async (args, ctx, runtime) => {
    if (inFlight >= MAX_CONCURRENT_FRESH) return { error: 'busy', retryAfterSeconds: 60 };
    inFlight += 1;
    const release = registerActiveStream();
    try {
        const symbol = String(args.symbol).toUpperCase();
        const kind = String(args.kind);
        const timeframe = (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;
        const [profile, asset] = await Promise.all([resolveMarketProfile(symbol), getAssetInfo(symbol)]);
        const companyName = asset?.name ?? symbol;
        const descriptor = getDescriptor(profile);

        switch (kind) {
            case 'technical': {
                const options: SubmitAnalysisOptions = {
                    modelId: runtime.analysisModel,
                    marketDataProvider: getCachedMarketDataProvider(sessionSpecFor(profile)),
                    assetClass: descriptor.assetClass,
                    currency: descriptor.priceFormat.currency,
                    tierContext: { userId: ctx.userId, tier: ctx.tier },
                    reasoning: false,
                    locale: ctx.locale,
                    skipEnqueueIfMiss: false,
                };
                return unwrap(kind, timeframe, (await runAnalysis(symbol, companyName, timeframe, false, asset?.fmpSymbol, options)) as Outcome);
            }
            case 'overall':
                return unwrap(kind, timeframe, (await runOverallAnalysisAction(symbol, companyName, timeframe, runtime.analysisModel, ctx.locale, { reasoning: false })) as Outcome);
            case 'news':
                return unwrap(kind, undefined, (await submitNewsAnalysisAction(symbol, companyName, runtime.analysisModel, ctx.locale, false)) as Outcome);
            case 'options':
                return unwrap(kind, undefined, (await submitOptionsAnalysisAction(symbol, companyName, 'all', runtime.analysisModel, ctx.locale, false)) as Outcome);
            default:
                return { error: 'invalid_args', issues: [{ path: 'kind', message: 'unknown kind' }] };
        }
    } finally {
        inFlight -= 1;
        release();
    }
};
```

`tools/index.ts`의 `EXECUTORS`에 `run_fresh_analysis: runFreshAnalysisTool, web_search: webSearchTool`을 추가하고 P2 주석을 지운다. 액션 시그니처의 선택 인자(reasoning·signal·cacheOnly)는 각 파일의 실제 순서를 따른다(`submitOptionsAnalysisAction(symbol, companyName, expirationDate, modelId, locale, reasoning?, signal?, cacheOnly?)`).

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/api/ai/chat/tools && yarn typecheck && yarn lint` → PASS. `index.test.ts`의 가용 툴 기대값을 `run_fresh_analysis` 포함 7종(+키 있으면 `web_search`)으로 갱신.

- [ ] **Step 5: Commit** — `feat(api/ai): run_fresh_analysis(세마포어·activeStreams 슬롯)·web_search(Brave) 실행기`

---

### Task 14 (P2): 알람·킬 스위치·개인정보 고지·문서

**Files:**
- Modify: `infra/aws/07-alarms.sh` (알람 3개 추가)
- Modify: `src/app/[locale]/privacy` 본문(개정일·제3자 전송 항목) — 파일 위치는 `ls src/app/[locale]/privacy`로 확인
- Modify: `docs/reference/API.md`(env 4종·엔드포인트), `docs/architecture/DEPLOY_RUNBOOK.md`(§ ai.siglens.io 운영), `docs/architecture/ARCHITECTURE.md`(라우트 트리)

- [ ] **Step 1: 알람** — `07-alarms.sh`의 `analysis-stream-failed` 블록 뒤에:

```bash
# ai.siglens.io 에이전트 턴 실패 — 1시간 10건 초과. 마커는 agentEventStream.ts의 '[agent-stream] failed:'.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-stream-failed \
  --filter-pattern '"[agent-stream] failed"' \
  --metric-transformations metricName=AgentStreamFailed,metricNamespace=Siglens/Agent,metricValue=1,defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-stream-failed --namespace Siglens/Agent \
  --metric-name AgentStreamFailed --statistic Sum --period 3600 --evaluation-periods 1 --threshold 10 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# 에이전트 한도 스토어(Redis) 불가 — fail-closed라 사용자에게 server_busy로 보인다. 1시간 3건 초과.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-quota-store-unavailable \
  --filter-pattern '"[agent] turn lock release failed"' \
  --metric-transformations metricName=AgentQuotaStoreUnavailable,metricNamespace=Siglens/Agent,metricValue=1,defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-quota-store-unavailable --namespace Siglens/Agent \
  --metric-name AgentQuotaStoreUnavailable --statistic Sum --period 3600 --evaluation-periods 1 --threshold 3 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# 에이전트 출력 토큰 — 일 1M 초과(기본 모델 200턴의 ~5배; Sonnet이면 ~$50/일). [Usage] jobId:"agent"의 outputTokens 합.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-output-tokens \
  --filter-pattern '{ $.jobId = "agent" }' \
  --metric-transformations metricName=AgentOutputTokens,metricNamespace=Siglens/Agent,metricValue='$.outputTokens',defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-output-tokens-daily --namespace Siglens/Agent \
  --metric-name AgentOutputTokens --statistic Sum --period 86400 --evaluation-periods 1 --threshold 1000000 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
```

`[Usage]` 라인은 `console.info('[Usage]', JSON.stringify(...))`라 메시지가 `[Usage] {...}` 형태다 — JSON 필터(`{ $.jobId = "agent" }`)는 메시지 전체가 JSON일 때만 매치한다(메모리: 공백 구분 필터는 조용히 미발행). `logUsage`를 `console.info(JSON.stringify({ tag: '[Usage]', ...fields }))`로 바꾸면 기존 Insights 쿼리(`like /\[Usage\]/`)도 계속 잡힌다. 이 변경은 `src/entities/llm-provider/lib/usage.ts` `logUsage` 1줄 + 기존 usage 테스트 기대값 수정으로 처리한다.

- [ ] **Step 2: 킬 스위치 운영 절차** — DEPLOY_RUNBOOK에 절 추가:

```
## ai.siglens.io 에이전트 챗
- 킬 스위치: `aws ssm put-parameter --name /siglens/AGENT_CHAT_DISABLED --value 1 --overwrite` → 인스턴스 env 리프레시(ISR_CACHE_DISABLED와 같은 경로) → /api/ai/chat/stream 503, 페이지는 점검 안내. 해제는 값 0.
- 알람: siglens-agent-stream-failed(1h 10건) · siglens-agent-quota-store-unavailable · siglens-agent-output-tokens-daily(1M)
- 진단 순서: [Agent] 라인(턴당 1건: steps·toolsUsed·ms·fallback) → [Usage] jobId agent → 툴 실패면 [agent-stream] failed 앞뒤 로그
- Cloudflare: Public Hostname ai.siglens.io(터널) · Rate Limiting 규칙 /api/ai/* 10초 10요청
- 롤백: 테이블만 추가라 마이그레이션 되돌림 불필요. hostname은 코드 롤백에 안 따라오므로 구 빌드는 ai 호스트에 메인 사이트를 보여준다(무해)
```

- [ ] **Step 3: 개인정보 고지** — `/privacy` 본문에 항목 추가: "AI 대화 기능(ai.siglens.io)에서 입력한 메시지와 조회된 데이터는 답변 생성을 위해 DeepSeek(중국)·Anthropic(미국)에 전송됩니다. 대화는 계정에 저장되며 대화 목록에서 삭제할 수 있습니다." + 개정일 갱신. 4개 로케일 카탈로그(`i18n:translate`).

- [ ] **Step 4: API.md·ARCHITECTURE.md** — env 표에 `AI_SITE_URL`·`NEXT_PUBLIC_AI_SITE_URL`·`BRAVE_SEARCH_API_KEY`·`AGENT_CHAT_DISABLED`, 엔드포인트 `POST /api/ai/chat/stream`(요청·이벤트 스펙 §6-3 요약), 라우트 트리에 `app/ai/[locale]`.

- [ ] **Step 5: 통과 확인** — `yarn test src/entities/llm-provider && yarn i18n:verify` → PASS.

- [ ] **Step 6: Commit** — `chore(ops): 에이전트 알람·킬 스위치 런북·개인정보 고지·API 문서`

---

### Task 15: e2e·리뷰·Cloudflare·배포·실증

**Files:**
- Create: `e2e/specs/agent-chat.spec.ts`

- [ ] **Step 1: e2e 스펙** (E2E는 `isE2E()`로 fake provider·`web_search` 제외, FMP 키 없음 전제 — `get_quote`는 fake market provider)

```ts
// e2e/specs/agent-chat.spec.ts
import { test, expect } from '../support/fixtures';
import { AUTH_STORAGE_STATE } from '../support/authUser';

test.describe('ai.siglens.io agent chat', () => {
    test.use({ storageState: AUTH_STORAGE_STATE, extraHTTPHeaders: { host: 'ai.localhost' } });

    test('로그인 회원: 대화 → 툴 칩 → 저장 → 재생성', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' });
        await expect(page.getByRole('heading', { name: /siglens AI/ })).toBeVisible();
        await page.getByRole('textbox', { name: /메시지 입력/ }).fill('AAPL 지금 얼마야');
        await page.keyboard.press('Enter');
        await expect(page.getByText(/get_quote/)).toBeVisible();
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        await page.reload();
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        await expect(page.getByRole('navigation', { name: '대화 목록' }).getByRole('link', { name: /AAPL 지금 얼마야/ })).toBeVisible();
        await page.getByRole('button', { name: /다시 생성/ }).click();
        await expect(page.getByText(/\[E2E agent\]/)).toHaveCount(1);
    });

    test('비로그인: 랜딩과 로그인 CTA, 스트림 401', async ({ page, request }) => {
        await page.context().clearCookies();
        await page.goto('/');
        await expect(page.getByRole('link', { name: /로그인하고 시작하기/ })).toBeVisible();
        const res = await request.post('/api/ai/chat/stream', { data: { message: 'x', model: 'deepseek-v4.1-flash' }, headers: { host: 'ai.localhost' } });
        expect(res.status()).toBe(401);
    });

    test('메인 호스트 /ai 는 ai 호스트로 301', async ({ request }) => {
        const res = await request.get('/ai/ko', { headers: { host: 'localhost' }, maxRedirects: 0 });
        expect(res.status()).toBe(301);
        expect(res.headers().location).toMatch(/^http:\/\/ai\.localhost:3000\/ko/);
    });
});
```

`e2e/setup`(global setup)에서 E2E 서버 env에 `AI_SITE_URL=http://ai.localhost:3000 NEXT_PUBLIC_AI_SITE_URL=http://ai.localhost:3000`을 추가한다(`docker-compose.e2e.yml`/`run-e2e.sh`의 env 목록). Playwright `extraHTTPHeaders.host`가 무시되면 `baseURL`을 `http://ai.localhost:4300`으로 두는 별도 project를 `playwright.config.ts`에 추가한다(`*.localhost`는 브라우저가 루프백으로 해석).

Run: `yarn e2e` (로컬, compose 고아 프로세스 주의 — 메모리) → 3 tests PASS.

- [ ] **Step 2: 전체 게이트** — `yarn typecheck && yarn lint && yarn test`(전체 1회, 실패 시 실패 파일만 반복) → PASS, 커버리지 90% 유지.

- [ ] **Step 3: review-agent → mistake-managing-agent → git-agent(PR)** — CLAUDE.md 라우팅대로. PR CI(ci·e2e-required) 초록 확인, claude-review 코멘트 반영(재트리거는 Draft 토글).

- [ ] **Step 4: Cloudflare·OAuth·SSM (사용자 수동, 태그 전)**

1. Zero Trust → Tunnels → siglens 터널 → Public Hostname: `ai.siglens.io` → `http://localhost:3000`.
2. Security → WAF → Rate limiting rules: `/api/ai/*` — 10초에 10요청 초과 시 Block 10초(무료 플랜 규칙 1개).
3. 각 OAuth 콘솔에 `https://ai.siglens.io/api/auth/callback/{provider}` 추가.
4. `bash infra/aws/04-params.sh <env-file>`로 `AI_SITE_URL`·`NEXT_PUBLIC_AI_SITE_URL`·`BRAVE_SEARCH_API_KEY`(선택) 등록. `bash infra/aws/07-alarms.sh`.

- [ ] **Step 5: 배포** — 머지 후 사용자 확인 하에 `yarn db:migrate`(대상 로그로 운영 Neon 확인) → `yarn release`(태그 push = 배포). 배포 완료 후:

```bash
curl -sI https://ai.siglens.io/ | grep -iE 'content-security-policy|x-robots-tag'   # img-src / noindex
curl -s https://ai.siglens.io/robots.txt                                             # Disallow: /
curl -sI https://siglens.io/robots.txt | head -1                                     # 200 (무변경)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://siglens.io/ai/ko   # 301 https://ai.siglens.io/ko
```

- [ ] **Step 6: 실증(Chrome)** — 메모리 규칙(전면 탭, SW 옛 빌드 주의) 하에: ai.siglens.io 로그인(OAuth 포함) → 4턴 대화(시세·캐시 분석·뉴스·신선 분석 자동 실행 진행바) → 새로고침 복원 → 재생성·수정 → 다른 계정으로 그 대화 URL 404 → Rate Limiting(10초 11요청 curl) 429/블록 확인. CloudWatch에 `[Agent]`·`[Usage] jobId agent` 라인 확인. 결과를 스펙 §16에 "검증 완료" 표기.

---

## Self-review (spec ↔ plan)

- R1 호스트·레이아웃: Task 1·3·11 ✓. R2 캐시 분석: Task 9 `get_cached_analysis` ✓. R3 툴·검색: Task 9·13 ✓. R4 자동 신선 분석: Plan A Task 10 + Task 13(확인 없음, 세마포어) ✓. R5 뉴스 `since/query/includeBody`·옵션 ✓. R6 저장·재개·최근 8턴: Task 6·10, Plan A Task 5 ✓. R7 비용 가드: 알람·킬 스위치 Task 14, 전역 검색 상한 Plan A ✓. R8 ✓.
- 스펙 §2-3(host-only 쿠키·ai 서브트리 인증 re-export): Task 11 Step 7 + Task 12 ✓. §2-11 전용 writer: Task 10 ✓. §2-13 app 레이어 실행기: Task 9 ✓. §2-14 마감 600/300: Plan A Task 9 ✓. §6-3 abort 규칙: Task 10·13 ✓. §8 CSP·img·Rate Limiting: Task 3·11·15 ✓. §9-1 robots·301·예약어: Task 3 ✓. §9-3 i18n 루트: 레이아웃이 명시 네임스페이스로 우회(Task 11) — 추출기 `APP` 일반화는 **미포함**(`--only src/app/ai`로 추출은 되지만 `routes` 버킷은 안 만들어짐; 명시 목록으로 충분). 스펙 §17 편차로 기록할 것.
- 타입 일관성: `ToolExecutor(args, ctx, runtime)`(Task 9) vs core `ExecuteTool(name, args, ctx)`(Plan A) — `createToolExecutor`가 어댑터 ✓. `AgentCounters` 6키 이름 Plan A Task 10 = Task 8 ✓. `AgentTurnEvent` → `agentEventStream` 직렬화 `{type, ...data}` = 훅 파서 기대(`text.delta`, `tool_start.id/name/args`) ✓. 라우트 done 페이로드 `{assistantMessageId, remaining, stopReason, title?}` = 훅 ✓. 에러 프레임 `{code,message}` = 훅 ✓.
- 플레이스홀더 없음. `getDescriptor`/`MS_PER_DAY`/`ModelOption` import 경로는 실제 export를 따르라는 지시가 붙어 있다(실행자가 첫 typecheck에서 확정).
