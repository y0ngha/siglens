# SiglensAI(ai.siglens.io) 에이전트 챗 — Plan B: siglens (P-1 스파이크 → P1 골격 → P2 완성) · v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ai.siglens.io`(제품명 SiglensAI)에서 siglens 회원이 SSO로 들어와 툴 콜링 에이전트와 대화하고, 대화가 저장·재개되며, 보유종목이 연동되는 제품을 siglens 앱 안에 붙인다(스펙 v2.2 R1~R12).

**Architecture:** 호스트 기반 rewrite로 `app/ai/[locale]/*`가 자체 `<html>` 레이아웃을 갖는다. 에이전트 루프·툴 스키마·한도는 core 1.1.0(Plan A). siglens는 DeepSeek 단일 어댑터(모델 서버 고정·추론 OFF), 툴 실행기(app 레이어), SSE writer, Drizzle 저장, UI, SSO 핸드오프(1회용 코드, host-only 쿠키), 인프라를 담당한다.

**Tech Stack:** Next.js 16 App Router(standalone), React 19, next-intl 4, Drizzle + Neon(neon-http: 트랜잭션 없음), Upstash Redis, `openai` SDK(DeepSeek 호환), vitest(커버리지 90%), Playwright e2e, oxlint FSD 레이어 규칙, Cloudflare Tunnel. 스펙: `docs/superpowers/specs/2026-09-11-ai-siglens-agent-chat-design.md`(v2.2).

**전제:** Plan A가 끝나 `@y0ngha/siglens-core@1.1.0`이 GitHub Packages에 실물로 존재한다(tarball 확인). Task 0~1은 core 없이도 가능.

**작업 규칙(CLAUDE.md·메모리):** 워크트리 작업, 커밋·푸시는 git-agent, 구현 후 review-agent 필수. 테스트는 `yarn test`(npx vitest 금지), 실패 루프는 실패 파일만. 스코프 게이트 = `yarn typecheck` + 스코프 테스트 + `yarn lint`(경고 **수** 확인). `--no-verify` 금지. 한국어 UI 문자열은 리터럴로 쓰고 `yarn i18n:extract --write --apply --only <dir>`로 카탈로그화. 디자인은 siglens 톤(DESIGN.md 토큰만, `SURFACE_CARD`·`HEADING_SECTION`·`border-control`·포커스 링, 두 테마).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/shared/config/aiHost.ts` (신규) | `AI_HOSTS`·`AI_SITE_URL`·`isAiHost` |
| `src/proxy.ts` (수정) | ai 호스트 분기(rewrite·CSP·robots), 메인 `/ai/*` 301, `'ai'` 예약 |
| `src/app/api/sitemap/route.ts` (수정) | ai 호스트 404 |
| `src/entities/llm-provider/lib/serverKeys.ts` (신규) | `getServerPrimaryKey` (chatAction에서 이동) |
| `src/entities/llm-provider/api/agent/{mapMessages,deepseek,router,fake,index}.ts` (신규) | DeepSeek 에이전트 어댑터·고정 모델 라우터·E2E fake |
| `src/shared/db/schema.ts` (수정) + `drizzle/0035_*.sql` | `chat_conversations`·`chat_messages` |
| `src/entities/chat-conversation/{model,api,index}.ts`, `actions/*`, `actions.ts` (신규) | 리포지토리·서버 액션 |
| `src/shared/lib/sse/activeStreams.ts` (수정) | `registerActiveStream()` |
| `src/app/api/ai/chat/{turnLock,counters,resolveAgentTier,agentEventStream}.ts` (신규) | 락·카운터·티어·SSE writer |
| `src/app/api/ai/chat/tools/*.ts` (신규) | 툴 실행기 9종 + 절단 + 레지스트리 |
| `src/app/api/ai/chat/stream/route.ts` (신규) | SSE 라우트 |
| `src/entities/auth/lib/handoffStore.ts` (신규), `src/app/api/auth/handoff/route.ts`, `src/app/api/auth/handoff/consume/route.ts` (신규) | SSO 핸드오프 |
| `src/features/agent-chat/{lib/parseSseFrames,hooks/useAgentStream,index}.ts` (신규) | 클라이언트 스트림 |
| `src/widgets/agent-chat/*` (신규) | ChatShell·Sidebar·MessageList·Composer·ToolActivity·EmptyState·AgentMarkdown·AiHeader |
| `src/app/ai/[locale]/{layout,page,not-found}.tsx`, `c/[id]/page.tsx` (신규) | 라우트 |
| `infra/aws/{07-alarms.sh,check-env.sh}`, `.env.example`, `src/entities/llm-provider/lib/usage.ts` (수정) | 알람·env·`[Usage]` JSON |
| `e2e/specs/agent-chat.spec.ts` (신규) | e2e |
| `docs/reference/API.md`, `docs/architecture/DEPLOY_RUNBOOK.md`, `/privacy` 본문 (수정) | 문서·고지 |

---

### Task 0: 워크트리·의존성 셋업

- [ ] **Step 1: 워크트리**

```bash
cd /Users/y0ngha/Project/siglens
git fetch origin master
git worktree add .claude/worktrees/agent-chat -b feat/agent-chat origin/master
cd .claude/worktrees/agent-chat
```

- [ ] **Step 2: node_modules 하드링크** (symlink 금지, 대상 부재 확인 후 `/.`)

```bash
test ! -e node_modules && cp -al /Users/y0ngha/Project/siglens/node_modules/. node_modules
ls node_modules/node_modules 2>/dev/null && echo "NESTED — rm -rf node_modules and redo" || echo ok
```

- [ ] **Step 3: 기준선** — Run: `yarn typecheck && yarn lint 2>&1 | tail -3` → 0 errors. 경고 수 메모.

---

### Task 1 (P-1 스파이크): 형제 `<html>` 레이아웃이 standalone 빌드를 통과하는지

**Files:** Create `src/app/ai/[locale]/layout.tsx`, `src/app/ai/[locale]/page.tsx` (최소)

- [ ] **Step 1: 최소 레이아웃·페이지**

```tsx
// src/app/ai/[locale]/layout.tsx
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import '../../globals.css';

export const dynamic = 'force-dynamic';

export default async function AiRootLayout({ children, params }: { readonly children: ReactNode; readonly params: Promise<{ locale: string }> }) {
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
    return <main className="p-4">SiglensAI spike</main>;
}
```

- [ ] **Step 2: 오프라인 프로덕션 빌드** — Run: `SIGLENS_OFFLINE_BUILD=1 UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= UPSTASH_REDIS_REST_READONLY_TOKEN= yarn build; echo "exit=$?"` → `exit=0`, 라우트 표에 `/ai/[locale]` `ƒ`.

- [ ] **Step 3: standalone 실기동**

```bash
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
PORT=3999 node .next/standalone/server.js &
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/ai/ko      # 200
curl -s http://localhost:3999/ai/ko | grep -c '<html'                   # 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3999/ko         # 200
kill %1
```

- [ ] **Step 4: go/no-go** — 통과 → 스펙 §16-1에 `(검증 완료 YYYY-MM-DD)` 추가. 실패 → 중단, 스펙 §16-1 대안(다중 루트 레이아웃)으로 재계획.

- [ ] **Step 5: Commit** — `chore(ai): 형제 html 레이아웃 스파이크(빌드·실기동 통과)`

---

### Task 2: core 1.1.0 bump

- [ ] **Step 1:** `package.json` `"@y0ngha/siglens-core": "1.0.4"` → `"1.1.0"`, `yarn install`(워크트리 안).
- [ ] **Step 2:** Run: `node -e "const c=require('@y0ngha/siglens-core');console.log(typeof c.runAgentTurn, c.AGENT_TOOL_SPECS.length)"` → `function 9`.
- [ ] **Step 3: Commit** — `chore(deps): siglens-core 1.1.0 (agent loop)`

---

### Task 3: proxy 호스트 분기·robots·CSP·`'ai'` 예약·sitemap 404

**Files:**
- Create: `src/shared/config/aiHost.ts`
- Modify: `src/proxy.ts`, `src/app/__tests__/proxy.test.ts`(`makeRequest`에 headers), `src/app/api/sitemap/route.ts`
- Test: `src/app/__tests__/proxy.aiHost.test.ts`, `src/app/api/sitemap/__tests__/aiHost.test.ts`

- [ ] **Step 1: 테스트**

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
    return { url: `https://${host}${path}`, headers: new Headers({ host }), cookies: { get: () => undefined } } as unknown as NextRequest;
}

describe('proxy — ai host', () => {
    beforeEach(() => vi.clearAllMocks());

    it('루트를 /ai/{locale}로 rewrite하고 CSP·noindex 헤더를 붙인다', () => {
        const res = proxy(makeRequest('ai.siglens.io', '/')) as unknown as { headers: Headers };
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
        expect(res.headers.get('content-security-policy')).toBe("img-src 'self' data:");
        expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    });
    it('로케일 접두 경로 유지', () => {
        proxy(makeRequest('ai.siglens.io', '/en/c/abc'));
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/en/c/abc');
    });
    it('dev 호스트 ai.localhost:3000', () => {
        proxy(makeRequest('ai.localhost:3000', '/'));
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
    });
    it('robots.txt는 Disallow 본문 직접 반환', () => {
        const res = proxy(makeRequest('ai.siglens.io', '/robots.txt')) as unknown as { body: string };
        expect(res.body).toBe('User-agent: *\nDisallow: /\n');
        expect(mockRewrite).not.toHaveBeenCalled();
    });
    it('메인 호스트 robots.txt는 next()', () => {
        proxy(makeRequest('siglens.io', '/robots.txt'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });
    it('메인 호스트 /ai/* → ai 호스트 301', () => {
        proxy(makeRequest('siglens.io', '/ai/ko/c/abc'));
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/ko/c/abc');
        expect(status).toBe(301);
    });
    it("'ai'는 예약 세그먼트", () => {
        expect(RESERVED_FIRST_SEGMENTS.has('ai')).toBe(true);
    });
});
```

```ts
// src/app/api/sitemap/__tests__/aiHost.test.ts
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/sitemap/route';

describe('sitemap on ai host', () => {
    it('ai 호스트 요청은 404', async () => {
        const res = await GET(new Request('https://ai.siglens.io/api/sitemap', { headers: { host: 'ai.siglens.io' } }));
        expect(res.status).toBe(404);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn test src/app/__tests__/proxy.aiHost.test.ts src/app/api/sitemap/__tests__/aiHost.test.ts` → FAIL.

- [ ] **Step 3: 구현**

```ts
// src/shared/config/aiHost.ts
/** Hosts served by the SiglensAI subtree. Port-suffixed dev host is stripped before matching. */
export const AI_HOSTS: ReadonlySet<string> = new Set(['ai.siglens.io', 'ai.localhost']);
export const AI_SITE_URL = process.env.NEXT_PUBLIC_AI_SITE_URL ?? 'https://ai.siglens.io';

export function isAiHost(hostHeader: string | null): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.toLowerCase().split(':')[0] ?? '';
    return AI_HOSTS.has(host);
}
```

`src/proxy.ts`:
1. `import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';`
2. `const RESERVED_FIRST_SEGMENTS` → `export const RESERVED_FIRST_SEGMENTS`, `'ai',` 추가.
3. `proxy` 앞에:

```ts
const AI_CSP = "img-src 'self' data:";
const AI_ROBOTS_BODY = 'User-agent: *\nDisallow: /\n';

function handleAiHost(req: NextRequest): NextResponse {
    const url = new URL(req.url);
    if (url.pathname === '/robots.txt') {
        return new NextResponse(AI_ROBOTS_BODY, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
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

4. `proxy()` 첫 줄:

```ts
    const hostHeader = req.headers?.get('host') ?? req.headers?.get('x-forwarded-host') ?? null;
    if (isAiHost(hostHeader)) return handleAiHost(req);
    if (new URL(req.url).pathname === '/robots.txt') return NextResponse.next();
```

5. `const firstSegment = …` 직후, 대문자 정규화 분기 앞:

```ts
    if (firstSegment?.toLowerCase() === 'ai') {
        const rest = pathname.replace(/^\/ai(?=\/|$)/i, '') || '/';
        return NextResponse.redirect(new URL(`${localePath(locale, rest)}${reqUrl.search}`, AI_SITE_URL), 301);
    }
```

6. `config.matcher`에 `'/robots.txt'` 추가.
7. **기존 `src/app/__tests__/proxy.test.ts`의 `makeRequest`** 반환 객체에 `headers: new Headers()`를 추가한다(호스트 분기가 `req.headers`를 읽으므로 없으면 전 케이스 TypeError). `req.headers?.get`의 optional chaining은 그 테스트를 위한 방어가 아니라 실제 런타임엔 항상 존재하므로, 테스트 수정 후 optional chaining을 제거해도 된다.

`src/app/api/sitemap/route.ts`의 `GET`에 `request: Request` 인자를 받아 첫 줄에:

```ts
import { isAiHost } from '@/shared/config/aiHost';
// …
export async function GET(request: Request): Promise<Response> {
    if (isAiHost(request.headers.get('host'))) return new Response(null, { status: 404 });
```

- [ ] **Step 4: 통과 확인** — Run: `yarn test src/app/__tests__ src/app/api/sitemap` → PASS(기존 proxy.test 포함).

- [ ] **Step 5: Commit** — `feat(proxy): ai 호스트 rewrite·robots·CSP·sitemap 404, 메인 /ai 301, 'ai' 예약`

---

### Task 4: 서버 키 헬퍼 이동

**Files:** Create `src/entities/llm-provider/lib/serverKeys.ts`; Modify `src/entities/chat-message/actions/chatAction.ts`, `src/entities/llm-provider/index.ts`; Test `src/entities/llm-provider/__tests__/lib/serverKeys.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { getServerPrimaryKey } from '@/entities/llm-provider/lib/serverKeys';
const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });
describe('getServerPrimaryKey', () => {
    it('provider별 *_CHAT_API_KEY', () => {
        process.env.DEEPSEEK_CHAT_API_KEY = 'd';
        expect(getServerPrimaryKey('deepseek')).toBe('d');
    });
    it('없으면 undefined', () => {
        delete process.env.OPENAI_CHAT_API_KEY;
        expect(getServerPrimaryKey('openai')).toBeUndefined();
    });
});
```

- [ ] **Step 2: 구현** — `serverKeys.ts`는 chatAction의 `getServerPrimaryKey` 본문을 그대로 옮긴다(`import 'server-only'`, `LlmProvider` switch 4분기 + `never` 가드). chatAction은 import로 교체, `index.ts`에 `export { getServerPrimaryKey } from './lib/serverKeys';`.

- [ ] **Step 3: 통과** — `yarn test src/entities/llm-provider src/entities/chat-message && yarn typecheck`.
- [ ] **Step 4: Commit** — `refactor(llm-provider): 서버 키 헬퍼를 lib/serverKeys로 이동`

---

### Task 5: DeepSeek 에이전트 어댑터·고정 모델 라우터·E2E fake

파일럿은 **DeepSeek flash 단일·추론 OFF**(R12). Anthropic 어댑터·폴백은 P3(스펙 §15).

**Files:**
- Create: `src/entities/llm-provider/api/agent/mapMessages.ts`, `deepseek.ts`, `router.ts`, `fake.ts`, `index.ts`
- Test: `src/entities/llm-provider/__tests__/api/agent/{mapMessages,deepseek,router,fake}.test.ts`

- [ ] **Step 1: 매핑 테스트**

```ts
// src/entities/llm-provider/__tests__/api/agent/mapMessages.test.ts
import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@y0ngha/siglens-core';
import { toOpenAiChatMessages } from '@/entities/llm-provider/api/agent/mapMessages';

const call = { id: 'c1', name: 'get_quote', args: { symbols: ['AAPL'] } };
const history: AgentMessage[] = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: '', toolCalls: [call] },
    { role: 'tool', content: '{"price":1}', toolCallId: 'c1', toolName: 'get_quote' },
    { role: 'assistant', content: 'done' },
];

describe('toOpenAiChatMessages', () => {
    it('tool_calls·tool 메시지로 매핑한다', () => {
        expect(toOpenAiChatMessages(history)).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_quote', arguments: '{"symbols":["AAPL"]}' } }] },
            { role: 'tool', tool_call_id: 'c1', content: '{"price":1}' },
            { role: 'assistant', content: 'done' },
        ]);
    });
});
```

- [ ] **Step 2: 매핑 구현**

```ts
// src/entities/llm-provider/api/agent/mapMessages.ts
import type OpenAI from 'openai';
import type { AgentMessage } from '@y0ngha/siglens-core';

export function toOpenAiChatMessages(messages: readonly AgentMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(m => {
        if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content };
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            return {
                role: 'assistant',
                content: m.content || null,
                tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })),
            };
        }
        return { role: m.role, content: m.content };
    });
}
```

- [ ] **Step 3: DeepSeek 어댑터 테스트** (청크 shape는 2026-09-11 실키 프로브 실측)

```ts
// src/entities/llm-provider/__tests__/api/agent/deepseek.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const create = vi.fn();
    return { mockCreate: create, MockOpenAI: vi.fn(() => ({ chat: { completions: { create } } })) };
});
vi.mock('openai', () => ({ default: MockOpenAI }));
import { callDeepseekAgent } from '@/entities/llm-provider/api/agent/deepseek';
import { AGENT_TOOL_SPECS, type AgentStreamEvent } from '@y0ngha/siglens-core';

async function* chunks(items: unknown[]) { for (const i of items) yield i; }
const TOOL_STREAM = [
    { choices: [{ delta: { role: 'assistant', content: '' } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_00_x', type: 'function', function: { name: 'get_quote', arguments: '' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"symbol' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 's": ["AAPL"]}' } }] } }] },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 284, completion_tokens: 39, prompt_cache_hit_tokens: 128, prompt_cache_miss_tokens: 156 } },
];
function opts(overrides = {}) {
    return { apiKey: 'k', apiModelId: 'deepseek-flash', model: 'deepseek-v4.1-flash' as const, system: 'sys', messages: [{ role: 'user' as const, content: 'AAPL?' }], tools: AGENT_TOOL_SPECS.filter(t => t.name === 'get_quote'), maxOutputTokens: 4096, signal: new AbortController().signal, onEvent: vi.fn<(e: AgentStreamEvent) => void>(), ...overrides };
}

describe('callDeepseekAgent', () => {
    beforeEach(() => vi.clearAllMocks());
    it('tool_calls 스트림 누적 → toolCalls·tool_use, thinking disabled, signal 전달', async () => {
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
    it('텍스트 델타 스트림 → end', async () => {
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

- [ ] **Step 4: DeepSeek 어댑터 구현**

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

/** DeepSeek via the OpenAI-compatible chat.completions stream; thinking OFF (spec §2-6, pilot). */
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
            // DeepSeek-only top-level field, absent from the openai SDK types.
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
    const toolCalls: AgentToolCall[] = [...partial.entries()].sort(([a], [b]) => a - b).map(([, s]) => ({ id: s.id, name: s.name, args: parseArgs(s.args) }));
    for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });
    const normalized = extractDeepSeekUsage(usage);
    logUsage({ jobId: AGENT_JOB_ID, model: o.apiModelId, latencyMs: Date.now() - startedAt, ...normalized });
    o.onEvent({ type: 'usage', usage: normalized });
    const stopReason = toolCalls.length > 0 && finish === 'tool_calls' ? 'tool_use' : mapStopReason(finish);
    o.onEvent({ type: 'stop', reason: stopReason });
    return { text, toolCalls, stopReason, usage: normalized };
}
```

- [ ] **Step 5: 라우터·fake 테스트**

```ts
// src/entities/llm-provider/__tests__/api/agent/router.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockDeepseek } = vi.hoisted(() => ({ mockDeepseek: vi.fn() }));
vi.mock('@/entities/llm-provider/api/agent/deepseek', () => ({ callDeepseekAgent: mockDeepseek, AGENT_JOB_ID: 'agent' }));
import { AGENT_MODEL, createAgentProvider } from '@/entities/llm-provider/api/agent/router';
import type { AgentProviderResult } from '@y0ngha/siglens-core';

const OK: AgentProviderResult = { text: 'ok', toolCalls: [], stopReason: 'end', usage: { promptTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 1 } };
const base = { system: 's', messages: [], tools: [], maxOutputTokens: 100, signal: new AbortController().signal, onEvent: vi.fn(), apiKey: '' };

describe('createAgentProvider (pilot: DeepSeek flash fixed)', () => {
    beforeEach(() => { vi.clearAllMocks(); process.env.DEEPSEEK_CHAT_API_KEY = 'ds'; });
    it('AGENT_MODEL은 deepseek-v4.1-flash, apiModelId deepseek-flash + 서버 키로 호출', async () => {
        mockDeepseek.mockResolvedValue(OK);
        expect(AGENT_MODEL).toBe('deepseek-v4.1-flash');
        const provider = createAgentProvider();
        await provider({ ...base, model: 'claude-opus-5' }); // 클라이언트/코어가 무엇을 넘기든 무시
        expect(mockDeepseek).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'ds', apiModelId: 'deepseek-flash', model: 'deepseek-v4.1-flash' }));
    });
    it('서버 키 없음 → throw', async () => {
        delete process.env.DEEPSEEK_CHAT_API_KEY;
        await expect(createAgentProvider()({ ...base, model: 'deepseek-v4.1-flash' })).rejects.toThrow(/No API key/);
    });
    it('프로바이더 오류는 그대로 전파(폴백 없음, P3)', async () => {
        mockDeepseek.mockRejectedValue(Object.assign(new Error('busy'), { status: 503 }));
        await expect(createAgentProvider()({ ...base, model: 'deepseek-v4.1-flash' })).rejects.toThrow('busy');
    });
});
```

```ts
// src/entities/llm-provider/__tests__/api/agent/fake.test.ts
import { describe, expect, it, vi } from 'vitest';
import { fakeAgentProvider } from '@/entities/llm-provider/api/agent/fake';
const base = { apiKey: '', model: 'deepseek-v4.1-flash' as const, system: 's', tools: [{ name: 'get_quote', description: 'd', costClass: 'free' as const, inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false as const } }], maxOutputTokens: 100, signal: new AbortController().signal };

describe('fakeAgentProvider', () => {
    it('대문자 심볼 + 툴 결과 없음 → get_quote 1회', async () => {
        const r = await fakeAgentProvider({ ...base, onEvent: vi.fn(), messages: [{ role: 'user', content: 'AAPL 얼마야' }] });
        expect(r.stopReason).toBe('tool_use');
        expect(r.toolCalls).toEqual([{ id: 'fake_1', name: 'get_quote', args: { symbols: ['AAPL'] } }]);
    });
    it('툴 결과 있음 → 결정적 텍스트', async () => {
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

- [ ] **Step 6: 라우터·fake·index 구현**

```ts
// src/entities/llm-provider/api/agent/router.ts
import 'server-only';
import type { AgentProviderResult, CallAgentProvider, CallAgentProviderOptions, ModelId } from '@y0ngha/siglens-core';
import { DEEPSEEK_V4_1_FLASH_MODEL, MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';
import { getServerPrimaryKey } from '../../lib/serverKeys';
import { callDeepseekAgent } from './deepseek';

/** Pilot (spec R12): the agent model is fixed server-side; client/core-supplied `model` is ignored. */
export const AGENT_MODEL: ModelId = DEEPSEEK_V4_1_FLASH_MODEL;

/**
 * Per-turn provider bound to `AGENT_MODEL`. P3 reintroduces model choice, BYOK
 * keys and the Anthropic fallback; until then a DeepSeek outage surfaces as
 * `server_busy`/`server_error` to the user and the kill switch/alarms apply.
 */
export function createAgentProvider(): CallAgentProvider {
    return async (o: CallAgentProviderOptions): Promise<AgentProviderResult> => {
        const apiKey = getServerPrimaryKey(getProviderForModel(AGENT_MODEL));
        if (apiKey === undefined) throw new Error(`[agent-router] No API key for model: ${AGENT_MODEL}`);
        return callDeepseekAgent({ ...o, model: AGENT_MODEL, apiKey, apiModelId: MODEL_SPECS[AGENT_MODEL].apiModelId });
    };
}
```

```ts
// src/entities/llm-provider/api/agent/fake.ts
import type { AgentProviderResult, CallAgentProviderOptions } from '@y0ngha/siglens-core';
const ZERO = { promptTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };

/** Deterministic E2E provider: one get_quote call for the first uppercase ticker, then a fixed answer. */
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
import type { CallAgentProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fakeAgentProvider } from './fake';
import { createAgentProvider } from './router';

export { AGENT_MODEL } from './router';

/** E2E → fake; otherwise the fixed-model DeepSeek provider (same switch as `getLlmProvider`). */
export function getAgentProvider(): CallAgentProvider {
    return isE2E() ? fakeAgentProvider : createAgentProvider();
}
```

- [ ] **Step 7: 통과 확인** — Run: `yarn test src/entities/llm-provider && yarn typecheck && yarn lint` → PASS, 경고 수 불변.

- [ ] **Step 8: Commit** — `feat(llm-provider): DeepSeek 에이전트 어댑터·고정 모델 라우터·E2E fake`

---

### Task 6: DB 스키마·마이그레이션·리포지토리·서버 액션

**Files:**
- Modify: `src/shared/db/schema.ts` (파일 끝)
- Create: `drizzle/0035_agent_chat.sql` (+meta, `yarn db:generate`)
- Create: `src/entities/chat-conversation/model.ts`, `api.ts`, `index.ts`, `actions/{listConversationsAction,getConversationAction,renameConversationAction,deleteConversationAction}.ts`, `actions.ts`
- Test: `src/entities/chat-conversation/__tests__/{model,api,actions}.test.ts`

- [ ] **Step 1: 스키마 추가** — `src/shared/db/schema.ts` 끝에:

```ts
/**
 * SiglensAI 대화(스펙 §6-1). 회원 전용. `deleted_at`은 soft delete — 저장량이
 * KB 단위라 하드 삭제 크론은 두지 않는다.
 */
export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
        index('chat_conversations_user_recent_idx').on(table.userId, table.lastMessageAt.desc()).where(sql`${table.deletedAt} is null`),
    ]
);

/**
 * 대화 메시지. tool 행의 `content`는 실행기가 4,000자로 절단한 결과 JSON 그대로.
 * `seq`는 INSERT … SELECT coalesce(max(seq),0)+n 단일 문으로 매긴다(neon-http는
 * 트랜잭션 미지원). 요청 간 경합은 사용자별 턴 락이 막는다.
 */
export const chatMessages = pgTable(
    'chat_messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
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

(`sql`이 `drizzle-orm`에서 import돼 있는지 확인.)

- [ ] **Step 2: 마이그레이션 생성** — Run: `yarn db:generate --name agent_chat` (DB 미접속). `drizzle/0035_agent_chat.sql`에 CREATE TABLE 2개·인덱스 2개 확인. **`yarn db:migrate`는 실행 금지**(Task 15 배포 절차).

- [ ] **Step 3: 모델·리포지토리 테스트**

```ts
// src/entities/chat-conversation/__tests__/model.test.ts
import { describe, expect, it } from 'vitest';
import { deriveTitle, toAgentHistory } from '@/entities/chat-conversation/model';

describe('deriveTitle', () => {
    it('첫 줄 60자, 빈 문자열은 기본 제목', () => {
        expect(deriveTitle('x'.repeat(100) + '\n둘째 줄')).toBe('x'.repeat(60) + '…');
        expect(deriveTitle('   ')).toBe('새 대화');
    });
});

describe('toAgentHistory', () => {
    it('superseded/error 행을 빼고 캐노니컬 메시지로', () => {
        const rows = [
            { role: 'user', content: 'q', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }], toolCallId: null, toolName: null, status: 'complete' },
            { role: 'tool', content: '{}', toolCalls: null, toolCallId: 'c1', toolName: 'get_quote', status: 'complete' },
            { role: 'assistant', content: 'old', toolCalls: null, toolCallId: null, toolName: null, status: 'superseded' },
            { role: 'assistant', content: 'err', toolCalls: null, toolCallId: null, toolName: null, status: 'error' },
            { role: 'assistant', content: 'new', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
        ] as const;
        expect(toAgentHistory(rows as never)).toEqual([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }] },
            { role: 'tool', content: '{}', toolCallId: 'c1', toolName: 'get_quote' },
            { role: 'assistant', content: 'new' },
        ]);
    });
});
```

```ts
// src/entities/chat-conversation/__tests__/api.test.ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import type { SiglensDatabase } from '@/shared/db/types';

/** Chainable drizzle stub: every builder method returns the same object; awaiting yields `result`. */
function chain<T>(result: T) {
    const obj: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values', 'update', 'set', 'delete']) obj[m] = vi.fn(() => obj);
    obj.returning = vi.fn().mockResolvedValue(result);
    obj.then = (resolve: (v: T) => void, reject?: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject);
    return obj;
}

describe('DrizzleChatConversationRepository', () => {
    it('create는 제목을 60자로 자른다', async () => {
        const row = { id: 'c1', userId: 'u1', title: 'x'.repeat(60) + '…' };
        const db = chain([row]);
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        expect((await repo.create({ userId: 'u1', firstMessage: 'x'.repeat(200), locale: 'ko', modelId: 'deepseek-v4.1-flash' })).id).toBe('c1');
        expect((db.values as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ title: 'x'.repeat(60) + '…', userId: 'u1' });
    });

    it('appendMessages는 seq를 SQL 식(max+n)으로 넣고 messageCount를 올린다', async () => {
        const db = chain([{ id: 'm1', seq: 4 }, { id: 'm2', seq: 5 }]);
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        const saved = await repo.appendMessages('c1', [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a', modelId: 'deepseek-v4.1-flash' }]);
        expect(saved.map(r => r.seq)).toEqual([4, 5]);
        const rows = (db.values as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ conversationId: 'c1', role: 'user', status: 'complete' });
        expect(typeof rows[0]!.seq).toBe('object'); // drizzle SQL 객체(max(seq)+1)
        expect(rows[1]).toMatchObject({ modelId: 'deepseek-v4.1-flash' });
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('supersedeAfterLastUser는 마지막 user 이후 행만 superseded', async () => {
        const db = chain([{ seq: 1, role: 'user' }, { seq: 2, role: 'assistant' }, { seq: 3, role: 'user' }, { seq: 4, role: 'assistant' }]);
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        expect(await repo.supersedeAfterLastUser('c1')).toBe(3);
        expect(db.set).toHaveBeenCalledWith({ status: 'superseded' });
    });

    it('deleteFromSeq는 delete 후 messageCount를 다시 센다', async () => {
        const db = chain([{ count: 2 }]);
        const repo = new DrizzleChatConversationRepository(db as unknown as SiglensDatabase);
        await repo.deleteFromSeq('c1', 3);
        expect(db.delete).toHaveBeenCalledTimes(1);
        expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ messageCount: 2 }));
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
    id: string; userId: string; title: string; locale: Locale; modelId: string; messageCount: number;
    lastMessageAt: Date; createdAt: Date; updatedAt: Date; deletedAt: Date | null;
}
export interface ChatMessageRecord {
    id: string; conversationId: string; seq: number; role: ChatMessageRole; content: string;
    toolCalls: AgentMessage['toolCalls'] | null; toolCallId: string | null; toolName: string | null;
    modelId: string | null; usage: Record<string, unknown> | null; status: ChatMessageStatus; createdAt: Date;
}
/** One row to append; `seq` is assigned by the repository. */
export interface NewChatMessage {
    role: ChatMessageRole; content: string; toolCalls?: AgentMessage['toolCalls']; toolCallId?: string; toolName?: string;
    modelId?: string; usage?: Record<string, unknown>; status?: ChatMessageStatus;
}
/** Client-facing message (no usage internals). */
export interface ChatMessageView {
    id: string; seq: number; role: ChatMessageRole; content: string; toolCalls: AgentMessage['toolCalls'] | null;
    toolName: string | null; status: ChatMessageStatus; createdAt: string;
}

export function deriveTitle(firstMessage: string): string {
    const line = firstMessage.trim().split('\n')[0] ?? '';
    if (line.length === 0) return '새 대화';
    return line.length > CONVERSATION_TITLE_MAX ? `${line.slice(0, CONVERSATION_TITLE_MAX)}…` : line;
}

/** Rows → core transcript; superseded/error rows (regenerate/edit leftovers) are dropped. */
export function toAgentHistory(rows: readonly Pick<ChatMessageRecord, 'role' | 'content' | 'toolCalls' | 'toolCallId' | 'toolName' | 'status'>[]): AgentMessage[] {
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
    return { id: r.id, seq: r.seq, role: r.role, content: r.content, toolCalls: r.toolCalls, toolName: r.toolName, status: r.status, createdAt: r.createdAt.toISOString() };
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
        const [row] = await withRetry(
            () => this.db.insert(chatConversations).values({ userId: input.userId, title: deriveTitle(input.firstMessage), locale: input.locale, modelId: input.modelId, lastMessageAt: new Date() }).returning(),
            NEON_TRANSIENT_RETRY
        );
        return row as ChatConversationRecord;
    }

    /** Owner-scoped; null for other users' or deleted conversations. */
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

    /**
     * One INSERT whose `seq` values are `(select coalesce(max(seq),0) …) + n` —
     * evaluated inside the statement, so no transaction is needed (neon-http has
     * none). Cross-request races are excluded by the per-user turn lock.
     */
    async appendMessages(conversationId: string, messages: readonly NewChatMessage[]): Promise<ChatMessageRecord[]> {
        if (messages.length === 0) return [];
        const base = sql<number>`(select coalesce(max(${chatMessages.seq}), 0) from ${chatMessages} where ${chatMessages.conversationId} = ${conversationId})`;
        const rows = messages.map((m, i) => ({
            conversationId,
            seq: sql<number>`${base} + ${i + 1}`,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls ?? null,
            toolCallId: m.toolCallId ?? null,
            toolName: m.toolName ?? null,
            modelId: m.modelId ?? null,
            usage: m.usage ?? null,
            status: m.status ?? 'complete',
        }));
        const inserted = await withRetry(() => this.db.insert(chatMessages).values(rows).returning(), NEON_TRANSIENT_RETRY);
        await this.db.update(chatConversations).set({ messageCount: sql`${chatConversations.messageCount} + ${rows.length}`, lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(chatConversations.id, conversationId));
        return inserted as ChatMessageRecord[];
    }

    /** regenerate: rows after the last user row → superseded. Returns that user row's seq, or null. */
    async supersedeAfterLastUser(conversationId: string): Promise<number | null> {
        const rows = await this.listMessages(conversationId);
        const lastUser = [...rows].reverse().find(r => r.role === 'user');
        if (!lastUser) return null;
        await this.db.update(chatMessages).set({ status: 'superseded' }).where(and(eq(chatMessages.conversationId, conversationId), gte(chatMessages.seq, lastUser.seq + 1)));
        return lastUser.seq;
    }

    /** edit: hard-delete from `seq` (the edited user row) onward and recount. */
    async deleteFromSeq(conversationId: string, seq: number): Promise<void> {
        await this.db.delete(chatMessages).where(and(eq(chatMessages.conversationId, conversationId), gte(chatMessages.seq, seq)));
        const [agg] = await this.db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(eq(chatMessages.conversationId, conversationId));
        await this.db.update(chatConversations).set({ messageCount: Number(agg?.count ?? 0), updatedAt: new Date() }).where(eq(chatConversations.id, conversationId));
    }
}
```

`index.ts`:

```ts
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
export interface ConversationListItem { id: string; title: string; lastMessageAt: string }
export async function listConversationsAction(): Promise<ConversationListItem[]> {
    const user = await getCurrentUser();
    if (!user) return [];
    const rows = await new DrizzleChatConversationRepository(getDatabaseClient().db).listForUser(user.id);
    return rows.map(r => ({ id: r.id, title: r.title, lastMessageAt: r.lastMessageAt.toISOString() }));
}
```

```ts
// src/entities/chat-conversation/actions/getConversationAction.ts
'use server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { toMessageView, type ChatMessageView } from '../model';
export interface ConversationDetail { id: string; title: string; messages: ChatMessageView[] }
export async function getConversationAction(id: string): Promise<ConversationDetail | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    const repo = new DrizzleChatConversationRepository(getDatabaseClient().db);
    const conversation = await repo.findForUser(id, user.id);
    if (!conversation) return null;
    const messages = await repo.listMessages(id);
    return { id: conversation.id, title: conversation.title, messages: messages.filter(m => m.status !== 'superseded').map(toMessageView) };
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

```ts
// src/entities/chat-conversation/actions.ts
export { listConversationsAction, type ConversationListItem } from './actions/listConversationsAction';
export { getConversationAction, type ConversationDetail } from './actions/getConversationAction';
export { renameConversationAction } from './actions/renameConversationAction';
export { deleteConversationAction } from './actions/deleteConversationAction';
```

```ts
// src/entities/chat-conversation/__tests__/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockUser, repo } = vi.hoisted(() => ({ mockUser: vi.fn(), repo: { listForUser: vi.fn(), findForUser: vi.fn(), listMessages: vi.fn(), rename: vi.fn(), softDelete: vi.fn() } }));
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
    it('getConversationAction은 superseded 행을 거르고 소유자로 조회한다', async () => {
        mockUser.mockResolvedValue({ id: 'u1' });
        repo.findForUser.mockResolvedValue({ id: 'c1', title: 't' });
        repo.listMessages.mockResolvedValue([
            { id: 'm1', seq: 1, role: 'user', content: 'q', toolCalls: null, toolName: null, status: 'complete', createdAt: new Date() },
            { id: 'm2', seq: 2, role: 'assistant', content: 'old', toolCalls: null, toolName: null, status: 'superseded', createdAt: new Date() },
        ]);
        expect((await getConversationAction('c1'))?.messages.map(m => m.id)).toEqual(['m1']);
        expect(repo.findForUser).toHaveBeenCalledWith('c1', 'u1');
    });
    it('rename은 121자 이상 거부, trim', async () => {
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

**Files:** Modify `src/shared/lib/sse/activeStreams.ts`, `src/shared/lib/sse/heartbeatStream.ts`; Test `src/shared/lib/sse/__tests__/activeStreams.test.ts`(케이스 추가)

- [ ] **Step 1: 테스트 추가**

```ts
it('registerActiveStream은 증가시키고 해제 함수는 한 번만 감소시킨다', () => {
    __resetActiveStreamsForTests();
    const release = registerActiveStream();
    expect(__activeStreamCount()).toBe(1);
    release(); release();
    expect(__activeStreamCount()).toBe(0);
});
```

- [ ] **Step 2: 구현** — `activeStreams.ts`에:

```ts
/**
 * Register one unit of in-flight server work (analysis stream or agent turn)
 * and get an idempotent release. Use this instead of the raw pair.
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

`heartbeatStream.ts`: `incrementActiveStreams(); streamRegistered = true;` → `release = registerActiveStream();`, `decrement()` 본문 → `release?.()`. `increment/decrement` JSDoc의 "직접 호출 금지"에 "`registerActiveStream` 사용" 추가.

- [ ] **Step 3: 통과** — `yarn test src/shared/lib/sse` → PASS.
- [ ] **Step 4: Commit** — `refactor(sse): registerActiveStream 헬퍼로 활성 스트림 등록 일원화`

---

### Task 8: 동시 턴 락·카운터 조립·티어 해석

**Files:** Create `src/app/api/ai/chat/turnLock.ts`, `counters.ts`, `resolveAgentTier.ts`; Test `src/app/api/ai/chat/__tests__/{turnLock,counters,resolveAgentTier}.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/app/api/ai/chat/__tests__/turnLock.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { redis } = vi.hoisted(() => ({ redis: { set: vi.fn(), del: vi.fn() } }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => redis }));
import { acquireTurnLock } from '@/app/api/ai/chat/turnLock';
describe('acquireTurnLock', () => {
    beforeEach(() => vi.clearAllMocks());
    it('SET NX EX 600, release는 DEL', async () => {
        redis.set.mockResolvedValue('OK');
        const lock = await acquireTurnLock('u1');
        expect(redis.set).toHaveBeenCalledWith('agent:turn-lock:u1', expect.any(String), { nx: true, ex: 600 });
        await lock!.release();
        expect(redis.del).toHaveBeenCalledWith('agent:turn-lock:u1');
    });
    it('이미 잡힘 → null · Redis 오류 → null(fail-closed)', async () => {
        redis.set.mockResolvedValue(null);
        expect(await acquireTurnLock('u1')).toBeNull();
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
    it('6개 스토어 전부 closed, 월 카운터만 month', () => {
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
// src/app/api/ai/chat/__tests__/resolveAgentTier.test.ts
import { describe, expect, it, vi } from 'vitest';
const { mockTier } = vi.hoisted(() => ({ mockTier: vi.fn() }));
vi.mock('@/shared/lib/byokGate', () => ({ resolveTierOnly: mockTier }));
import { resolveAgentTier } from '@/app/api/ai/chat/resolveAgentTier';
describe('resolveAgentTier', () => {
    it('회원 티어를 그대로 돌려준다', async () => {
        mockTier.mockResolvedValue('member');
        expect(await resolveAgentTier('u1')).toBe('member');
        expect(mockTier).toHaveBeenCalledWith('u1');
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

/** One in-flight turn per user across instances (spec §4-5). Fail-closed on Redis absence/error. */
export async function acquireTurnLock(userId: string): Promise<TurnLock | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    const key = `agent:turn-lock:${userId}`;
    try {
        if ((await redis.set(key, randomUUID(), { nx: true, ex: TURN_LOCK_TTL_SECONDS })) !== 'OK') return null;
    } catch {
        return null;
    }
    return {
        async release() {
            try { await redis.del(key); } catch (error) { console.warn('[agent] turn lock release failed', error); }
        },
    };
}
```

```ts
// src/app/api/ai/chat/counters.ts
import 'server-only';
import { createCounterStore, type AgentCounters } from '@y0ngha/siglens-core';

/** All agent quotas fail-closed (spec §2-10). Keys: agent:q:<feature>:<subject>:<bucket>. */
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
// src/app/api/ai/chat/resolveAgentTier.ts
import 'server-only';
import type { Tier } from '@y0ngha/siglens-core';
import { resolveTierOnly } from '@/shared/lib/byokGate';

/** Pilot: the model is fixed (free class) so only the tier is needed for quotas. P3 swaps in `resolveTierAndByok`. */
export function resolveAgentTier(userId: string): Promise<Tier> {
    return resolveTierOnly(userId);
}
```

- [ ] **Step 4: 통과** — `yarn test src/app/api/ai/chat/__tests__` → PASS.
- [ ] **Step 5: Commit** — `feat(api/ai): 동시 턴 락·에이전트 카운터·티어 해석`

---

### Task 9: 툴 실행기 7종(P1) + 절단 + 레지스트리

**Files:**
- Create: `src/app/api/ai/chat/tools/{truncate,index,searchTicker,getQuote,getBarsIndicators,getCachedAnalysis,getNews,getOptionsSummary,getMyPortfolio}.ts`
- Test: `src/app/api/ai/chat/tools/__tests__/*.test.ts`

- [ ] **Step 1: 절단·레지스트리 테스트**

```ts
// src/app/api/ai/chat/tools/__tests__/truncate.test.ts
import { describe, expect, it } from 'vitest';
import { TOOL_RESULT_MAX_CHARS, truncateToolResult } from '@/app/api/ai/chat/tools/truncate';
describe('truncateToolResult', () => {
    it('4,000자 이하면 그대로', () => { const v = { a: 1 }; expect(truncateToolResult(v)).toBe(v); });
    it('초과면 preview + truncated:true', () => {
        const out = truncateToolResult({ text: 'x'.repeat(TOOL_RESULT_MAX_CHARS + 100) }) as { truncated: boolean; preview: string };
        expect(out.truncated).toBe(true);
        expect(out.preview).toHaveLength(TOOL_RESULT_MAX_CHARS);
    });
});
```

```ts
// src/app/api/ai/chat/tools/__tests__/index.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({ searchTickerTool: search }));
for (const m of ['getQuote', 'getBarsIndicators', 'getCachedAnalysis', 'getNews', 'getOptionsSummary', 'getMyPortfolio']) {
    vi.mock(`@/app/api/ai/chat/tools/${m}`, () => ({ [`${m}Tool`]: vi.fn() }));
}
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));
import { availableToolNames, createToolExecutor } from '@/app/api/ai/chat/tools';
const ctx = { userId: 'u1', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };

describe('tool registry', () => {
    beforeEach(() => { vi.clearAllMocks(); delete process.env.BRAVE_SEARCH_API_KEY; });
    it('P1 가용 툴 7종(web_search는 키 있을 때만)', () => {
        expect([...availableToolNames()].sort()).toEqual(['get_bars_indicators', 'get_cached_analysis', 'get_my_portfolio', 'get_news', 'get_options_summary', 'get_quote', 'search_ticker']);
    });
    it('심볼 형태가 아니면 실행하지 않는다', async () => {
        expect(await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })('get_options_summary', { symbol: '../etc' }, ctx)).toEqual({ error: 'invalid_symbol' });
    });
    it('실행기 예외 → tool_failed', async () => {
        search.mockRejectedValue(new Error('boom'));
        expect(await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })('search_ticker', { query: 'x' }, ctx)).toEqual({ error: 'tool_failed', message: 'boom' });
    });
    it('결과는 절단을 거친다', async () => {
        search.mockResolvedValue({ big: 'x'.repeat(10_000) });
        expect(await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })('search_ticker', { query: 'x' }, ctx)).toMatchObject({ truncated: true });
    });
});
```

(`vi.mock`은 호이스팅되므로 루프 안 동적 경로가 안 되면 6줄을 펼쳐 쓴다.)

- [ ] **Step 2: 절단·레지스트리 구현**

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
import { getMyPortfolioTool } from './getMyPortfolio';

export interface ToolRuntime {
    /** Analysis model for cache keys/fresh runs — pilot: fixed to the agent model. */
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
    get_my_portfolio: getMyPortfolioTool,
    // Task 13 adds: run_fresh_analysis, web_search
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

- [ ] **Step 3: 실행기 7종 구현** (각 파일 `import 'server-only'`)

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
        results: results.slice(0, MAX_RESULTS).map(r => ({ symbol: r.symbol, name: r.name, koreanName: r.koreanName ?? null, exchange: r.exchange, marketProfile: r.marketProfile ?? null })),
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

/** Per-symbol profile → session spec (KR = Yahoo, US/crypto = FMP). */
export const getQuoteTool: ToolExecutor = async args => {
    const symbols = (args.symbols as string[]).slice(0, MAX_SYMBOLS).map(s => s.toUpperCase());
    const quotes = await Promise.all(symbols.map(async symbol => {
        const profile = await resolveMarketProfile(symbol);
        const quote = await getCachedMarketDataProvider(sessionSpecFor(profile)).getQuote(symbol);
        if (quote === null) return { symbol, found: false };
        return { symbol, found: true, price: quote.price, changesPercentage: quote.changesPercentage, currency: getDescriptor(profile).priceFormat.currency, marketProfile: profile };
    }));
    return { asOf: new Date().toISOString(), source: 'market data provider (60s in-session cache)', quotes };
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
    return {
        rsi: last(ind.rsi), macd: last(ind.macd), bollinger: last(ind.bollinger), atr: last(ind.atr),
        ma: Object.fromEntries(Object.entries(ind.ma).map(([p, s]) => [p, last(s)])),
        ema: Object.fromEntries(Object.entries(ind.ema).map(([p, s]) => [p, last(s)])),
    };
}
export const getBarsIndicatorsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as Timeframe;
    const count = typeof args.bars === 'number' ? args.bars : DEFAULT_BARS;
    const profile = await resolveMarketProfile(symbol);
    const { bars, indicators } = await fetchBarsWithIndicators(getCachedMarketDataProvider(sessionSpecFor(profile)), symbol, timeframe);
    if (bars.length === 0) return { symbol, timeframe, found: false };
    return {
        asOf: new Date(bars[bars.length - 1]!.time * 1000).toISOString(),
        source: 'siglens bars + indicators',
        symbol, timeframe, currency: getDescriptor(profile).priceFormat.currency,
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
import { peekAnalysisCache, peekOverallAnalysisCache, TIER_CONFIG, type Timeframe } from '@y0ngha/siglens-core';
import { DrizzleAnalysisHistoryRepository, type AnalysisHistoryTab } from '@/entities/analysis/analysisHistoryRepository';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { resolvePositionBucket } from '@/shared/lib/byokGate';
import type { ToolExecutor } from './index';

const STALE_AFTER_MS: Record<string, number> = { technical: MS_PER_DAY, overall: MS_PER_DAY };
const DEFAULT_STALE_MS = 7 * MS_PER_DAY;
const DEFAULT_TIMEFRAME: Timeframe = '1Day';
const isHistoryTab = (tab: string): tab is AnalysisHistoryTab => tab === 'technical' || tab === 'overall';
const stale = (tab: string, generatedAt: Date): boolean => Date.now() - generatedAt.getTime() > (STALE_AFTER_MS[tab] ?? DEFAULT_STALE_MS);

/** Personalised cache key: the user's holding (avg price) vs current quote → position bucket, as the symbol page does. */
async function positionBucketFor(userId: string, tier: Parameters<typeof resolvePositionBucket>[0], symbol: string) {
    const holding = await new DrizzlePortfolioRepository(getDatabaseClient().db).findByUserAndSymbol(userId, symbol);
    if (!holding) return undefined;
    const profile = await resolveMarketProfile(symbol);
    const quote = await getCachedMarketDataProvider(sessionSpecFor(profile)).getQuote(symbol);
    return resolvePositionBucket(tier, Number(holding.averagePrice), quote?.price ?? null);
}

/** Redis peek (technical/overall) → SEO snapshot (all tabs) → history digest (technical/overall). */
export const getCachedAnalysisTool: ToolExecutor = async (args, ctx, runtime) => {
    const symbol = String(args.symbol).toUpperCase();
    const tab = String(args.tab);
    const timeframe = (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;

    if (tab === 'technical') {
        const positionBucket = await positionBucketFor(ctx.userId, ctx.tier, symbol);
        const cached = await peekAnalysisCache(symbol, timeframe, undefined, runtime.analysisModel, false, ctx.tier, TIER_CONFIG, positionBucket);
        if (cached) {
            const a = cached.result;
            const generatedAt = a.analyzedAt ? new Date(a.analyzedAt) : new Date();
            return { found: true, source: 'redis', tab, timeframe, generatedAt: generatedAt.toISOString(), stale: stale(tab, generatedAt), personalized: positionBucket !== undefined, analysis: { summary: a.summary, trend: a.trend, riskLevel: a.riskLevel, keyLevels: a.keyLevels, priceTargets: a.priceTargets, actionRecommendation: a.actionRecommendation ?? null } };
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
    const snapshot = (await new DrizzleSeoSnapshotRepository(db).findBySymbol(symbol, ctx.locale)).find(s => s.tab === tab);
    if (snapshot) {
        return { found: true, source: 'snapshot', tab, generatedAt: snapshot.generatedAt.toISOString(), stale: stale(tab, snapshot.generatedAt), model: snapshot.model, plain: snapshot.plain, analysis: snapshot.content };
    }
    if (isHistoryTab(tab)) {
        const [latest] = await new DrizzleAnalysisHistoryRepository(db).findRecentForPrompt({ symbol, timeframe, tab });
        if (latest) return { found: true, source: 'history', tab, timeframe, generatedAt: latest.generatedAt.toISOString(), stale: stale(tab, latest.generatedAt), digest: latest };
    }
    return { found: false, tab, symbol, hint: 'call run_fresh_analysis' };
};
```

(`peekAnalysisCache`의 반환은 `FilteredAnalysisResult = { result, lockedInfoDepth }`이며 `result.analyzedAt`은 선택 필드다. `FilteredAnalysisResponse`에 `analyzedAt`이 없으면 `'analyzedAt' in a` 가드로 읽는다.)

```ts
// src/app/api/ai/chat/tools/getNews.ts
import 'server-only';
import { DrizzleMarketNewsRepository } from '@/entities/market-news/api';
import { CATEGORY_CONFIG, categoryFromSlug } from '@/entities/market-news';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';

const DEFAULT_LOOKBACK_MS = 14 * MS_PER_DAY;
const DEFAULT_LIMIT = 5;
const BODY_ITEMS = 3;
const BODY_CHARS = 1_000;

/** Fields shared by `NewsRow`/`MarketNewsRow` (both extend `NewsDisplayItem`). */
interface NewsLike { titleEn: string; titleKo: string | null; titleLocalized?: string | null; summaryKo: string | null; summaryLocalized?: string | null; bodyKo: string | null; sentiment: unknown; priceImpact: unknown; publishedAt: string; url: string; source: string }

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
        const id = categoryFromSlug(args.category);
        if (id === null) return { error: 'invalid_args', issues: [{ path: 'category', message: 'unknown category' }] };
        rows = await new DrizzleMarketNewsRepository(db).listByCategory(CATEGORY_CONFIG[id].sentinel, sinceMs);
    } else {
        return { error: 'invalid_args', issues: [{ path: 'symbol', message: 'symbol or category required' }] };
    }
    const title = (r: NewsLike): string => (ctx.locale === 'en' ? r.titleEn : (r.titleLocalized ?? r.titleKo ?? r.titleEn));
    const filtered = query ? rows.filter(r => `${r.titleEn} ${r.titleKo ?? ''} ${r.summaryKo ?? ''}`.toLowerCase().includes(query)) : rows;
    const items = filtered.slice(0, limit).map((r, i) => ({
        title: title(r), summary: r.summaryLocalized ?? r.summaryKo, sentiment: r.sentiment, priceImpact: r.priceImpact, publishedAt: r.publishedAt, source: r.source, url: r.url,
        ...(args.includeBody === true && i < BODY_ITEMS && r.bodyKo ? { body: r.bodyKo.slice(0, BODY_CHARS) } : {}),
    }));
    return { asOf: new Date().toISOString(), source: 'siglens news store', count: items.length, coverageLimited: items.length === 0, items };
};
```

(`CATEGORY_CONFIG`·`categoryFromSlug`는 `entities/market-news/index.ts` 배럴에 있다. `titleLocalized`/`summaryLocalized`가 `NewsDisplayItem`에 없으면 `NewsLike`에서 빼고 `titleKo ?? titleEn`만 쓴다.)

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
        asOf: snapshot.capturedAt, source: 'options snapshot (cached)', symbol, available: true, currency: 'USD',
        underlyingPrice: snapshot.underlyingPrice, expiration: chain.expirationDate, daysToExpiration: chain.daysToExpiration,
        metrics: summarizeChainForLlm(chain, snapshot.underlyingPrice),
        otherExpirations: snapshot.chains.slice(1, 4).map(c => c.expirationDate),
    };
};
```

```ts
// src/app/api/ai/chat/tools/getMyPortfolio.ts
import 'server-only';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';

/** The signed-in user's own holdings only (R9). Quantities/prices are decimal strings in the DB. */
export const getMyPortfolioTool: ToolExecutor = async (_args, ctx) => {
    const rows = await new DrizzlePortfolioRepository(getDatabaseClient().db).findByUser(ctx.userId);
    const holdings = await Promise.all(rows.map(async r => ({
        symbol: r.symbol, companyName: r.companyName, quantity: Number(r.quantity), averagePrice: Number(r.averagePrice),
        currency: getDescriptor(await resolveMarketProfile(r.symbol)).priceFormat.currency,
    })));
    return { asOf: new Date().toISOString(), source: 'siglens portfolio', count: holdings.length, holdings };
};
```

- [ ] **Step 4: 실행기 테스트** — 소스 함수 `vi.mock` 기반 파일 7개, 핵심 케이스:

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
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
describe('getQuoteTool', () => {
    it('KR 심볼은 kr-equity 세션 스펙 + KRW, 3개로 절단', async () => {
        profile.mockImplementation(async (s: string) => (s.endsWith('.KS') ? 'kr-equity' : 'us-equity'));
        getQuote.mockResolvedValue({ symbol: 'x', price: 71000, changesPercentage: 1.2 });
        const r = (await getQuoteTool({ symbols: ['005930.KS', 'AAPL', 'MSFT', 'NVDA'] }, ctx, rt)) as { quotes: unknown[] };
        expect(r.quotes).toHaveLength(3);
        expect(spec).toHaveBeenCalledWith('kr-equity');
        expect(r.quotes[0]).toMatchObject({ symbol: '005930.KS', currency: 'KRW', found: true });
    });
});
```

```ts
// src/app/api/ai/chat/tools/__tests__/getNews.test.ts
import { describe, expect, it, vi } from 'vitest';
const { bySymbol, byCategory } = vi.hoisted(() => ({ bySymbol: vi.fn(), byCategory: vi.fn() }));
vi.mock('@/entities/news-article/api', () => ({ DrizzleNewsRepository: vi.fn(() => ({ listBySymbol: bySymbol })) }));
vi.mock('@/entities/market-news/api', () => ({ DrizzleMarketNewsRepository: vi.fn(() => ({ listByCategory: byCategory })) }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: () => ({ db: {} }) }));
import { getNewsTool } from '@/app/api/ai/chat/tools/getNews';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
const row = (i: number) => ({ titleEn: `t${i}`, titleKo: `제목${i}`, summaryKo: `요약${i}`, bodyKo: 'b'.repeat(2000), sentiment: 'positive', priceImpact: 'high', publishedAt: '2026-09-10', url: `https://n/${i}`, source: 's' });

describe('getNewsTool', () => {
    it('카테고리 slug → sentinel 매핑', async () => {
        byCategory.mockResolvedValue([row(1)]);
        await getNewsTool({ category: 'crypto' }, ctx, rt);
        expect(byCategory).toHaveBeenCalledWith('__NEWS_CRYPTO__', expect.any(Number));
    });
    it('symbol·category 둘 다 없거나 미지 카테고리 → invalid_args', async () => {
        expect(await getNewsTool({}, ctx, rt)).toMatchObject({ error: 'invalid_args' });
        expect(await getNewsTool({ category: 'nope' }, ctx, rt)).toMatchObject({ error: 'invalid_args' });
    });
    it('query 필터·limit·includeBody 3건·1,000자·ko 제목', async () => {
        bySymbol.mockResolvedValue([row(1), row(2), row(3), row(4), { ...row(5), titleKo: 'ZZZ' }]);
        const r = (await getNewsTool({ symbol: 'aapl', query: '제목', limit: 4, includeBody: true }, ctx, rt)) as { items: Array<{ title: string; body?: string }> };
        expect(r.items).toHaveLength(4);
        expect(r.items[0]!.title).toBe('제목1');
        expect(r.items.filter(i => i.body).length).toBe(3);
        expect(r.items[0]!.body).toHaveLength(1000);
        expect(bySymbol).toHaveBeenCalledWith('AAPL', expect.any(Number));
    });
    it('빈 결과는 coverageLimited', async () => {
        bySymbol.mockResolvedValue([]);
        expect(await getNewsTool({ symbol: 'AAPL' }, ctx, rt)).toMatchObject({ count: 0, coverageLimited: true });
    });
});
```

같은 방식으로 `getBarsIndicators.test.ts`(빈 봉 → found:false, N봉 절단, trend/signals 포함), `getCachedAnalysis.test.ts`(peek `{result}` → source redis + `analysis.summary`, positionBucket 계산 시 `personalized:true`, miss → snapshot, none → found:false + hint, fundamental 탭은 history 조회 안 함), `getOptionsSummary.test.ts`(시장 없음 → available:false, 체인 있음 → metrics·otherExpirations), `searchTicker.test.ts`(8건 절단), `getMyPortfolio.test.ts`(userId로만 조회, 숫자 변환·통화)를 작성한다.

- [ ] **Step 5: 통과 확인** — Run: `yarn test src/app/api/ai/chat/tools && yarn typecheck && yarn lint` → PASS. (`MS_PER_DAY`는 `@/shared/config/time`에 실재. `getDescriptor`는 `@/shared/config/marketProfile` 배럴.)

- [ ] **Step 6: Commit** — `feat(api/ai): 툴 실행기 7종(검색·시세·봉/지표·캐시 분석·뉴스·옵션·포트폴리오) + 절단 규칙`

---

### Task 10: SSE writer + 라우트 `/api/ai/chat/stream`

**Files:**
- Create: `src/app/api/ai/chat/agentEventStream.ts`, `src/app/api/ai/chat/stream/route.ts`
- Test: `src/app/api/ai/chat/__tests__/agentEventStream.test.ts`, `src/app/api/ai/chat/stream/__tests__/route.test.ts`

- [ ] **Step 1: writer 테스트**

```ts
// src/app/api/ai/chat/__tests__/agentEventStream.test.ts
import { describe, expect, it, vi } from 'vitest';
import { AgentTurnError, agentEventStream } from '@/app/api/ai/chat/agentEventStream';
import { __activeStreamCount, __resetActiveStreamsForTests } from '@/shared/lib/sse/activeStreams';

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string[]> {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) { const { value, done } = await reader.read(); if (done) break; buf += value; }
    return buf.split('\n\n').filter(Boolean);
}

describe('agentEventStream', () => {
    it('meta → 이벤트 → done, 활성 스트림 등록·해제', async () => {
        __resetActiveStreamsForTests();
        const frames = await readAll(agentEventStream({
            meta: { conversationId: 'c1' },
            work: async emit => { expect(__activeStreamCount()).toBe(1); emit({ type: 'text', delta: 'hi' }); return { assistantMessageId: 'm2' }; },
            onAbort: vi.fn(),
        }));
        expect(frames).toEqual(['event: meta\ndata: {"conversationId":"c1"}', 'event: text\ndata: {"delta":"hi"}', 'event: done\ndata: {"assistantMessageId":"m2"}']);
        expect(__activeStreamCount()).toBe(0);
    });
    it('AgentTurnError → error 프레임에 그 code, 일반 예외 → server_error + [agent-stream] failed 로그', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await readAll(agentEventStream({ meta: {}, work: async () => { throw new AgentTurnError('turn_limit'); }, onAbort: vi.fn() }))).at(-1)).toBe('event: error\ndata: {"code":"turn_limit","message":"turn_limit"}');
        expect((await readAll(agentEventStream({ meta: {}, work: async () => { throw new Error('boom'); }, onAbort: vi.fn() }))).at(-1)).toBe('event: error\ndata: {"code":"server_error","message":"boom"}');
        expect(err.mock.calls.some(c => c[0] === '[agent-stream] failed:')).toBe(true);
        err.mockRestore();
    });
    it('cancel → onAbort + 해제', async () => {
        __resetActiveStreamsForTests();
        const onAbort = vi.fn();
        const reader = agentEventStream({ meta: {}, work: () => new Promise(() => {}), onAbort }).getReader();
        await reader.read();
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

/** Typed turn failure so the writer emits `{code}` instead of a generic server_error. */
export class AgentTurnError extends Error {
    constructor(readonly code: string) { super(code); this.name = 'AgentTurnError'; }
}

export interface AgentEventStreamOptions<TDone extends Record<string, unknown>> {
    meta: Record<string, unknown>;
    work: (emit: (event: AgentTurnEvent) => void) => Promise<TDone>;
    /** Client disconnected — abort the provider/tool signal (never the fresh analysis, spec §6-3). */
    onAbort: () => void;
}

const frame = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * Incremental SSE writer for agent turns. `heartbeatStream` carries one promise
 * and emits only open/heartbeat/done/error, so it cannot stream tokens (spec §2-11).
 * The `[agent-stream] failed:` marker feeds the CloudWatch filter (07-alarms.sh).
 */
export function agentEventStream<TDone extends Record<string, unknown>>(options: AgentEventStreamOptions<TDone>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let release: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (text: string): void => { if (closed) return; try { controller.enqueue(encoder.encode(text)); } catch { closed = true; } };
            const finish = (): void => {
                if (timer !== undefined) clearInterval(timer);
                release?.();
                if (!closed) { closed = true; try { controller.close(); } catch { /* already closed */ } }
            };
            send(frame('meta', options.meta));
            release = registerActiveStream();
            timer = setInterval(() => send('event: heartbeat\ndata: {}\n\n'), HEARTBEAT_INTERVAL_MS);
            options.work(event => { const { type, ...data } = event; send(frame(type, data)); }).then(
                done => { send(frame('done', done)); finish(); },
                (error: unknown) => {
                    console.error('[agent-stream] failed:', error);
                    const code = error instanceof AgentTurnError ? error.code : 'server_error';
                    send(frame('error', { code, message: error instanceof Error ? error.message : String(error) }));
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

- [ ] **Step 3: writer 통과** — `yarn test src/app/api/ai/chat/__tests__/agentEventStream.test.ts` → PASS.

- [ ] **Step 4: 라우트 테스트**

```ts
// src/app/api/ai/chat/stream/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
    user: vi.fn(), isBot: vi.fn(() => false), tier: vi.fn(async () => 'member'), lock: vi.fn(), runTurn: vi.fn(), canAccept: vi.fn(() => true),
    repo: { create: vi.fn(), findForUser: vi.fn(), listMessages: vi.fn(), appendMessages: vi.fn(), countForUser: vi.fn(), supersedeAfterLastUser: vi.fn(), deleteFromSeq: vi.fn() },
    portfolio: { findByUser: vi.fn(async () => [{ symbol: 'AAPL' }]) },
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({ getCurrentUser: m.user }));
vi.mock('@/shared/api/isBot', () => ({ isBot: m.isBot }));
vi.mock('@/app/api/ai/chat/resolveAgentTier', () => ({ resolveAgentTier: m.tier }));
vi.mock('@/app/api/ai/chat/turnLock', () => ({ acquireTurnLock: m.lock }));
vi.mock('@/app/api/ai/chat/counters', () => ({ createAgentCounters: () => ({}) }));
vi.mock('@/app/api/ai/chat/tools', () => ({ createToolExecutor: () => vi.fn(), availableToolNames: () => new Set(['get_quote']) }));
vi.mock('@/entities/llm-provider', () => ({ getAgentProvider: () => vi.fn(), AGENT_MODEL: 'deepseek-v4.1-flash' }));
vi.mock('@/entities/chat-conversation/api', () => ({ DrizzleChatConversationRepository: vi.fn(() => m.repo) }));
vi.mock('@/entities/portfolio/api', () => ({ DrizzlePortfolioRepository: vi.fn(() => m.portfolio) }));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: () => ({ db: {} }) }));
vi.mock('@/shared/lib/sse/activeStreams', async importOriginal => ({ ...(await importOriginal<object>()), canAcceptAnalysisStream: m.canAccept }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({ ...(await importOriginal<object>()), runAgentTurn: m.runTurn }));
import { POST } from '@/app/api/ai/chat/stream/route';

const post = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost/api/ai/chat/stream', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const frames = async (res: Response) => (await res.text()).split('\n\n').filter(Boolean);
const OK_TURN = { ok: true, assistant: { role: 'assistant', content: 'hi' }, intermediate: [], usage: { promptTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 1, steps: 1, ms: 5 }, stopReason: 'end', remaining: { turns: 59, fresh: 6, search: 5 }, promptVersion: 'v', toolsUsed: [] };

describe('POST /api/ai/chat/stream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.AGENT_CHAT_DISABLED;
        m.user.mockResolvedValue({ id: 'u1' });
        m.isBot.mockReturnValue(false);
        m.canAccept.mockReturnValue(true);
        m.lock.mockResolvedValue({ release: vi.fn() });
        m.repo.create.mockResolvedValue({ id: 'c-new', title: '제목' });
        m.repo.findForUser.mockResolvedValue({ id: 'c1', title: 't' });
        m.repo.listMessages.mockResolvedValue([]);
        m.repo.countForUser.mockResolvedValue(0);
        m.repo.appendMessages.mockImplementation(async (_c: string, rows: unknown[]) => rows.map((r, i) => ({ ...(r as object), id: `m${i}`, seq: i + 1 })));
        m.runTurn.mockResolvedValue(OK_TURN);
    });

    it('킬 스위치 → 503', async () => {
        process.env.AGENT_CHAT_DISABLED = '1';
        expect((await POST(post({ message: 'x' }))).status).toBe(503);
    });
    it('비로그인 401, 봇 403, 4,001자 400, 남의 대화 404, 락 실패 409, 동시성 초과 503', async () => {
        m.user.mockResolvedValueOnce(null);
        expect((await POST(post({ message: 'x' }))).status).toBe(401);
        m.isBot.mockReturnValueOnce(true);
        expect((await POST(post({ message: 'x' }))).status).toBe(403);
        expect((await POST(post({ message: 'x'.repeat(4001) }))).status).toBe(400);
        m.repo.findForUser.mockResolvedValueOnce(null);
        expect((await POST(post({ conversationId: 'c1', message: 'x' }))).status).toBe(404);
        m.lock.mockResolvedValueOnce(null);
        expect((await POST(post({ message: 'x' }))).status).toBe(409);
        m.canAccept.mockReturnValueOnce(false);
        expect((await POST(post({ message: 'x' }))).status).toBe(503);
    });
    it('새 대화: 생성 → user 저장 → 턴(고정 모델·보유 심볼) → assistant 저장 → meta/done, 락 해제', async () => {
        const release = vi.fn(); m.lock.mockResolvedValue({ release });
        const res = await POST(post({ conversationId: null, message: 'AAPL?', model: 'claude-opus-5' }, { 'x-siglens-locale': 'en' }));
        expect(res.headers.get('content-type')).toContain('text/event-stream');
        const f = await frames(res);
        expect(f[0]).toContain('"conversationId":"c-new"');
        expect(f.at(-1)).toContain('event: done');
        expect(m.repo.create).toHaveBeenCalledWith({ userId: 'u1', firstMessage: 'AAPL?', locale: 'en', modelId: 'deepseek-v4.1-flash' });
        expect(m.repo.appendMessages).toHaveBeenCalledTimes(2);
        expect(m.runTurn.mock.calls[0]![0]).toMatchObject({ userId: 'u1', tier: 'member', model: 'deepseek-v4.1-flash', locale: 'en', userMessage: 'AAPL?', portfolioSymbols: ['AAPL'] });
        expect(release).toHaveBeenCalledTimes(1);
    });
    it('send는 기존 이력 전체를 넘긴다(직전 assistant를 자르지 않는다)', async () => {
        m.repo.listMessages.mockResolvedValue([
            { seq: 1, role: 'user', content: 'q1', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { seq: 2, role: 'assistant', content: 'a1', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
        ]);
        await POST(post({ conversationId: 'c1', message: 'q2' }));
        expect(m.runTurn.mock.calls[0]![0].history).toEqual([{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }]);
    });
    it('regenerate는 마지막 user 이후를 superseded, 그 user를 userMessage로, 이력에서는 제외', async () => {
        m.repo.supersedeAfterLastUser.mockResolvedValue(3);
        m.repo.listMessages.mockResolvedValue([
            { seq: 1, role: 'user', content: 'q1', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { seq: 2, role: 'assistant', content: 'a1', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { seq: 3, role: 'user', content: '다시', toolCalls: null, toolCallId: null, toolName: null, status: 'complete' },
            { seq: 4, role: 'assistant', content: 'old', toolCalls: null, toolCallId: null, toolName: null, status: 'superseded' },
        ]);
        await POST(post({ conversationId: 'c1', action: 'regenerate' }));
        const params = m.runTurn.mock.calls[0]![0];
        expect(params.userMessage).toBe('다시');
        expect(params.history).toEqual([{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }]);
        expect(m.repo.appendMessages).toHaveBeenCalledTimes(1);
    });
    it('턴 한도 오류 → error 프레임 turn_limit', async () => {
        m.runTurn.mockResolvedValue({ ok: false, error: 'turn_limit' });
        expect((await frames(await POST(post({ conversationId: 'c1', message: 'x' })))).at(-1)).toBe('event: error\ndata: {"code":"turn_limit","message":"turn_limit"}');
    });
    it('[Agent] 로그에 tool_end 타이밍이 실린다', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        m.runTurn.mockImplementation(async (_p: unknown, deps: { onEvent: (e: unknown) => void }) => {
            deps.onEvent({ type: 'tool_end', id: 't', name: 'get_quote', status: 'ok', ms: 12, summary: '' });
            return { ...OK_TURN, toolsUsed: ['get_quote'] };
        });
        await frames(await POST(post({ conversationId: 'c1', message: 'x' })));
        const line = info.mock.calls.find(c => c[0] === '[Agent]')![1] as string;
        expect(JSON.parse(line).toolCalls).toEqual([{ name: 'get_quote', ms: 12, status: 'ok' }]);
        info.mockRestore();
    });
});
```

- [ ] **Step 5: 라우트 구현**

```ts
// src/app/api/ai/chat/stream/route.ts
import 'server-only';
import type { AgentMessage } from '@y0ngha/siglens-core';
import { AGENT_LIMITS, agentLimit, runAgentTurn } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { toAgentHistory, type NewChatMessage } from '@/entities/chat-conversation/model';
import { AGENT_MODEL, getAgentProvider } from '@/entities/llm-provider';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { isBot } from '@/shared/api/isBot';
import { getDatabaseClient } from '@/shared/db/client';
import { ANALYSIS_LOCALE_HEADER, DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import { AgentTurnError, agentEventStream } from '../agentEventStream';
import { createAgentCounters } from '../counters';
import { resolveAgentTier } from '../resolveAgentTier';
import { availableToolNames, createToolExecutor } from '../tools';
import { acquireTurnLock } from '../turnLock';

export const dynamic = 'force-dynamic';

const SSE_HEADERS: HeadersInit = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store, no-transform', 'X-Accel-Buffering': 'no' };
const MESSAGE_MAX_CHARS = 4_000;
/** Per-instance cap on concurrent agent turns (spec §6-3). */
const MAX_CONCURRENT_AGENT_TURNS = 4;
let activeAgentTurns = 0;

type Action = 'send' | 'regenerate' | 'edit';
interface Body { conversationId: string | null; message: string; action: Action; editSeq?: number }

/** Pilot: `model`/`analysisModel` from the client are ignored (spec R12). */
function parseBody(raw: unknown): Body | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const b = raw as Record<string, unknown>;
    const action: Action = b.action === 'regenerate' || b.action === 'edit' ? b.action : 'send';
    const message = typeof b.message === 'string' ? b.message.trim() : '';
    if (action !== 'regenerate' && (message.length === 0 || message.length > MESSAGE_MAX_CHARS)) return null;
    if (action === 'edit' && !Number.isInteger(b.editSeq)) return null;
    return { conversationId: typeof b.conversationId === 'string' ? b.conversationId : null, message, action, ...(action === 'edit' ? { editSeq: b.editSeq as number } : {}) };
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
    const tier = await resolveAgentTier(user.id);
    if (!canAcceptAnalysisStream() || activeAgentTurns >= MAX_CONCURRENT_AGENT_TURNS) return json(503, { error: 'server_busy' }, { 'Retry-After': '30' });

    const { db } = getDatabaseClient();
    const repo = new DrizzleChatConversationRepository(db);
    const conversation = body.conversationId === null ? null : await repo.findForUser(body.conversationId, user.id);
    if (body.conversationId !== null && conversation === null) return json(404, { error: 'not_found' });
    if (conversation === null && body.action !== 'send') return json(400, { error: 'invalid_body' });
    if (conversation === null && (await repo.countForUser(user.id)) >= agentLimit(tier, 'conversationsMax')) return json(409, { error: 'conversation_limit' });

    const lock = await acquireTurnLock(user.id);
    if (lock === null) return json(409, { error: 'server_busy' });

    let conversationId = conversation?.id ?? '';
    let userMessage = body.message;
    let userMessageId: string | null = null;
    let title: string | undefined;
    try {
        if (conversation === null) {
            const created = await repo.create({ userId: user.id, firstMessage: body.message, locale, modelId: AGENT_MODEL });
            conversationId = created.id;
            title = created.title;
        }
        if (body.action === 'regenerate') {
            if ((await repo.supersedeAfterLastUser(conversationId)) === null) { await lock.release(); return json(400, { error: 'invalid_body' }); }
        } else if (body.action === 'edit') {
            await repo.deleteFromSeq(conversationId, body.editSeq!);
        }
        const rows = await repo.listMessages(conversationId);
        if (rows.length >= AGENT_LIMITS.messagesPerConversation) { await lock.release(); return json(409, { error: 'conversation_full' }); }

        // History = every prior turn. `send`/`edit` append the new user row AFTER this read, so the whole
        // transcript is history; `regenerate` reuses the last user row as `userMessage` and drops it from history.
        let history: AgentMessage[] = toAgentHistory(rows);
        if (body.action === 'regenerate') {
            userMessage = [...rows].reverse().find(r => r.role === 'user')?.content ?? '';
            const lastUserIndex = history.map(m => m.role).lastIndexOf('user');
            history = lastUserIndex >= 0 ? history.slice(0, lastUserIndex) : history;
        } else {
            const [saved] = await repo.appendMessages(conversationId, [{ role: 'user', content: body.message }]);
            userMessageId = saved?.id ?? null;
        }
        const portfolioSymbols = (await new DrizzlePortfolioRepository(db).findByUser(user.id)).map(h => h.symbol);

        const controller = new AbortController();
        const executeTool = createToolExecutor({ analysisModel: AGENT_MODEL });
        const toolTimings: Array<{ name: string; ms: number; status: string }> = [];
        activeAgentTurns += 1;
        let released = false;
        const releaseAll = async (): Promise<void> => { if (released) return; released = true; activeAgentTurns -= 1; await lock.release(); };

        const stream = agentEventStream({
            meta: { conversationId, userMessageId, model: AGENT_MODEL, ...(title !== undefined ? { title } : {}) },
            onAbort: () => controller.abort(),
            work: async emit => {
                try {
                    const result = await runAgentTurn(
                        { userId: user.id, tier, model: AGENT_MODEL, locale, history, userMessage, availableTools: availableToolNames(), portfolioSymbols, signal: controller.signal },
                        {
                            callAgentProvider: getAgentProvider(),
                            executeTool,
                            counters: createAgentCounters(),
                            onEvent: event => { if (event.type === 'tool_end') toolTimings.push({ name: event.name, ms: event.ms, status: event.status }); emit(event); },
                        }
                    );
                    if (!result.ok) {
                        const partial = result.partialText?.trim();
                        if (partial) await repo.appendMessages(conversationId, [{ role: 'assistant', content: partial, modelId: AGENT_MODEL, status: result.error === 'aborted' ? 'aborted' : 'error' }]);
                        throw new AgentTurnError(result.error);
                    }
                    const rowsToSave: NewChatMessage[] = [
                        ...result.intermediate.map(m => ({ role: m.role, content: m.content, toolCalls: m.toolCalls, toolCallId: m.toolCallId, toolName: m.toolName })),
                        { role: 'assistant', content: result.assistant.content, modelId: AGENT_MODEL, usage: { ...result.usage, toolsUsed: result.toolsUsed, promptVersion: result.promptVersion } },
                    ];
                    const saved = await repo.appendMessages(conversationId, rowsToSave);
                    console.info('[Agent]', JSON.stringify({ conversationId, userId: user.id, model: AGENT_MODEL, steps: result.usage.steps, toolCalls: toolTimings, promptVersion: result.promptVersion, ms: result.usage.ms, stopReason: result.stopReason }));
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
```

- [ ] **Step 6: 통과 확인** — Run: `yarn test src/app/api/ai/chat && yarn typecheck && yarn lint` → PASS.

- [ ] **Step 7: Commit** — `feat(api/ai): 에이전트 SSE 라우트(고정 모델·락·저장·regenerate/edit·[Agent] 로그)와 writer`

---

### Task 11: UI — 스트림 훅·위젯·페이지·i18n (SiglensAI, siglens 톤)

구현 전 스킬: `frontend-design → web-design-guidelines → seo-audit`, `vercel-react-best-practices → next-cache-components`. 디자인: siglens 톤(R11) — 새 색 없음, DESIGN.md 토큰·`SURFACE_CARD`·`HEADING_SECTION`·`border-control`·포커스 링·두 테마, 헤더 `h-14`, Geist+Pretendard. 모델 선택 UI 없음(R12).

**Files:**
- Create: `src/features/agent-chat/lib/parseSseFrames.ts`, `hooks/useAgentStream.ts`, `index.ts`
- Create: `src/widgets/agent-chat/{AgentMarkdown,ToolActivity,MessageList,Composer,EmptyState,Sidebar,AiHeader,ChatShell}.tsx`, `index.ts`
- Create/Replace: `src/app/ai/[locale]/layout.tsx`, `page.tsx`, `c/[id]/page.tsx`, `not-found.tsx`
- Test: `src/features/agent-chat/__tests__/{parseSseFrames,useAgentStream}.test.ts(x)`, `src/widgets/agent-chat/__tests__/{AgentMarkdown,MessageList,Composer,AiHeader}.test.tsx`, `src/app/ai/__tests__/aiClientPaths.test.ts`

- [ ] **Step 1: 프레임 파서 테스트·구현**

```ts
// src/features/agent-chat/__tests__/parseSseFrames.test.ts
import { describe, expect, it } from 'vitest';
import { parseSseFrame, splitFrames } from '@/features/agent-chat/lib/parseSseFrames';
describe('parseSseFrames', () => {
    it('프레임 분리·나머지 유지', () => {
        const { frames, rest } = splitFrames('event: a\ndata: {"x":1}\n\nevent: b\ndata: {}\n\nevent: c\ndata: {');
        expect(frames).toHaveLength(2);
        expect(rest).toBe('event: c\ndata: {');
    });
    it('event·data 파싱, 깨진 JSON은 null', () => {
        expect(parseSseFrame('event: text\ndata: {"delta":"hi"}')).toEqual({ event: 'text', data: { delta: 'hi' } });
        expect(parseSseFrame('event: text\ndata: {bad')).toEqual({ event: 'text', data: null });
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
    try {
        return { event, data: raw ? (JSON.parse(raw) as Record<string, unknown>) : {} };
    } catch {
        return { event, data: null };
    }
}
```

- [ ] **Step 2: 훅 테스트**

```tsx
// src/features/agent-chat/__tests__/useAgentStream.test.tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';

function sse(frames: string[]): Response {
    const body = new ReadableStream<Uint8Array>({ start(c) { for (const f of frames) c.enqueue(new TextEncoder().encode(`${f}\n\n`)); c.close(); } });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
afterEach(() => vi.restoreAllMocks());

describe('useAgentStream', () => {
    it('send: 낙관적 user → 툴 칩 → 텍스트 누적 → done', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([
            'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1","model":"deepseek-v4.1-flash"}',
            'event: tool_start\ndata: {"id":"t1","name":"get_quote","args":{"symbols":["AAPL"]}}',
            'event: tool_end\ndata: {"id":"t1","name":"get_quote","status":"ok","ms":12,"summary":"{}"}',
            'event: text\ndata: {"delta":"231"}', 'event: text\ndata: {"delta":".42"}',
            'event: done\ndata: {"assistantMessageId":"m2","remaining":{"turns":59,"fresh":6,"search":5},"stopReason":"end"}',
        ]));
        const { result } = renderHook(() => useAgentStream({ conversationId: null, initialMessages: [] }));
        act(() => { void result.current.send('AAPL?'); });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.conversationId).toBe('c1');
        expect(result.current.messages.map(m => [m.role, m.content])).toEqual([['user', 'AAPL?'], ['assistant', '231.42']]);
        expect(result.current.messages[1]!.tools).toEqual([{ id: 't1', name: 'get_quote', args: { symbols: ['AAPL'] }, status: 'ok', ms: 12, summary: '{}' }]);
        expect(result.current.remaining).toEqual({ turns: 59, fresh: 6, search: 5 });
        const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ action: 'send', message: 'AAPL?' });
    });
    it('error 프레임 → status error + code', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse(['event: meta\ndata: {}', 'event: error\ndata: {"code":"turn_limit","message":"turn_limit"}']));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [] }));
        act(() => { void result.current.send('x'); });
        await waitFor(() => expect(result.current.error).toBe('turn_limit'));
    });
    it('HTTP 401 → error unauthenticated', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'unauthenticated' }, { status: 401 }));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [] }));
        act(() => { void result.current.send('x'); });
        await waitFor(() => expect(result.current.error).toBe('unauthenticated'));
    });
    it('stop은 abort', async () => {
        const abort = vi.spyOn(AbortController.prototype, 'abort');
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
        const { result } = renderHook(() => useAgentStream({ conversationId: 'c1', initialMessages: [] }));
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
import type { ChatMessageView } from '@/entities/chat-conversation';
import { ANALYSIS_LOCALE_HEADER, splitLocalePath } from '@/shared/i18n/locales';
import { parseSseFrame, splitFrames } from '../lib/parseSseFrames';

export interface ToolActivityItem { id: string; name: string; args: Record<string, unknown>; status: 'running' | 'ok' | 'error'; ms?: number; summary?: string; estimatedSeconds?: number }
export interface AgentUiMessage { id: string; seq?: number; role: 'user' | 'assistant'; content: string; tools: ToolActivityItem[]; status: 'complete' | 'streaming' | 'aborted' | 'error'; truncated?: boolean }
export interface AgentRemaining { turns: number; fresh: number; search: number }
export type StreamStatus = 'idle' | 'streaming' | 'error';
interface Options { conversationId: string | null; initialMessages: ChatMessageView[]; onConversationCreated?: (id: string, title: string) => void }

/** DB rows → UI messages: tool rows fold into the preceding assistant bubble. */
export function fromViews(views: ChatMessageView[]): AgentUiMessage[] {
    const out: AgentUiMessage[] = [];
    for (const v of views) {
        const prev = out[out.length - 1];
        if (v.role === 'tool') {
            if (prev?.role === 'assistant') prev.tools.push({ id: v.id, name: v.toolName ?? 'tool', args: {}, status: 'ok', summary: v.content.slice(0, 120) });
            continue;
        }
        if (v.role === 'assistant' && v.toolCalls && v.toolCalls.length > 0 && v.content === '') {
            if (prev?.role === 'assistant' && prev.content === '') prev.tools.push(...v.toolCalls.map(c => ({ id: c.id, name: c.name, args: c.args, status: 'ok' as const })));
            else out.push({ id: v.id, seq: v.seq, role: 'assistant', content: '', tools: v.toolCalls.map(c => ({ id: c.id, name: c.name, args: c.args, status: 'ok' as const })), status: 'complete' });
            continue;
        }
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
        setMessages(prev => (prev.length === 0 ? prev : [...prev.slice(0, -1), fn(prev[prev.length - 1]!)]));
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
                body: JSON.stringify({ conversationId, ...body }),
                signal: controller.signal,
            });
            if (!response.ok || response.body === null) {
                const payload = (await response.json().catch(() => ({}))) as { error?: string };
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
                    if (event === 'meta' && typeof data.conversationId === 'string' && data.conversationId !== conversationId) {
                        setConversationId(data.conversationId);
                        options.onConversationCreated?.(data.conversationId, String(data.title ?? ''));
                    } else if (event === 'text') {
                        patchLast(m => ({ ...m, content: m.content + String(data.delta ?? '') }));
                    } else if (event === 'tool_start') {
                        patchLast(m => ({ ...m, tools: [...m.tools, { id: String(data.id), name: String(data.name), args: (data.args as Record<string, unknown>) ?? {}, status: 'running', estimatedSeconds: typeof data.estimatedSeconds === 'number' ? data.estimatedSeconds : undefined }] }));
                    } else if (event === 'tool_end') {
                        patchLast(m => ({ ...m, tools: m.tools.map(t => (t.id === data.id ? { ...t, status: data.status === 'ok' ? 'ok' : 'error', ms: Number(data.ms), summary: String(data.summary ?? '') } : t)) }));
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
        setMessages(prev => (prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev));
        return run({ action: 'regenerate' });
    }, [run]);
    const edit = useCallback((seq: number, message: string) => {
        setMessages(prev => {
            const index = prev.findIndex(m => m.seq === seq);
            return [...(index >= 0 ? prev.slice(0, index) : prev), { id: `local-${Date.now()}`, role: 'user', content: message, tools: [], status: 'complete' }];
        });
        return run({ action: 'edit', editSeq: seq, message });
    }, [run]);
    const stop = useCallback(() => controllerRef.current?.abort(), []);

    return { messages, conversationId, status, error, remaining, send, regenerate, edit, stop };
}
```

`src/features/agent-chat/index.ts`: `export { useAgentStream, fromViews } from './hooks/useAgentStream'; export type { AgentUiMessage, ToolActivityItem, StreamStatus } from './hooks/useAgentStream';`

- [ ] **Step 4: 훅 테스트 통과** — `yarn test src/features/agent-chat` → PASS.

- [ ] **Step 5: 위젯 테스트**

```tsx
// src/widgets/agent-chat/__tests__/AgentMarkdown.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentMarkdown } from '@/widgets/agent-chat/AgentMarkdown';
describe('AgentMarkdown', () => {
    it('이미지 미렌더, 링크 rel·호스트', () => {
        const { container } = render(<AgentMarkdown>{'![x](https://evil/a.png) [뉴스](https://example.com/p)'}</AgentMarkdown>);
        expect(container.querySelector('img')).toBeNull();
        const a = screen.getByRole('link');
        expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow');
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
    it('툴 칩·재생성·잘림 배너·aria-live', () => {
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
    it('Enter 전송·Shift+Enter 줄바꿈·4,000자 초과 비활성', () => {
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
    it('스트리밍 중 중단 버튼', () => {
        const onStop = vi.fn();
        wrap(<Composer disabled={false} streaming remainingTurns={5} onSend={vi.fn()} onStop={onStop} />);
        fireEvent.click(screen.getByRole('button', { name: /중단/ }));
        expect(onStop).toHaveBeenCalled();
    });
});
```

```tsx
// src/widgets/agent-chat/__tests__/AiHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/features/auth-logout/actions/logoutAction', () => ({ logoutAction: vi.fn() }));
import { AiHeader } from '@/widgets/agent-chat/AiHeader';
import ko from '../../../../messages/ko.json';
const wrap = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="ko" messages={ko}>{ui}</NextIntlClientProvider>);
describe('AiHeader', () => {
    it('비로그인: 메인 로그인 + 핸드오프 next, 로그인: 계정(메인 절대)·로그아웃', () => {
        wrap(<AiHeader signedIn={false} siteUrl="https://siglens.io" localePrefix="" currentPath="/c/abc" onOpenSidebar={vi.fn()} />);
        const login = screen.getByRole('link', { name: /로그인/ });
        expect(login).toHaveAttribute('href', 'https://siglens.io/login?next=' + encodeURIComponent('/api/auth/handoff?to=ai&next=' + encodeURIComponent('/c/abc')));
        wrap(<AiHeader signedIn siteUrl="https://siglens.io" localePrefix="/en" currentPath="/" onOpenSidebar={vi.fn()} />);
        expect(screen.getByRole('link', { name: /계정/ })).toHaveAttribute('href', 'https://siglens.io/en/account');
        expect(screen.getByRole('button', { name: /로그아웃/ })).toBeInTheDocument();
        expect(screen.getAllByText('SiglensAI').length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 6: 위젯 구현** (한국어 리터럴 → Step 9 추출)

```tsx
// src/widgets/agent-chat/AgentMarkdown.tsx
import type { Components } from 'react-markdown';
import { MarkdownText } from '@/shared/ui/MarkdownText';
/** Output hygiene (spec §8): no images (exfil beacons); links open safely with the host shown. */
const AGENT_COMPONENTS: Components = {
    img: () => null,
    a: ({ href, children }) => {
        let host = '';
        try { host = new URL(String(href)).hostname; } catch { host = ''; }
        return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-400 underline underline-offset-2 hover:text-primary-300">{children}{host ? <span className="ml-1 text-xs text-secondary-400">({host})</span> : null}</a>;
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
const ICON: Record<string, string> = { search_ticker: '🔎', get_quote: '💹', get_bars_indicators: '📊', get_cached_analysis: '🧠', get_news: '📰', get_options_summary: '🎯', get_my_portfolio: '💼', run_fresh_analysis: '⚙️', web_search: '🌐' };
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
                        {ICON[t.name] ?? '🔧'} {label(t)}{t.ms !== undefined ? ` · ${(t.ms / 1000).toFixed(1)}s` : ''}{t.status === 'running' && t.estimatedSeconds ? ` · 약 ${t.estimatedSeconds}초` : ''}
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
                                    <textarea value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} aria-label="메시지 수정" className="min-h-20 w-72 rounded border border-control bg-secondary-900 p-2 text-secondary-100" />
                                    <div className="flex gap-2"><button type="submit" className="rounded bg-primary-500 px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-primary-500">다시 보내기</button><button type="button" onClick={() => setEditing(null)} className="rounded px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary-500">취소</button></div>
                                </form>
                            ) : m.role === 'assistant' ? <AgentMarkdown>{m.content || (m.status === 'streaming' ? '…' : '')}</AgentMarkdown> : <p className="whitespace-pre-wrap">{m.content}</p>}
                            {m.status === 'aborted' ? <p className="mt-2 text-xs text-secondary-400">중단된 답변입니다.</p> : null}
                            {m.status === 'error' ? <p className="mt-2 text-xs text-ui-danger-text">답변 생성에 실패했습니다.</p> : null}
                            {m.truncated ? <p className="mt-2 text-xs text-ui-warning-text">답변이 잘렸습니다. 이어서 질문해 주세요.</p> : null}
                        </div>
                        <div className="mt-1 flex gap-2 text-xs text-secondary-400">
                            <button type="button" onClick={() => void navigator.clipboard.writeText(m.content)} className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500">복사</button>
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
                <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} rows={1} disabled={disabled} aria-label="메시지 입력"
                    placeholder="종목, 시장, 뉴스, 내 보유 종목에 대해 물어보세요 (Enter 전송 · Shift+Enter 줄바꿈)"
                    className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-control bg-secondary-800 px-3 py-2 text-sm text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                    onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }} />
                {streaming
                    ? <button type="button" onClick={onStop} className="rounded-lg border border-control px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary-500">중단</button>
                    : <button type="button" onClick={submit} disabled={!canSend} className={cn('rounded-lg bg-primary-500 px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500', !canSend && 'bg-secondary-700 text-secondary-400')}>전송</button>}
            </div>
            <p className="mx-auto mt-1 flex w-full max-w-3xl justify-between text-xs text-secondary-400">
                <span>{text.length > MAX ? `${text.length.toLocaleString()} / ${MAX.toLocaleString()}자 — 너무 깁니다` : `${text.length.toLocaleString()} / ${MAX.toLocaleString()}`}</span>
                <span>{remainingTurns !== null ? `오늘 ${remainingTurns}턴 남음 · ` : ''}정보 제공 목적이며 투자 조언이 아닙니다.</span>
            </p>
        </div>
    );
}
```

```tsx
// src/widgets/agent-chat/EmptyState.tsx
const SUGGESTIONS = ['내 보유 종목 지금 어때?', '삼성전자 최근 siglens 분석 요약해줘', 'AAPL 지금 추세랑 RSI 어때?', '이번 주 미국 시장 뉴스 중요한 것만', 'NVDA 옵션 시장은 어떻게 보고 있어?', 'BTCUSD 캐시된 분석 있어?'];
export function EmptyState({ onPick, signedIn, loginHref }: { readonly onPick: (text: string) => void; readonly signedIn: boolean; readonly loginHref: string }) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
            <h1 className="text-2xl font-semibold text-secondary-100">SiglensAI에게 물어보세요</h1>
            <p className="max-w-md text-sm text-secondary-300">시세·지표·siglens 분석·뉴스·옵션·내 보유 종목을 직접 조회해서 답합니다. 캐시된 분석이 없으면 새로 분석합니다.</p>
            {signedIn ? (
                <ul className="grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map(s => <li key={s}><button type="button" onClick={() => onPick(s)} className="w-full rounded-lg border border-control bg-secondary-800 px-3 py-2 text-left text-sm text-secondary-200 hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500">{s}</button></li>)}
                </ul>
            ) : <a href={loginHref} className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-primary-500">siglens 계정으로 로그인</a>}
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
// src/widgets/agent-chat/AiHeader.tsx
'use client';
import { logoutAction } from '@/features/auth-logout/actions/logoutAction';

interface Props { readonly signedIn: boolean; readonly siteUrl: string; readonly localePrefix: string; readonly currentPath: string; readonly onOpenSidebar: () => void }

/** Login goes to the MAIN host and comes back through the handoff (spec §9-4); `next` stays a path. */
export function loginHref(siteUrl: string, localePrefix: string, currentPath: string): string {
    const handoff = `/api/auth/handoff?to=ai&next=${encodeURIComponent(currentPath)}`;
    return `${siteUrl}${localePrefix}/login?next=${encodeURIComponent(handoff)}`;
}

/** Same chrome grammar as siglens `Header` (h-14, tokens); no model picker in the pilot (R12). */
export function AiHeader({ signedIn, siteUrl, localePrefix, currentPath, onOpenSidebar }: Props) {
    return (
        <header className="flex h-14 items-center gap-3 border-b border-control px-4">
            <button type="button" onClick={onOpenSidebar} aria-label="대화 목록 열기" className="rounded px-2 py-1 text-sm lg:hidden focus-visible:ring-2 focus-visible:ring-primary-500">☰</button>
            <a href={siteUrl} className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-500">
                <span className="text-sm font-semibold text-secondary-100">siglens</span>
                <span className="rounded bg-primary-500/15 px-1.5 py-0.5 text-xs font-medium text-primary-400">SiglensAI</span>
            </a>
            <div className="ml-auto flex items-center gap-3 text-sm">
                {signedIn ? (
                    <>
                        <a href={`${siteUrl}${localePrefix}/account`} className="text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500">계정</a>
                        <form action={logoutAction}><button type="submit" className="text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500">로그아웃</button></form>
                    </>
                ) : <a href={loginHref(siteUrl, localePrefix, currentPath)} className="text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500">로그인</a>}
            </div>
        </header>
    );
}
```

```tsx
// src/widgets/agent-chat/ChatShell.tsx
'use client';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { useRouter } from 'next/navigation';
import type { ChatMessageView } from '@/entities/chat-conversation';
import type { ConversationListItem } from '@/entities/chat-conversation/actions';
import { useAgentStream } from '@/features/agent-chat';
import { AiHeader, loginHref } from './AiHeader';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { Sidebar } from './Sidebar';

interface Props { readonly conversationId: string | null; readonly initialMessages: ChatMessageView[]; readonly conversations: ConversationListItem[]; readonly signedIn: boolean; readonly localePrefix: string; readonly siteUrl: string; readonly currentPath: string }

const ERROR_COPY: Record<string, string> = {
    turn_limit: '오늘 사용 한도에 도달했습니다. 내일 다시 이용해 주세요.',
    server_busy: '지금 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    deadline: '답변 시간이 초과됐습니다. 다시 생성해 주세요.',
    unauthenticated: '로그인이 필요합니다.',
    conversation_limit: '대화 수 상한에 도달했습니다. 오래된 대화를 삭제해 주세요.',
};

export function ChatShell({ conversationId, initialMessages, conversations, signedIn, localePrefix, siteUrl, currentPath }: Props) {
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const stream = useAgentStream({ conversationId, initialMessages, onConversationCreated: id => { window.history.replaceState(null, '', `${localePrefix}/c/${id}`); router.refresh(); } });
    const sidebar = <Sidebar items={conversations} activeId={stream.conversationId} localePrefix={localePrefix} />;
    return (
        <div className="flex min-h-dvh">
            <aside className="hidden w-64 shrink-0 border-r border-control lg:block">{sidebar}</aside>
            <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction="left" modal={false}>
                <Drawer.Portal><Drawer.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-secondary-900"><Drawer.Title className="sr-only">대화 목록</Drawer.Title>{sidebar}</Drawer.Content></Drawer.Portal>
            </Drawer.Root>
            <div className="flex min-w-0 flex-1 flex-col">
                <AiHeader signedIn={signedIn} siteUrl={siteUrl} localePrefix={localePrefix} currentPath={currentPath} onOpenSidebar={() => setDrawerOpen(true)} />
                {stream.messages.length === 0
                    ? <EmptyState signedIn={signedIn} loginHref={loginHref(siteUrl, localePrefix, currentPath)} onPick={text => void stream.send(text)} />
                    : <MessageList messages={stream.messages} streaming={stream.status === 'streaming'} onRegenerate={() => void stream.regenerate()} onEdit={(seq, text) => void stream.edit(seq, text)} />}
                {stream.error ? (
                    <p role="alert" className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 text-sm text-ui-danger-text">
                        {ERROR_COPY[stream.error] ?? '오류가 발생했습니다. 다시 시도해 주세요.'}
                        {stream.error !== 'turn_limit' && stream.error !== 'unauthenticated' ? <button type="button" onClick={() => void stream.regenerate()} className="rounded border border-control px-2 py-0.5 text-xs text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500">재시도</button> : null}
                    </p>
                ) : null}
                <Composer disabled={!signedIn} streaming={stream.status === 'streaming'} remainingTurns={stream.remaining?.turns ?? null} onSend={text => void stream.send(text)} onStop={stream.stop} />
            </div>
        </div>
    );
}
```

`src/widgets/agent-chat/index.ts`: `export { ChatShell } from './ChatShell'; export { AiHeader, loginHref } from './AiHeader';`

- [ ] **Step 7: 레이아웃·페이지**

```tsx
// src/app/ai/[locale]/layout.tsx  (Task 1 파일 교체)
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';
import { ReactQueryProvider } from '@/app/providers';
import { VisitorPing } from '@/features/visitor-ping';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import { ThemeInitScript } from '@/shared/ui/ThemeInitScript';
import '../../globals.css';

export const dynamic = 'force-dynamic';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const pretendard = localFont({ src: '../../fonts/PretendardVariable-subset.woff2', variable: '--font-pretendard', display: 'swap', weight: '100 900' });

/** Client namespaces rendered by the SiglensAI subtree (spec §9-3). Kept in sync by `aiClientPaths.test.ts`. */
export const AI_CLIENT_PATHS = ['widgets.agent-chat', 'features.agent-chat', 'app.ai', 'shared.ui'] as const;

export const metadata: Metadata = { metadataBase: new URL(AI_SITE_URL), title: { default: 'SiglensAI', template: '%s | SiglensAI' }, robots: { index: false, follow: false } };

export default async function AiRootLayout({ children, params }: { readonly children: ReactNode; readonly params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    const messages = await getMessages({ locale });
    const disabled = process.env.AGENT_CHAT_DISABLED === '1';
    return (
        <html lang={LOCALE_HREFLANG[locale]} className={`${geistSans.variable} ${pretendard.variable} h-full antialiased scheme-dark`}>
            <body className="flex min-h-full flex-col bg-secondary-900">
                <ThemeInitScript />
                <LocaleProvider locale={locale}>
                    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, [...AI_CLIENT_PATHS])}>
                        <ReactQueryProvider>
                            <VisitorPing />
                            {disabled ? <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 text-center text-secondary-200">SiglensAI는 지금 점검 중입니다. 잠시 후 다시 이용해 주세요.</main> : children}
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
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listConversationsAction } from '@/entities/chat-conversation/actions';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';

export const dynamic = 'force-dynamic';

/** No ai-host session and no `?sso=none` → bounce through the main host once (spec §9-4). */
export async function maybeHandoffRedirect(locale: string, path: string, searchParams: Record<string, string | string[] | undefined>): Promise<void> {
    const hasCookie = (await cookies()).get(AUTH_SESSION_COOKIE_NAME)?.value;
    if (hasCookie || searchParams.sso === 'none') return;
    redirect(`${SITE_URL}/api/auth/handoff?to=ai&next=${encodeURIComponent(localePath(locale as never, path))}`);
}

export default async function AiHomePage({ params, searchParams }: { readonly params: Promise<{ locale: string }>; readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { locale: raw } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    await maybeHandoffRedirect(locale, '/', await searchParams);
    const user = await getCurrentUser();
    const conversations = user ? await listConversationsAction() : [];
    const localePrefix = localePath(locale, '').replace(/\/$/, '');
    return <ChatShell conversationId={null} initialMessages={[]} conversations={conversations} signedIn={user !== null} localePrefix={localePrefix} siteUrl={SITE_URL} currentPath={`${localePrefix}/`} />;
}
```

(`maybeHandoffRedirect`는 `c/[id]/page.tsx`도 쓰므로 `src/app/ai/[locale]/handoffRedirect.ts`로 분리해 두 페이지가 import한다 — 페이지 파일은 default export 외 임의 export를 두면 Next가 거부한다.)

```tsx
// src/app/ai/[locale]/c/[id]/page.tsx
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getConversationAction, listConversationsAction } from '@/entities/chat-conversation/actions';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';
import { maybeHandoffRedirect } from '../../handoffRedirect';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params, searchParams }: { readonly params: Promise<{ locale: string; id: string }>; readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { locale: raw, id } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    await maybeHandoffRedirect(locale, `/c/${id}`, await searchParams);
    const user = await getCurrentUser();
    if (!user) notFound();
    const [conversation, conversations] = await Promise.all([getConversationAction(id), listConversationsAction()]);
    if (!conversation) notFound();
    const localePrefix = localePath(locale, '').replace(/\/$/, '');
    return <ChatShell conversationId={conversation.id} initialMessages={conversation.messages} conversations={conversations} signedIn localePrefix={localePrefix} siteUrl={SITE_URL} currentPath={`${localePrefix}/c/${id}`} />;
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

네임스페이스 정합 테스트:

```ts
// src/app/ai/__tests__/aiClientPaths.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_CLIENT_PATHS } from '@/app/ai/[locale]/layout';

function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));
}
describe('AI_CLIENT_PATHS', () => {
    it('ai 위젯·피처가 쓰는 useTranslations 네임스페이스를 전부 포함한다', () => {
        const files = [...walk(join(process.cwd(), 'src/widgets/agent-chat')), ...walk(join(process.cwd(), 'src/features/agent-chat'))].filter(f => !f.includes('__tests__'));
        const used = new Set<string>();
        for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/useTranslations\('([^']+)'\)/g)) used.add(m[1]!);
        for (const ns of used) expect(AI_CLIENT_PATHS.some(p => ns === p || ns.startsWith(`${p}.`))).toBe(true);
    });
});
```

- [ ] **Step 8: 위젯·페이지 테스트 통과** — `yarn test src/widgets/agent-chat src/features/agent-chat src/app/ai && yarn typecheck` → PASS.

- [ ] **Step 9: i18n 추출·번역·검증**

```bash
yarn i18n:extract --write --apply --only src/widgets/agent-chat
yarn i18n:extract --write --apply --only src/app/ai
yarn i18n:translate
yarn i18n:verify && yarn i18n:lint
yarn test src/widgets/agent-chat src/features/agent-chat src/app/ai
```

- [ ] **Step 10: 실기동** — `yarn dev` 후 `http://ai.localhost:3000/`: 비로그인 → 메인 핸드오프로 튕겼다가 `?sso=none` 랜딩 → 로그인 링크(메인 `/login?next=…`) → 메인 로그인 → 핸드오프 → ai 호스트에 세션 → 새 대화 → "내 보유 종목 지금 어때?" → `get_my_portfolio`·`get_quote` 칩 → 새로고침 후 사이드바에 대화. Chrome 확장으로 하이드레이션 에러 0(탭 전면). ※ Task 12 완료 후 재확인.

- [ ] **Step 11: Commit** — `feat(ai): SiglensAI 챗 UI·페이지·랜딩 핸드오프·i18n`

---

### Task 12: SSO 핸드오프(메인 → ai 1회용 코드)

**Files:**
- Create: `src/entities/auth/lib/handoffStore.ts`, `src/app/api/auth/handoff/route.ts`, `src/app/api/auth/handoff/consume/route.ts`, `src/app/ai/[locale]/handoffRedirect.ts`
- Modify: `.env.example`, `infra/aws/check-env.sh`(`OPTIONAL_KEYS`)
- Test: `src/entities/auth/__tests__/lib/handoffStore.test.ts`, `src/app/api/auth/handoff/__tests__/{route,consume}.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/entities/auth/__tests__/lib/handoffStore.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { redis } = vi.hoisted(() => ({ redis: { set: vi.fn(), getdel: vi.fn() } }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => redis }));
import { consumeHandoffCode, issueHandoffCode } from '@/entities/auth/lib/handoffStore';
describe('handoffStore', () => {
    beforeEach(() => vi.clearAllMocks());
    it('issue는 64자 hex 코드, TTL 60초, next는 경로만 저장', async () => {
        redis.set.mockResolvedValue('OK');
        const code = await issueHandoffCode({ userId: 'u1', next: 'https://evil.com/x' });
        expect(code).toMatch(/^[0-9a-f]{64}$/);
        expect(redis.set).toHaveBeenCalledWith(`auth:handoff:${code}`, JSON.stringify({ userId: 'u1', next: '/' }), { ex: 60 });
    });
    it('consume은 getdel 1회, 없으면 null, 깨진 JSON도 null', async () => {
        redis.getdel.mockResolvedValueOnce(JSON.stringify({ userId: 'u1', next: '/c/abc' }));
        expect(await consumeHandoffCode('a'.repeat(64))).toEqual({ userId: 'u1', next: '/c/abc' });
        redis.getdel.mockResolvedValueOnce(null);
        expect(await consumeHandoffCode('a'.repeat(64))).toBeNull();
        redis.getdel.mockResolvedValueOnce('{bad');
        expect(await consumeHandoffCode('a'.repeat(64))).toBeNull();
    });
    it('형식이 아닌 코드는 Redis를 부르지 않는다', async () => {
        expect(await consumeHandoffCode('short')).toBeNull();
        expect(redis.getdel).not.toHaveBeenCalled();
    });
});
```

```ts
// src/app/api/auth/handoff/__tests__/route.test.ts   (메인 호스트: 발급)
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: vi.fn(), issue: vi.fn() }));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({ getCurrentUser: m.user }));
vi.mock('@/entities/auth/lib/handoffStore', () => ({ issueHandoffCode: m.issue, consumeHandoffCode: vi.fn() }));
vi.mock('@/shared/config/aiHost', () => ({ AI_SITE_URL: 'https://ai.siglens.io', isAiHost: (h: string | null) => h === 'ai.siglens.io' }));
import { GET } from '@/app/api/auth/handoff/route';
const req = (qs: string, host = 'siglens.io') => new Request(`https://${host}/api/auth/handoff${qs}`, { headers: { host } });

describe('GET /api/auth/handoff', () => {
    beforeEach(() => vi.clearAllMocks());
    it('세션 있음 → 코드 발급 → ai consume으로 302', async () => {
        m.user.mockResolvedValue({ id: 'u1' });
        m.issue.mockResolvedValue('c'.repeat(64));
        const res = await GET(req('?to=ai&next=%2Fc%2Fabc'));
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(`https://ai.siglens.io/api/auth/handoff/consume?code=${'c'.repeat(64)}`);
        expect(m.issue).toHaveBeenCalledWith({ userId: 'u1', next: '/c/abc' });
    });
    it('세션 없음 → ai로 ?sso=none', async () => {
        m.user.mockResolvedValue(null);
        const res = await GET(req('?to=ai&next=%2Fc%2Fabc'));
        expect(res.headers.get('location')).toBe('https://ai.siglens.io/c/abc?sso=none');
    });
    it('to가 ai가 아니거나 ai 호스트에서 호출 → 400', async () => {
        expect((await GET(req('?to=evil'))).status).toBe(400);
        expect((await GET(req('?to=ai', 'ai.siglens.io'))).status).toBe(400);
    });
});
```

```ts
// src/app/api/auth/handoff/__tests__/consume.test.ts   (ai 호스트: 소비)
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ consume: vi.fn(), createSession: vi.fn() }));
vi.mock('@/entities/auth/lib/handoffStore', () => ({ consumeHandoffCode: m.consume, issueHandoffCode: vi.fn() }));
vi.mock('@/entities/auth/lib/sessionCookie', async importOriginal => ({ ...(await importOriginal<object>()), createAuthSession: m.createSession }));
vi.mock('@/entities/auth/lib/db', () => ({ getAuthDatabaseClient: () => ({ db: {} }) }));
vi.mock('@/entities/auth/api', () => ({ DrizzleSessionRepository: vi.fn() }));
vi.mock('@/shared/config/aiHost', () => ({ AI_SITE_URL: 'https://ai.siglens.io', isAiHost: (h: string | null) => h === 'ai.siglens.io' }));
import { GET } from '@/app/api/auth/handoff/consume/route';
const req = (qs: string, host = 'ai.siglens.io') => new Request(`https://${host}/api/auth/handoff/consume${qs}`, { headers: { host } });

describe('GET /api/auth/handoff/consume', () => {
    beforeEach(() => vi.clearAllMocks());
    it('유효 코드 → 세션 생성 → host-only 쿠키 → next로 302', async () => {
        m.consume.mockResolvedValue({ userId: 'u1', next: '/c/abc' });
        m.createSession.mockResolvedValue({ session: { id: 'tok' }, cookie: { name: 'siglens_session', value: 'tok', httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: new Date(Date.now() + 1000), maxAgeSeconds: 1000 } });
        const res = await GET(req('?code=' + 'c'.repeat(64)));
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('https://ai.siglens.io/c/abc');
        const cookie = res.headers.get('set-cookie') ?? '';
        expect(cookie).toContain('siglens_session=tok');
        expect(cookie.toLowerCase()).not.toContain('domain=');
        expect(m.createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    });
    it('무효 코드 → ?sso=none', async () => {
        m.consume.mockResolvedValue(null);
        expect((await GET(req('?code=' + 'c'.repeat(64)))).headers.get('location')).toBe('https://ai.siglens.io/?sso=none');
    });
    it('메인 호스트에서 호출 → 400', async () => {
        expect((await GET(req('?code=x', 'siglens.io'))).status).toBe(400);
    });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현**

```ts
// src/entities/auth/lib/handoffStore.ts
import 'server-only';
import { randomBytes } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

export const HANDOFF_TTL_SECONDS = 60;
const CODE_RE = /^[0-9a-f]{64}$/;
export interface HandoffPayload { userId: string; next: string }

/** One-time SSO code (spec §9-4). Same Redis getdel pattern as `pendingOAuthSignupStore`. */
export async function issueHandoffCode(input: HandoffPayload): Promise<string> {
    const redis = getRedisClient();
    if (redis === null) throw new Error('[handoff] redis unavailable');
    const code = randomBytes(32).toString('hex');
    const payload: HandoffPayload = { userId: input.userId, next: sanitizeNextPath(input.next) };
    const ok = await redis.set(`auth:handoff:${code}`, JSON.stringify(payload), { ex: HANDOFF_TTL_SECONDS });
    if (ok !== 'OK') throw new Error('[handoff] code not stored');
    return code;
}

export async function consumeHandoffCode(code: string): Promise<HandoffPayload | null> {
    if (!CODE_RE.test(code)) return null;
    const redis = getRedisClient();
    if (redis === null) return null;
    const raw = await redis.getdel<string>(`auth:handoff:${code}`);
    if (!raw) return null;
    try {
        const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<HandoffPayload>;
        return typeof parsed.userId === 'string' && typeof parsed.next === 'string' ? { userId: parsed.userId, next: sanitizeNextPath(parsed.next) } : null;
    } catch {
        return null;
    }
}
```

```ts
// src/app/api/auth/handoff/route.ts   (MAIN host only: issue a code for the signed-in user)
import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { issueHandoffCode } from '@/entities/auth/lib/handoffStore';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

export const dynamic = 'force-dynamic';

/** `to` is an enum, never a URL — the only target host is the `AI_SITE_URL` constant (spec §8). */
export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (isAiHost(request.headers.get('host')) || url.searchParams.get('to') !== 'ai') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    const next = sanitizeNextPath(url.searchParams.get('next'));
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(`${AI_SITE_URL}${next}${next.includes('?') ? '&' : '?'}sso=none`, 302);
    const code = await issueHandoffCode({ userId: user.id, next });
    return NextResponse.redirect(`${AI_SITE_URL}/api/auth/handoff/consume?code=${code}`, 302);
}
```

```ts
// src/app/api/auth/handoff/consume/route.ts   (AI host only: exchange the code for a host-only session)
import 'server-only';
import { NextResponse } from 'next/server';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { consumeHandoffCode } from '@/entities/auth/lib/handoffStore';
import { createAuthSession } from '@/entities/auth/lib/sessionCookie';
import { AI_SITE_URL, isAiHost } from '@/shared/config/aiHost';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    if (!isAiHost(request.headers.get('host'))) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    const payload = await consumeHandoffCode(new URL(request.url).searchParams.get('code') ?? '');
    if (payload === null) return NextResponse.redirect(`${AI_SITE_URL}/?sso=none`, 302);
    const { cookie } = await createAuthSession({ userId: payload.userId, sessions: new DrizzleSessionRepository(getAuthDatabaseClient().db), now: new Date(), secureCookie: AI_SITE_URL.startsWith('https://') });
    const response = NextResponse.redirect(`${AI_SITE_URL}${payload.next}`, 302);
    response.cookies.set(applyAuthCookie(cookie));
    return response;
}
```

`src/app/ai/[locale]/handoffRedirect.ts`: Task 11 Step 7의 `maybeHandoffRedirect`를 이 파일로 옮기고 두 페이지가 import한다.

`.env.example`에 추가:

```
# ── SiglensAI (ai.siglens.io) ─────────────────────────────────────────────
# ai 호스트 절대 URL. SSO 핸드오프 대상과 메인→ai 301에 쓴다. 로컬은 http://ai.localhost:3000
# (OPTIONAL_KEYS — 없으면 기본값 https://ai.siglens.io)
AI_SITE_URL=
NEXT_PUBLIC_AI_SITE_URL=
# Brave Search API 키. 없으면 web_search 툴이 카탈로그에서 빠진다(OPTIONAL_KEYS).
BRAVE_SEARCH_API_KEY=
# 킬 스위치. 1이면 /api/ai/chat/stream이 503, 페이지는 점검 안내(OPTIONAL_KEYS).
AGENT_CHAT_DISABLED=
```

`check-env.sh`의 `OPTIONAL_KEYS=(` 배열에 `AI_SITE_URL NEXT_PUBLIC_AI_SITE_URL BRAVE_SEARCH_API_KEY AGENT_CHAT_DISABLED` 추가. `createAuthSession`의 `secureCookie`는 로컬(`http://ai.localhost`)에서 `false`가 되어야 쿠키가 심긴다 — 위 코드가 `AI_SITE_URL` 스킴으로 결정한다.

- [ ] **Step 4: 통과 확인** — `yarn test src/entities/auth src/app/api/auth src/app/ai && yarn typecheck` → PASS.

- [ ] **Step 5: 실기동(Task 11 Step 10 재확인)** — 메인 `localhost:3000`에서 로그인 → `ai.localhost:3000/` 접속 → 자동으로 `/api/auth/handoff` 경유 → ai 쿠키 세팅 → 대화 화면. 로그아웃(ai 헤더) → ai만 로그아웃, 메인은 유지.

- [ ] **Step 6: Commit** — `feat(auth): ai.siglens.io SSO 핸드오프(1회용 코드, host-only 세션) + env 등록`

---

### Task 13 (P2): `run_fresh_analysis`·`web_search` 실행기

**Files:** Create `src/app/api/ai/chat/tools/runFreshAnalysis.ts`, `webSearch.ts`; Modify `tools/index.ts`; Test `tools/__tests__/{runFreshAnalysis,webSearch}.test.ts`

- [ ] **Step 1: 테스트**

```ts
// src/app/api/ai/chat/tools/__tests__/webSearch.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webSearchTool } from '@/app/api/ai/chat/tools/webSearch';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
afterEach(() => vi.restoreAllMocks());
describe('webSearchTool', () => {
    it('Brave에 q·count·freshness·search_lang, 상위 5건 스니펫', async () => {
        process.env.BRAVE_SEARCH_API_KEY = 'b';
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ web: { results: Array.from({ length: 8 }, (_, i) => ({ title: `t${i}`, url: `https://x/${i}`, description: `d${i}`, age: '1 day ago' })) } }));
        const r = (await webSearchTool({ query: 'Apple earnings', freshness: 'week' }, ctx, rt)) as { results: unknown[] };
        const url = new URL(String(fetchMock.mock.calls[0]![0]));
        expect(url.origin + url.pathname).toBe('https://api.search.brave.com/res/v1/web/search');
        expect(url.searchParams.get('q')).toBe('Apple earnings');
        expect(url.searchParams.get('count')).toBe('5');
        expect(url.searchParams.get('freshness')).toBe('pw');
        expect(url.searchParams.get('search_lang')).toBe('ko');
        expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'X-Subscription-Token': 'b' });
        expect(r.results).toHaveLength(5);
        expect(r.results[0]).toEqual({ title: 't0', url: 'https://x/0', snippet: 'd0', age: '1 day ago' });
    });
    it('비 2xx → search_failed', async () => {
        process.env.BRAVE_SEARCH_API_KEY = 'b';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 429 }));
        expect(await webSearchTool({ query: 'q' }, ctx, rt)).toEqual({ error: 'search_failed', status: 429 });
    });
});
```

```ts
// src/app/api/ai/chat/tools/__tests__/runFreshAnalysis.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ runAnalysis: vi.fn(), overall: vi.fn(), news: vi.fn(), options: vi.fn(), profile: vi.fn(async () => 'us-equity'), assetInfo: vi.fn(async () => ({ name: 'Apple', fmpSymbol: 'AAPL' })) }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({ ...(await importOriginal<object>()), runAnalysis: m.runAnalysis }));
vi.mock('@/entities/analysis/actions', () => ({ runOverallAnalysisAction: m.overall }));
vi.mock('@/entities/news-article/actions', () => ({ submitNewsAnalysisAction: m.news }));
vi.mock('@/entities/options-chain/actions', () => ({ submitOptionsAnalysisAction: m.options }));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({ resolveMarketProfile: m.profile }));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({ getAssetInfo: m.assetInfo }));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({ getCachedMarketDataProvider: () => ({}) }));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: () => ({}) }));
vi.mock('@/shared/config/marketProfile', () => ({ getDescriptor: () => ({ assetClass: 'equity', priceFormat: { currency: 'USD' } }) }));
import { __resetFreshSemaphoreForTests, runFreshAnalysisTool } from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { __activeStreamCount, __resetActiveStreamsForTests } from '@/shared/lib/sse/activeStreams';
const ctx = { userId: 'u', tier: 'member' as const, locale: 'ko' as const, signal: new AbortController().signal };
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('runFreshAnalysisTool', () => {
    beforeEach(() => { vi.clearAllMocks(); __resetFreshSemaphoreForTests(); __resetActiveStreamsForTests(); });
    it('technical: core runAnalysis(모델·tier·locale, signal 없음), 슬롯 해제', async () => {
        m.runAnalysis.mockResolvedValue({ status: 'done', result: { summary: 's', trend: 'bullish' } });
        const r = await runFreshAnalysisTool({ symbol: 'AAPL', kind: 'technical' }, ctx, rt);
        expect(r).toMatchObject({ found: true, source: 'fresh', tab: 'technical', analysis: { summary: 's' } });
        const [symbol, companyName, timeframe, force, fmpSymbol, options] = m.runAnalysis.mock.calls[0]!;
        expect([symbol, companyName, timeframe, force, fmpSymbol]).toEqual(['AAPL', 'Apple', '1Day', false, 'AAPL']);
        expect(options).toMatchObject({ modelId: 'deepseek-v4.1-flash', tierContext: { userId: 'u', tier: 'member' }, locale: 'ko', reasoning: false });
        expect(options.signal).toBeUndefined();
        expect(__activeStreamCount()).toBe(0);
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
/** Snippets only — no page-fetch tool (spec §8). */
export const webSearchTool: ToolExecutor = async (args, ctx) => {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) return { error: 'search_unavailable' };
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', String(args.query));
    url.searchParams.set('count', String(COUNT));
    url.searchParams.set('search_lang', ctx.locale === 'ko' ? 'ko' : 'en');
    if (typeof args.freshness === 'string' && FRESHNESS[args.freshness]) url.searchParams.set('freshness', FRESHNESS[args.freshness]!);
    const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(TIMEOUT_MS)]) });
    if (!response.ok) return { error: 'search_failed', status: response.status };
    const payload = (await response.json()) as { web?: { results?: BraveResult[] } };
    return { asOf: new Date().toISOString(), source: 'Brave Search', results: (payload.web?.results ?? []).slice(0, COUNT).map(r => ({ title: r.title, url: r.url, snippet: r.description ?? '', age: r.age ?? null })) };
};
```

```ts
// src/app/api/ai/chat/tools/runFreshAnalysis.ts
import 'server-only';
import { runAnalysis, type SubmitAnalysisOptions, type Timeframe } from '@y0ngha/siglens-core';
import { runOverallAnalysisAction } from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { registerActiveStream } from '@/shared/lib/sse/activeStreams';
import type { ToolExecutor } from './index';

/** Per-instance semaphore (spec §4-5). */
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
 * shares the promise with prewarm/symbol-page callers (spec §6-3). Holds one
 * activeStreams slot for its duration.
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
                const options: SubmitAnalysisOptions = { modelId: runtime.analysisModel, marketDataProvider: getCachedMarketDataProvider(sessionSpecFor(profile)), assetClass: descriptor.assetClass, currency: descriptor.priceFormat.currency, tierContext: { userId: ctx.userId, tier: ctx.tier }, reasoning: false, locale: ctx.locale, skipEnqueueIfMiss: false };
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

`tools/index.ts`의 `EXECUTORS`에 `run_fresh_analysis: runFreshAnalysisTool, web_search: webSearchTool` 추가, Task 13 주석 삭제. `index.test.ts` 가용 툴 기대값을 8종(+키 있으면 `web_search`)으로 갱신.

- [ ] **Step 4: 통과** — `yarn test src/app/api/ai/chat/tools && yarn typecheck && yarn lint` → PASS.
- [ ] **Step 5: Commit** — `feat(api/ai): run_fresh_analysis(세마포어·activeStreams 슬롯)·web_search(Brave) 실행기`

---

### Task 14 (P2): `[Usage]` JSON·알람·킬 스위치 런북·개인정보 고지·문서

**Files:** Modify `src/entities/llm-provider/lib/usage.ts`(`logUsage`) + 기존 usage 테스트, `infra/aws/07-alarms.sh`, `docs/architecture/DEPLOY_RUNBOOK.md`, `docs/reference/API.md`, `docs/architecture/ARCHITECTURE.md`, `/privacy` 본문(`ls src/app/[locale]/privacy`로 파일 확인) + 4개 로케일 카탈로그

- [ ] **Step 1: `[Usage]`를 순수 JSON으로** — `logUsage`를

```ts
export function logUsage(fields: UsageLogFields): void {
    console.info(JSON.stringify({ tag: '[Usage]', ...fields }));
}
```

로 바꾸고 기존 usage 테스트의 기대값(`console.info('[Usage]', json)` 형태)을 `JSON.parse(call[0]).tag === '[Usage]'`로 갱신. Insights의 `like /\[Usage\]/` 쿼리는 `tag` 값 때문에 계속 매치된다(메모리 `feedback_cloudwatch_count_use_insights` 쿼리 무변경). core 쪽 `[Usage]` 라인(분석 경로)은 별도 형식이므로 이 알람은 에이전트만 센다 — 의도.

- [ ] **Step 2: 알람 3개** — `07-alarms.sh`의 `analysis-stream-failed` 블록 뒤에:

```bash
# SiglensAI 에이전트 턴 실패 — 1시간 10건 초과. 마커는 agentEventStream.ts의 '[agent-stream] failed:'.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-stream-failed \
  --filter-pattern '"[agent-stream] failed"' \
  --metric-transformations metricName=AgentStreamFailed,metricNamespace=Siglens/Agent,metricValue=1,defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-stream-failed --namespace Siglens/Agent \
  --metric-name AgentStreamFailed --statistic Sum --period 3600 --evaluation-periods 1 --threshold 10 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# 에이전트 한도 스토어(Redis) 불가 — core createCounterStore가 closed 정책 실패 시 찍는 마커. fail-closed라 사용자에겐 server_busy.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-quota-store-unavailable \
  --filter-pattern '"[agent] quota store unavailable"' \
  --metric-transformations metricName=AgentQuotaStoreUnavailable,metricNamespace=Siglens/Agent,metricValue=1,defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-quota-store-unavailable --namespace Siglens/Agent \
  --metric-name AgentQuotaStoreUnavailable --statistic Sum --period 3600 --evaluation-periods 1 --threshold 3 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
# 에이전트 출력 토큰 일 1M 초과(기본 모델 200턴의 ~5배). [Usage]가 순수 JSON({tag:"[Usage]",jobId:"agent",...})이라 JSON 필터가 매치한다.
aws logs put-metric-filter --log-group-name /siglens/app \
  --filter-name siglens-agent-output-tokens \
  --filter-pattern '{ $.tag = "[Usage]" && $.jobId = "agent" }' \
  --metric-transformations metricName=AgentOutputTokens,metricNamespace=Siglens/Agent,metricValue='$.outputTokens',defaultValue=0
aws cloudwatch put-metric-alarm --alarm-name siglens-agent-output-tokens-daily --namespace Siglens/Agent \
  --metric-name AgentOutputTokens --statistic Sum --period 86400 --evaluation-periods 1 --threshold 1000000 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $P1
```

- [ ] **Step 3: 런북 절** — DEPLOY_RUNBOOK.md에:

```
## SiglensAI(ai.siglens.io) 에이전트 챗
- 킬 스위치: SSM `/siglens/AGENT_CHAT_DISABLED=1` → 인스턴스 env 리프레시(ISR_CACHE_DISABLED와 같은 경로) → /api/ai/chat/stream 503, 페이지는 점검 안내. 해제는 값 0.
- 알람: siglens-agent-stream-failed(1h 10건) · siglens-agent-quota-store-unavailable(1h 3건) · siglens-agent-output-tokens-daily(1M)
- 진단 순서: [Agent] 라인(턴당 1건: steps·toolCalls[{name,ms,status}]·ms·stopReason) → [Usage] jobId agent → [agent-stream] failed 앞뒤 로그
- SSO: ai 호스트 세션 없음 → siglens.io/api/auth/handoff → 60초 1회용 코드 → ai consume. 코드 오류는 ?sso=none 랜딩. Redis 장애 시 핸드오프 불가(로그인 CTA만)
- Cloudflare: Public Hostname ai.siglens.io(터널) · Rate Limiting /api/ai/* 10초 10요청
- 롤백: 테이블만 추가라 마이그레이션 되돌림 불필요. hostname은 코드 롤백에 안 따라오므로 구 빌드는 ai 호스트에 메인 사이트를 보여준다(무해)
```

- [ ] **Step 4: 개인정보 고지** — `/privacy`에 항목 추가(4 로케일): "SiglensAI(ai.siglens.io) 대화 기능에서 입력한 메시지, 조회된 시장 데이터, 회원이 등록한 보유 종목 정보는 답변 생성을 위해 DeepSeek(중국)에 전송됩니다. 대화는 계정에 저장되며 대화 목록에서 삭제할 수 있습니다." + 개정일. `yarn i18n:translate` → `i18n:verify`.

- [ ] **Step 5: API.md·ARCHITECTURE.md** — env 4종(`AI_SITE_URL`, `NEXT_PUBLIC_AI_SITE_URL`, `BRAVE_SEARCH_API_KEY`, `AGENT_CHAT_DISABLED`), 엔드포인트 `POST /api/ai/chat/stream`(스펙 §6-3 요약), `GET /api/auth/handoff`·`/consume`, 라우트 트리 `app/ai/[locale]`.

- [ ] **Step 6: 통과** — `yarn test src/entities/llm-provider && yarn i18n:verify` → PASS.
- [ ] **Step 7: Commit** — `chore(ops): 에이전트 알람·[Usage] JSON·킬 스위치 런북·개인정보 고지·API 문서`

---

### Task 15: e2e·리뷰·Cloudflare·배포·실증

**Files:** Create `e2e/specs/agent-chat.spec.ts`; Modify e2e env(`docker-compose.e2e.yml`/`e2e/run-e2e.sh`에 `AI_SITE_URL=http://ai.localhost:4300 NEXT_PUBLIC_AI_SITE_URL=http://ai.localhost:4300`), `playwright.config.ts`(project `ai` with `baseURL: 'http://ai.localhost:4300'`)

- [ ] **Step 1: e2e 스펙**

```ts
// e2e/specs/agent-chat.spec.ts
import { test, expect } from '../support/fixtures';
import { AUTH_STORAGE_STATE } from '../support/authUser';

const AI = 'http://ai.localhost:4300';
const MAIN = 'http://localhost:4300';

test.describe('SiglensAI agent chat', () => {
    test.use({ storageState: AUTH_STORAGE_STATE }); // main-host session only

    test('메인 로그인 세션이 ai 호스트로 SSO 핸드오프되고, 대화·툴·저장·재생성이 동작한다', async ({ page }) => {
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(new RegExp(`^${AI}/(ko/)?$`)); // handoff round-trip completed
        await expect(page.getByRole('heading', { name: /SiglensAI/ })).toBeVisible();
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

    test('비로그인: ?sso=none 랜딩과 로그인 CTA, 스트림 401', async ({ browser }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(/sso=none/);
        const cta = page.getByRole('link', { name: /siglens 계정으로 로그인/ });
        await expect(cta).toHaveAttribute('href', /localhost:4300\/(ko\/)?login\?next=/);
        const res = await context.request.post(`${AI}/api/ai/chat/stream`, { data: { message: 'x' } });
        expect(res.status()).toBe(401);
        await context.close();
    });

    test('메인 호스트 /ai 는 ai 호스트로 301', async ({ request }) => {
        const res = await request.get(`${MAIN}/ai/ko`, { maxRedirects: 0 });
        expect(res.status()).toBe(301);
        expect(res.headers().location).toBe(`${AI}/ko`);
    });
});
```

`*.localhost`는 브라우저·Node 모두 루프백으로 해석하므로 DNS 설정 불필요. `AUTH_STORAGE_STATE`의 쿠키는 `localhost` 도메인이라 `ai.localhost`엔 전송되지 않는다 — 첫 테스트가 바로 핸드오프 경로를 검증한다.

Run: `yarn e2e` → 3 tests PASS (compose 고아 프로세스 주의).

- [ ] **Step 2: 전체 게이트** — `yarn typecheck && yarn lint && yarn test` → PASS, 커버리지 90%. 실패 시 실패 파일만 반복.

- [ ] **Step 3: review-agent → mistake-managing-agent → git-agent(PR)** — CLAUDE.md 라우팅. PR CI(ci·e2e-required) 초록, claude-review 코멘트 반영(재트리거는 Draft 토글).

- [ ] **Step 4: Cloudflare·SSM (사용자 수동, 태그 전)**

1. Zero Trust → Tunnels → siglens 터널 → Public Hostname `ai.siglens.io` → `http://localhost:3000`. **HTTP Host Header를 덮어쓰지 않는다**(Origin Request 설정의 `httpHostHeader` 비움) — 프록시가 `Host: ai.siglens.io`로 분기하므로 `localhost:3000`으로 바뀌면 ai 요청이 메인 사이트로 떨어진다. DNS의 `ai` CNAME은 터널이 자동 생성(Proxied).
2. Security → WAF → Rate limiting rules: `/api/ai/*` — 10초 10요청 초과 시 Block 10초(무료 플랜 규칙 1개).
3. `bash infra/aws/04-params.sh <env-file>`로 `BRAVE_SEARCH_API_KEY`(선택, 없으면 web_search 툴 비노출) 등록. `AGENT_CHAT_DISABLED`는 등록하지 않는다(킬 스위치, 평시 미설정). `AI_SITE_URL`은 Task 12에서 제거됐고, `NEXT_PUBLIC_AI_SITE_URL`은 빌드 시점 인라인이라 SSM 런타임 값은 무효 — 코드 기본값 `https://ai.siglens.io`가 운영값이므로 Dockerfile·deploy.yml 빌드 인자 추가도 불필요(도메인을 바꿀 때만 `--build-arg` 추가). `bash infra/aws/07-alarms.sh`.
4. OAuth 콘솔 변경 없음(로그인은 메인 호스트에서만 일어나고 ai는 핸드오프로 세션을 받는다).

- [ ] **Step 5: 배포** — 머지 후 사용자 확인 하에 `yarn db:migrate`(대상 로그로 운영 Neon 확인) → `yarn release`. 배포 후:

```bash
curl -sI https://ai.siglens.io/ | grep -iE 'content-security-policy|x-robots-tag|location'   # img-src / noindex / (세션 없으면 302 handoff)
curl -s https://ai.siglens.io/robots.txt                                                        # Disallow: /
curl -sI https://siglens.io/robots.txt | head -1                                                # 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://siglens.io/ai/ko              # 301 https://ai.siglens.io/ko
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: ai.siglens.io' https://ai.siglens.io/api/sitemap  # 404
```

- [ ] **Step 6: 실증(Chrome)** — 메모리 규칙(전면 탭, SW 옛 빌드 주의): siglens.io 로그인 → ai.siglens.io 진입 시 자동 SSO → 4턴(내 보유 종목·시세·캐시 분석·신선 분석 자동 실행 진행 표시) → 새로고침 복원 → 재생성·수정 → ai 로그아웃 후 메인 세션 유지 확인 → 다른 계정으로 대화 URL 404 → Rate Limiting(10초 11요청 curl) 블록 확인 → CloudWatch `[Agent]`·`{tag:"[Usage]",jobId:"agent"}` 확인. 결과를 스펙 §16에 "검증 완료" 표기.

---

## Self-review (spec v2.2 ↔ plan)

- R1 호스트: Task 1·3·11 ✓. R2 캐시 분석(`{result}` 읽기·positionBucket): Task 9 ✓. R3 툴·검색: Task 9·13 ✓. R4 자동 신선 분석: Plan A Task 10 + Task 13 ✓. R5 뉴스(sentinel·localized·since/query/body)·옵션 ✓. R6 저장·재개·이력 규칙(send 전체/regenerate 마지막 user 제외): Task 6·10 ✓. R7 알람·킬 스위치·전역 검색 상한 ✓. R8 ✓. **R9 포트폴리오**: Task 9 `get_my_portfolio` + Task 10 `portfolioSymbols` 주입 ✓. **R10 SSO**: Task 12 핸드오프 + Task 11 랜딩 자동 리다이렉트 + Task 15 e2e ✓. **R11 SiglensAI·siglens 톤**: Task 11(AiHeader 워드마크·h-14·토큰) ✓. **R12 DeepSeek flash 고정·추론 OFF·모델 UI 없음**: Task 5 라우터 `AGENT_MODEL`, Task 10 `parseBody`가 model 무시, Task 11 ModelSelect 없음 ✓.
- 교차 검토 13건: M1 단일 INSERT…SELECT(Task 6) ✓ · M2 이력 slice(Task 10 + 테스트) ✓ · M3 `cached.result`(Task 9) ✓ · M4 sentinel(Task 9) ✓ · M5 proxy.test headers(Task 3) ✓ · M6 ModelSelect 제거(R12) ✓ · M7 `isHistoryTab` 좁히기 ✓ · M8 quota store 마커(Plan A Task 8 + Task 14 필터) ✓ · M9 `[Usage]` JSON 명시 단계(Task 14) ✓ · M10 writer `AgentTurnError`(Task 10) ✓ · M11 localized 제목 ✓ · M12/M13 Anthropic·provider 축은 P3로 이동 ✓ · sitemap 404(Task 3) ✓ · §16-4 재프로브는 파일럿 무관 ✓.
- 타입 일관성: `ToolExecutor(args, ctx, runtime)` ↔ core `ExecuteTool(name, args, ctx)`는 `createToolExecutor` 어댑터 ✓. `AgentCounters` 6키 ✓. `RunAgentTurnParams.portfolioSymbols` — Plan A Task 10에 추가됨 ✓. SSE 프레임(writer ↔ 훅): meta/text/tool_start/tool_end/done/error 필드 일치 ✓, `usage`는 `{usage:{…}}` 중첩(스펙 §6-3 갱신) ✓. 에러 코드 문구 `ERROR_COPY`(Task 11) ↔ 스펙 §6-3 ✓.
- 의도적 편차(스펙 §17 기록됨): tokenStore 리팩터 생략, i18n 명시 네임스페이스, `clientKeyCoverage` P3.
