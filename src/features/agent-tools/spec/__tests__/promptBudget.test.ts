import { describe, expect, it } from 'vitest';
import { AGENT_TOOL_SPECS, buildAgentSystemPrompt } from './toolSetHarness';

/*
 * core `promptBudget.test.ts`를 옮긴 것이다. 잰 대상이 siglens 모음 전체(관심종목·가격대 알림 도구 포함)라
 * 예산만 다시 쟀고(아래 2026-11-28 줄), 나머지 본문은 그대로다.
 */

/**
 * Size budgets of the agent's static request prefix (ko, guest, all tools).
 *
 * Raising a budget is a deliberate act: change the constant, and add one dated
 * line below saying why. Each budget is the measured size rounded up to the
 * next 500, and a floor (budget - 2,000) makes a stale, too-generous budget
 * visible as well.
 *
 * - 2026-11-20: set after the oscillator-zone, basis-date, per-share, lookup
 *   and turn-note changes (system prompt 52,039 -> 54,071 chars; tool specs
 *   63,757 -> 63,896 chars of JSON; longest description 6,941 -> 7,007).
 * - 2026-11-20 (review round 1): trimmed redundant wording and re-triggered
 *   the overbought/oversold rule; budgets are now the measured size plus a
 *   small slack (system prompt 54,193, tool specs 63,891, longest
 *   description 7,002).
 * - 2026-11-20 (A/B follow-up): the per-share exemption names what it covers
 *   and the "## Now" pointer bans converting zones (system prompt 54,193 ->
 *   54,452; tool specs unchanged).
 * - 2026-11-21 (WP-08 core-2): computed-fact fields (earnings tally, put/call
 *   reading, level ladder, news session and priceMoves) and the `holder`
 *   lookup are described, the level rule is rewritten and a news-causality
 *   rule is added (system prompt 54,452 -> 55,576 chars; tool specs
 *   63,891 -> 65,879 chars of JSON; longest description stays
 *   `get_fundamentals`, 6,941 -> 7,127, still under its 7,150 limit).
 * - 2026-11-21 (WP-08 review round 1): clearer news-causality, ladder and
 *   holder wording (system prompt 55,576 -> 55,861; tool specs 65,879 ->
 *   66,046; longest description `get_fundamentals` 7,127 -> 7,191, so its
 *   limit goes 7,150 -> 7,500 and the tool specs budget 66,000 -> 66,500).
 * - 2026-11-21 (WP-09 core-2): the `get_price_stats` tool, its routing row
 *   with the swings and index tails, the chart and index mirror sentences, the
 *   guest-line clause and the computed-figures field list (system prompt
 *   55,861 -> 57,798 chars; tool specs 66,104 -> 71,615 chars of JSON; longest description `get_bars_indicators` 7,002 -> 7,262, above `get_fundamentals` 7,191).
 * - 2026-11-21 (WP-09 core-3): the null-handling clauses of
 *   `get_bars_indicators` and `get_fundamentals` moved into result notes
 *   (`resultNotes.ts`) and the system prompt gained one `notes` rule (system
 *   prompt 57,798 -> 57,990 chars; tool specs 71,741 -> 69,870 chars of JSON;
 *   `get_bars_indicators` 7,262 -> 6,671, `get_fundamentals` 7,191 -> 5,911, so
 *   the longest description is now `get_bars_indicators` at 6,671 and its limit
 *   goes 7,500 -> 7,000; the tool specs budget goes 72,000 -> 70,000).
 * - 2026-11-21 (WP-09 core-3 review round 1): the notes rule now says when to follow a
 *   note (question-conditioned) and the pullback clause names the short-history
 *   case, so the system prompt budget goes 58,000 -> 58,500. The owner prefers
 *   raising a budget to cutting routing text. Measured after the fixes: ko guest
 *   58,218, en guest 58,727; tool specs 69,987. Both budgets get one 500-char step
 *   of headroom (system 59,000, tool specs 70,500) so the next small edit is a
 *   deliberate budget decision, not a forced trim.
 * - 2026-11-21 (WP-09 core-3 review round 2): the pullback clause names `range.bars`,
 *   the daily-only note and the notes rule were reworded; measured ko guest 58,297,
 *   en guest 58,806, tool specs 70,017, `get_bars_indicators` 6,818 (budgets unchanged).
 * - 2026-11-22 (WP-30 core-1): the `web_search` description names `excerpt`,
 *   `excerptStatus` and the third-party-text rule, and the `get_fundamentals`
 *   `sharesBasis` sentence became the `valuation.basis` sentence; the system
 *   prompt is unchanged. Tool specs 70,017 -> 71,091 chars of JSON, so the tool
 *   specs budget goes 70,500 -> 71,500; the longest description is unchanged.
 * - 2026-11-28 (WP-23 app-4, siglens): the budgets moved with the tool text into
 *   siglens and are now measured on the siglens tool set, which adds
 *   `get_my_watchlist` and `propose_price_alert` to core's 24 tools (same bytes
 *   as the agent saw before the move). Measured: ko guest 59,063 (core's 24
 *   tools alone 58,580), en guest 59,572; tool specs 74,462 chars of JSON (core's
 *   24 alone 71,091); longest description `get_bars_indicators` 6,818. System
 *   prompt budget 59,000 -> 59,500, tool specs budget 71,500 -> 74,500; the
 *   description limit is unchanged.
 */
const SYSTEM_PROMPT_CHAR_BUDGET = 59_500;
const TOOL_SPECS_JSON_CHAR_BUDGET = 74_500;
const TOOL_DESCRIPTION_MAX_CHARS = 7_000;
const FLOOR_SLACK = 2_000;

const guestPrompt = (
    tools: readonly (typeof AGENT_TOOL_SPECS)[number][] = AGENT_TOOL_SPECS
): string => buildAgentSystemPrompt({ locale: 'ko', tools, guest: true });

describe('agent prompt size budgets', () => {
    const systemChars = guestPrompt().length;
    const toolSpecsChars = JSON.stringify(AGENT_TOOL_SPECS).length;
    const longestDescription = Math.max(
        ...AGENT_TOOL_SPECS.map(t => t.description.length)
    );

    it('system prompt stays within its budget', () => {
        expect(systemChars).toBeLessThanOrEqual(SYSTEM_PROMPT_CHAR_BUDGET);
        expect(systemChars).toBeGreaterThan(
            SYSTEM_PROMPT_CHAR_BUDGET - FLOOR_SLACK
        );
    });

    it('tool specs stay within their budget', () => {
        expect(toolSpecsChars).toBeLessThanOrEqual(TOOL_SPECS_JSON_CHAR_BUDGET);
        expect(toolSpecsChars).toBeGreaterThan(
            TOOL_SPECS_JSON_CHAR_BUDGET - FLOOR_SLACK
        );
    });

    it('no single tool description outgrows its budget', () => {
        expect(longestDescription).toBeLessThanOrEqual(
            TOOL_DESCRIPTION_MAX_CHARS
        );
        expect(longestDescription).toBeGreaterThan(
            TOOL_DESCRIPTION_MAX_CHARS - FLOOR_SLACK
        );
    });
});

describe('tool names in the rendered system prompt', () => {
    const TOOL_NAME_RE = /\b(?:get|run|show|search|web|propose)_[a-z_]+\b/g;
    const specNames = new Set(AGENT_TOOL_SPECS.map(t => t.name));

    it('every tool-shaped name is a spec name', () => {
        const mentioned = new Set(guestPrompt().match(TOOL_NAME_RE) ?? []);
        const unknown = [...mentioned].filter(name => !specNames.has(name));
        expect(unknown).toEqual([]);
    });

    /**
     * Lines (by their opening words) that still name a tool the model may not
     * have this turn. Known gaps, kept explicit so a NEW leak fails the test:
     * each entry is `<removed tool>: <line start>`.
     */
    const KNOWN_UNGATED = [
        // The "Never write internal tool names" list is a ban, not a route.
        'get_quote: - Never write internal tool names',
        'get_news: - Never write internal tool names',
        'run_fresh_analysis: - Never write internal tool names',
        // The watchlist row (siglens, before WP-23) points holdings questions at
        // get_my_portfolio and requires only get_my_watchlist; the alert row names
        // the analysis tools and requires only propose_price_alert. Kept byte for
        // byte in the move; gating them is a tool-text change of its own.
        'get_my_portfolio: - The user asks about their watchlist',
        'get_cached_analysis: - The user asks to be alerted',
        'run_fresh_analysis: - The user asks to be alerted',
    ];

    it.each([...specNames])(
        'rendering without %s leaves no routing row or rule that names it',
        removed => {
            const prompt = guestPrompt(
                AGENT_TOOL_SPECS.filter(t => t.name !== removed)
            );
            const section = prompt.slice(
                prompt.indexOf('### Which tools to call'),
                prompt.indexOf('## Data boundary')
            );
            const named = new RegExp(`\\b${removed}\\b`);
            const leaks = prompt
                .split('\n')
                .filter(line => named.test(line))
                .filter(line => section.includes(line))
                .map(line => `${removed}: ${line}`)
                .filter(
                    leak => !KNOWN_UNGATED.some(known => leak.startsWith(known))
                );
            expect(leaks).toEqual([]);
        }
    );
});
