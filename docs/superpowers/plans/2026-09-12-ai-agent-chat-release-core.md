# SiglensAI 릴리즈 — core v1.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@y0ngha/siglens-core`에 제안 질문 프롬프트/파서를 추가하고, 에이전트 답변에서 내부 툴 이름이 노출되지 않도록 Output 규칙을 바꾼다.

**Architecture:** `domain/agent/`에 순수 함수만 추가(I/O 없음). 두 프롬프트가 공유하는 언어명·시계 포맷은 `promptShared.ts`로 추출. 공개 API는 `src/index.ts`에서만 노출.

**Tech Stack:** TypeScript, vitest, eslint/prettier. 워크트리 `.claude/worktrees/agent-suggestions`(브랜치 `feat/agent-suggestions`, base `main`).

**Spec:** siglens `docs/superpowers/specs/2026-09-12-ai-agent-chat-release-design.md` §3.

---

### Task C1: promptShared 추출 + Output 규칙 교체

**Files:**
- Create: `src/domain/agent/promptShared.ts`
- Modify: `src/domain/agent/buildAgentSystemPrompt.ts`
- Modify: `src/__tests__/domain/agent/buildAgentSystemPrompt.test.ts`

- [ ] **Step 1: 실패 테스트 추가** — `buildAgentSystemPrompt.test.ts`에:

```ts
it('내부 툴 이름 인용을 금지하고 출처를 서비스 이름으로 부르게 한다', () => {
    expect(prompt).toContain('Never write internal tool names');
    expect(prompt).toContain('siglens quotes / bars & indicators / analysis / news / options / portfolio / web search');
    expect(prompt).not.toContain('source get_quote');
    expect(AGENT_PROMPT_VERSION).toBe('2026-09-12.3');
});
```

- [ ] **Step 2: 실행해 실패 확인** — `yarn test src/__tests__/domain/agent/buildAgentSystemPrompt.test.ts`

- [ ] **Step 3: `promptShared.ts` 작성**

```ts
import type { Locale } from '../i18n/locale'; // 실제 Locale 타입 위치는 buildAgentSystemPrompt.ts의 import를 따른다

export const LANGUAGE_NAME: Record<Locale, string> = {
    ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese',
};

/** `YYYY-MM-DD, HH:MM` in the given zone, independent of locale-pattern quirks across Intl implementations. */
export function formatClock(now: Date, timeZone: string): string { /* buildAgentSystemPrompt.ts에서 그대로 이동 */ }

/** ET·KST 두 줄을 같은 서식으로 — 두 프롬프트가 같은 문장을 쓴다. */
export function formatNowLine(now: Date): string {
    return `ET: ${formatClock(now, 'America/New_York')} · KST: ${formatClock(now, 'Asia/Seoul')}`;
}
```

- [ ] **Step 4: `buildAgentSystemPrompt.ts` 수정** — 로컬 `LANGUAGE_NAME`/`formatClock` 삭제하고 `promptShared`에서 import. `## Output`의 셋째 줄을 아래 두 줄로 교체, 버전 `'2026-09-12.3'`:

```
- Cite the data source and its asOf time in plain words, in the answer language (Korean example: "(출처: siglens 시세, 2026-09-12 08:57 ET 기준)").
- Never write internal tool names (get_quote, get_news, run_fresh_analysis, …) or function-call syntax in the answer. Call them siglens quotes / bars & indicators / analysis / news / options / portfolio / web search, in the answer language.
```

- [ ] **Step 5: 테스트 통과 확인** — 같은 명령. 기존 단언(`ET: 2026-09-12, 11:00 · KST: …`)도 유지돼야 한다.

- [ ] **Step 6: 게이트** — `yarn typecheck && yarn lint && yarn test:related src/domain/agent/buildAgentSystemPrompt.ts src/domain/agent/promptShared.ts`

- [ ] **Step 7: 커밋** — `feat(agent): 답변 출처 표기를 서비스 이름으로 강제하고 프롬프트 공용 헬퍼 추출`

---

### Task C2: buildSuggestionsPrompt + parseSuggestions

**Files:**
- Create: `src/domain/agent/buildSuggestionsPrompt.ts`
- Create: `src/__tests__/domain/agent/buildSuggestionsPrompt.test.ts`
- Modify: `src/index.ts` (value export + type export 두 곳, 기존 agent export 블록 옆)

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import {
    SUGGESTION_COUNT, SUGGESTION_MAX_CHARS, SUGGESTIONS_PROMPT_VERSION,
    buildSuggestionsPrompt, parseSuggestions,
} from '@/domain/agent/buildSuggestionsPrompt';

const NOW = new Date('2026-09-12T15:00:00Z');
const base = {
    locale: 'ko' as const, now: NOW, etSessionStatus: 'open' as const,
    headlines: [
        { title: 'Fed holds rates', category: 'general', publishedAt: new Date('2026-09-12T13:00:00Z') },
        { title: 'NVDA beats estimates', symbol: 'NVDA', publishedAt: new Date('2026-09-12T12:00:00Z') },
    ],
};

describe('buildSuggestionsPrompt', () => {
    it('언어·개수·길이·JSON 배열 규칙을 system에 넣는다', () => {
        const { system } = buildSuggestionsPrompt(base);
        expect(system).toContain('Korean');
        expect(system).toContain(`${SUGGESTION_COUNT}`);
        expect(system).toContain(`${SUGGESTION_MAX_CHARS}`);
        expect(system).toContain('JSON array of strings');
        expect(system).toContain('not investment advice');
        expect(system).toContain(SUGGESTIONS_PROMPT_VERSION);
    });
    it('헤드라인·시각·장 상태를 user에 넣는다', () => {
        const { user } = buildSuggestionsPrompt(base);
        expect(user).toContain('Fed holds rates');
        expect(user).toContain('[NVDA] NVDA beats estimates');
        expect(user).toContain('ET: 2026-09-12, 11:00');
        expect(user).toContain('open');
    });
    it('보유종목이 있으면 그중 2개를 요구하고, 없으면 그 문장이 없다', () => {
        expect(buildSuggestionsPrompt({ ...base, portfolioSymbols: ['AAPL', 'TSLA'] }).user).toContain('AAPL, TSLA');
        expect(buildSuggestionsPrompt({ ...base, portfolioSymbols: ['AAPL'] }).system).toContain('2 of them');
        expect(buildSuggestionsPrompt(base).system).not.toContain('2 of them');
    });
    it('count를 넘기면 그 개수를 쓴다', () => {
        expect(buildSuggestionsPrompt({ ...base, count: 4 }).system).toContain('exactly 4');
    });
});

describe('parseSuggestions', () => {
    it('JSON 배열을 그대로 돌려준다', () => {
        expect(parseSuggestions('["a","b","c"]')).toEqual(['a', 'b', 'c']);
    });
    it('```json 펜스와 앞뒤 문장을 벗겨낸다', () => {
        expect(parseSuggestions('Here:\n```json\n["a","b"]\n```')).toEqual(['a', 'b']);
    });
    it('배열이 아니거나 깨진 JSON이면 빈 배열', () => {
        expect(parseSuggestions('{"a":1}')).toEqual([]);
        expect(parseSuggestions('not json')).toEqual([]);
    });
    it('문자열이 아닌 항목·빈 문자열·길이 초과·중복(대소문자 무시)을 버리고 count까지만', () => {
        const long = 'x'.repeat(SUGGESTION_MAX_CHARS + 1);
        expect(parseSuggestions(`["a", 1, "", " ", "${long}", "A", "b", "c", "d", "e", "f", "g"]`)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });
    it('count/maxChars 옵션', () => {
        expect(parseSuggestions('["abc","de","f"]', { count: 2, maxChars: 2 })).toEqual(['de', 'f']);
    });
});
```

- [ ] **Step 2: 실패 확인** — `yarn test src/__tests__/domain/agent/buildSuggestionsPrompt.test.ts`

- [ ] **Step 3: 구현**

```ts
import type { EtSessionStatus } from '...'; // buildAgentSystemPrompt.ts와 같은 import
import type { Locale } from '...';
import { LANGUAGE_NAME, formatNowLine } from './promptShared';

export interface SuggestionHeadline {
    readonly title: string;
    readonly symbol?: string;
    readonly category?: string;
    readonly publishedAt: Date;
}
export interface BuildSuggestionsPromptInput {
    readonly locale: Locale;
    readonly now: Date;
    readonly etSessionStatus: EtSessionStatus;
    readonly headlines: readonly SuggestionHeadline[];
    readonly portfolioSymbols?: readonly string[];
    readonly count?: number;
}
export interface SuggestionsPrompt { readonly system: string; readonly user: string }

/** Bump whenever either prompt text changes; siglens folds it into the cache key. */
export const SUGGESTIONS_PROMPT_VERSION = '2026-09-12.1';
export const SUGGESTION_COUNT = 6;
export const SUGGESTION_MAX_CHARS = 60;

export function buildSuggestionsPrompt(input: BuildSuggestionsPromptInput): SuggestionsPrompt {
    const count = input.count ?? SUGGESTION_COUNT;
    const language = LANGUAGE_NAME[input.locale];
    const hasPortfolio = (input.portfolioSymbols?.length ?? 0) > 0;
    const system = `You write the suggested first questions shown on the empty screen of the siglens market assistant (ai.siglens.io). siglens is a stock, Korean equity and crypto analysis service; the assistant can fetch quotes, indicators, siglens analyses, news, options and the user's holdings.

Rules:
- Write exactly ${count} questions in ${language}, each a single line of at most ${SUGGESTION_MAX_CHARS} characters, phrased as the user would type them (first person, question or request form).
- Each question must be answerable with siglens data: quotes, indicators (RSI, MACD, moving averages…), siglens analysis, news, options, the user's holdings.
- Cover different topics: at most one question per symbol, at most two about the same headline.
- Prefer what is timely: the headlines and the market session given below.${hasPortfolio ? `\n- The user holds the symbols listed below: make 2 of them about those holdings.` : ''}
- Never quote prices, percentages or other figures. Never give or ask for investment advice (this is information, not investment advice).
- Output ONLY a JSON array of strings. No prose, no markdown fences, no numbering.

Prompt version: ${SUGGESTIONS_PROMPT_VERSION}`;
    const headlineLines = input.headlines.length > 0
        ? input.headlines.map(h => `- ${h.symbol ? `[${h.symbol}] ` : ''}${h.title}${h.category ? ` (${h.category})` : ''}`).join('\n')
        : '- (none)';
    const user = `## Now
- ${formatNowLine(input.now)}
- US regular session: ${input.etSessionStatus}

## Recent headlines
${headlineLines}

## User holdings
${hasPortfolio ? input.portfolioSymbols!.join(', ') : '(none)'}`;
    return { system, user };
}

export function parseSuggestions(raw: string, options: { count?: number; maxChars?: number } = {}): string[] {
    const count = options.count ?? SUGGESTION_COUNT;
    const maxChars = options.maxChars ?? SUGGESTION_MAX_CHARS;
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return [];
    let parsed: unknown;
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return []; }
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
        if (typeof item !== 'string') continue;
        const text = item.trim();
        if (text.length === 0 || text.length > maxChars) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length === count) break;
    }
    return out;
}
```

- [ ] **Step 4: `src/index.ts` export** — 값: `SUGGESTIONS_PROMPT_VERSION, SUGGESTION_COUNT, SUGGESTION_MAX_CHARS, buildSuggestionsPrompt, parseSuggestions`; 타입: `SuggestionHeadline, BuildSuggestionsPromptInput, SuggestionsPrompt`. 기존 `buildAgentSystemPrompt` export 옆에 둔다.

- [ ] **Step 5: 통과 확인 + 게이트** — `yarn typecheck && yarn lint && yarn test:related src/domain/agent/buildSuggestionsPrompt.ts src/index.ts`

- [ ] **Step 6: 커밋** — `feat(agent): 첫 화면 제안 질문 프롬프트·파서 추가`

---

### Task C3: 리뷰·PR·릴리즈

- [ ] 최종 리뷰 서브에이전트(전체 diff) → 수정.
- [ ] `git push -u origin feat/agent-suggestions`, `gh pr create` (제목 `feat(agent): 제안 질문 프롬프트 + 출처 표기 규칙 (v1.2.0)`), CI·claude-review 통과·APPROVED 확인.
- [ ] 머지(일반 merge) → `main`에서 `yarn install` 후 `yarn release:minor`(release-it, v* 태그 push가 GitHub Packages 발행 트리거) → 워크플로 success 후 tarball 실물 확인(`npm view @y0ngha/siglens-core@1.2.0 dist.tarball` + 다운로드 200) → siglens bump.
