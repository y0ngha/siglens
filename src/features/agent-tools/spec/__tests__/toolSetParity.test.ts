import {
    BARS_RESULT_NOTES as CORE_BARS_RESULT_NOTES,
    BUILT_IN_AGENT_TOOL_SET,
    buildAgentSystemPrompt,
    buildAgentTurnContext,
    FUNDAMENTALS_RESULT_NOTES as CORE_FUNDAMENTALS_RESULT_NOTES,
    selectToolSetSpecs,
    type AgentLocale,
    type AgentToolArgs,
    type AgentToolDefinition,
    type AgentToolSet,
} from '@y0ngha/siglens-core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    AGENT_TOOLSET_VERSION,
    SIGLENS_AGENT_TOOL_SET,
} from '@/features/agent-tools/spec/agentToolSet';
import {
    BARS_RESULT_NOTES,
    FUNDAMENTALS_RESULT_NOTES,
} from '@/features/agent-tools/spec/resultNotes';
import {
    WATCHLIST_ALERT_ROUTING_ROWS,
    WATCHLIST_ALERT_TOOLS,
    watchlistAlertRuleLines,
} from '@/features/agent-tools/spec/watchlistAlertTools';
import golden from './golden/toolSetPromptHashes.json';

/**
 * 도구 명세가 core에서 siglens로 옮겨 와도 모델이 보는 바이트가 그대로인지 지키는 게이트.
 *
 * 비교 기준은 두 가지다.
 *
 * 1. **옮기기 전 조합(살아 있는 기준)**: core의 내장 모음(`BUILT_IN_AGENT_TOOL_SET`)에 관심종목·가격대 알림 도구를
 *    덧붙인, 옮기기 직전 운영 조합을 이 파일 안에서 다시 만들고, 옮긴 뒤 일부러 바꾼 문구(`POST_MOVE_EDITS`)만
 *    적용한 뒤 모든 칸에서 문자열로 대조한다. 그래서 core에서 온 바이트는 목록에 적힌 편집 말고는 한 글자도
 *    달라지지 않는다. 관심종목·알림 도구와 그 라우팅 줄은 옮기기 전에도 siglens 코드였으므로 양쪽이 같은 값을
 *    쓰고, 그 문구 변경은 2번 고정 해시만 잡는다. core가 내장 모음을 지우면(core 다음 메이저) 이 비교와 core의
 *    deprecated notes 비교는 지운다.
 * 2. **고정 해시(`golden/toolSetPromptHashes.json`)**: 같은 칸의 SHA-256. 내장 모음이 사라진 뒤에는 이것만 남는다.
 *    도구 문구를 일부러 바꾸면 `AGENT_TOOLSET_VERSION`을 올리고 같은 커밋에서
 *
 *      UPDATE_AGENT_TOOLSET_GOLDEN=1 yarn test src/features/agent-tools/spec/__tests__/toolSetParity.test.ts
 *
 *    로 현재 모음에서 해시 파일을 다시 쓴다(그 diff가 곧 프롬프트 변경이다). 변수가 없으면 쓰지 않는다.
 *
 * 칸: 4 로케일 × 게스트/회원 × 보유 종목 유/무 × 가용 목록. 가용 목록은 core의 같은 게이트(`promptGolden`)가 쓰는
 * 27개(core 도구 24개 전부, 하나씩 뺀 24개, core의 E2E 목록, core의 공개 API 목록 — 이 432칸의 해시는 core가
 * 내장 모음을 만들기 전 프롬프트에서 잰 core 고정 해시와 같다)에, siglens 목록 31개(siglens 도구 26개 전부,
 * 하나씩 뺀 26개, 실제 E2E fake 목록, 실제 공개 API 목록, 검색 키 없음, X 키 없음)를 더한 58개다.
 */

const LOCALES: readonly AgentLocale[] = ['ko', 'en', 'ja', 'zh'];
const PORTFOLIOS: ReadonlyArray<readonly string[] | undefined> = [
    undefined,
    ['AAPL', '005930.KS'],
];
const TURN_CONTEXT_INSTANTS = [
    '2026-09-12T14:30:00Z',
    '2026-11-20T23:59:59.999Z',
    '2026-01-01T00:00:00Z',
];

interface DescriptionEdit {
    /** 이 편집을 넣은 `AGENT_TOOLSET_VERSION`. */
    version: string;
    tool: string;
    /** core 설명에 정확히 한 번 나오는 문자열. 그 바로 뒤에 `insert`가 들어간다. */
    after: string;
    insert: string;
}

/**
 * 옮긴 뒤 일부러 바꾼 core 출신 도구 설명. 문구는 명세 파일에서 가져오지 않고 여기 문자열로 직접 적는다
 * (가져오면 현재 모음을 자기 자신과 비교하게 된다). 도구 문구를 바꾸는 PR은 core 출신 바이트를 건드리면 여기에
 * 한 줄을 더한다 — 목록이 곧 core와의 차이 전부다.
 */
const BASE_RATE_SENTENCE =
    ' Each `patterns` entry has `baseRate` (null when not measured): eventShare is the share of past daily cases whose target came before invalidation within 60 bars, placeboShare the same for a target at the same distance on other dates, n the sample size; only verdict beats_placebo means it beat that placebo, and pooled true means the numbers are for all chart patterns combined, not this pattern.';
const POST_MOVE_EDITS: readonly DescriptionEdit[] = [
    {
        version: '2026-11-28.2',
        tool: 'get_cached_analysis',
        after: 'quote them as given, do not recompute them.',
        insert: BASE_RATE_SENTENCE,
    },
    {
        version: '2026-11-28.2',
        tool: 'run_fresh_analysis',
        after: 'The result is the same structure as get_cached_analysis.',
        insert: BASE_RATE_SENTENCE,
    },
];

const occurrences = (text: string, needle: string) =>
    text.split(needle).length - 1;

function applyEdits(tool: AgentToolDefinition): AgentToolDefinition {
    const description = POST_MOVE_EDITS.filter(
        edit => edit.tool === tool.name
    ).reduce(
        (text, edit) => text.replace(edit.after, `${edit.after}${edit.insert}`),
        tool.description
    );
    return { ...tool, description };
}

/**
 * 옮기기 직전 운영 조합(core 내장 모음 + 관심종목·가격대 알림 도구, 라우팅 줄은 마지막 줄 앞)에
 * `POST_MOVE_EDITS`를 적용한 것.
 */
const PRE_MOVE_TOOL_SET: AgentToolSet = {
    ...BUILT_IN_AGENT_TOOL_SET,
    tools: [
        ...BUILT_IN_AGENT_TOOL_SET.tools.map(applyEdits),
        ...WATCHLIST_ALERT_TOOLS,
    ],
    routingRows: [
        ...BUILT_IN_AGENT_TOOL_SET.routingRows.slice(0, -1),
        ...WATCHLIST_ALERT_ROUTING_ROWS,
        ...BUILT_IN_AGENT_TOOL_SET.routingRows.slice(-1),
    ],
    ruleLines: available => [
        ...BUILT_IN_AGENT_TOOL_SET.ruleLines(available),
        ...watchlistAlertRuleLines(available),
    ],
};

const CORE_NAMES: readonly string[] = BUILT_IN_AGENT_TOOL_SET.tools.map(
    tool => tool.name
);
const SIGLENS_NAMES: readonly string[] = SIGLENS_AGENT_TOOL_SET.tools.map(
    tool => tool.name
);
const without = (names: readonly string[], ...removed: string[]) =>
    names.filter(name => !removed.includes(name));

/**
 * E2E fake 모드의 `availableToolNames()`(가격대 알림 공개 전): 검색·X 키가 없고, 긴 일봉 이력을 읽는 세 도구와
 * 공개 전 알림 제안이 빠진다. 실행기 목록 자체는 `createToolExecutor.test.ts`가 고정한다.
 */
const SIGLENS_E2E_NAMES = without(
    SIGLENS_NAMES,
    'web_search',
    'get_x_posts',
    'get_index_history_stats',
    'get_swing_history',
    'get_price_stats',
    'propose_price_alert'
);

/** 공개 API가 내보내는 에이전트 도구(`PUBLIC_API_EXCLUDED_TOOLS`를 뺀 것, `publicApiTools.test.ts`가 고정). */
const SIGLENS_PUBLIC_API_NAMES = without(
    SIGLENS_NAMES,
    'web_search',
    'get_analyst_views',
    'get_macro_quotes',
    'get_x_posts',
    'get_theme_snapshot',
    'get_index_history_stats',
    'get_swing_history',
    'get_price_stats',
    'show_chart',
    'get_my_watchlist',
    'propose_price_alert'
);

const AVAILABILITY_SETS: ReadonlyArray<readonly [string, readonly string[]]> = [
    // core `promptGolden`과 같은 27개 — 키와 목록이 core 쪽과 같다.
    ['all', CORE_NAMES],
    ...CORE_NAMES.map((name): readonly [string, readonly string[]] => [
        `minus:${name}`,
        without(CORE_NAMES, name),
    ]),
    [
        'e2e',
        [
            'search_ticker',
            'get_quote',
            'get_bars_indicators',
            'get_cached_analysis',
            'get_news',
            'get_options_summary',
            'get_fundamentals',
            'get_my_portfolio',
            'show_chart',
        ],
    ],
    [
        'publicApi',
        without(
            CORE_NAMES,
            'get_my_portfolio',
            'show_chart',
            'run_fresh_analysis'
        ),
    ],
    // siglens 모음의 31개.
    ['siglens:all', SIGLENS_NAMES],
    ...SIGLENS_NAMES.map((name): readonly [string, readonly string[]] => [
        `siglens:minus:${name}`,
        without(SIGLENS_NAMES, name),
    ]),
    ['siglens:e2eFake', SIGLENS_E2E_NAMES],
    ['siglens:publicApi', SIGLENS_PUBLIC_API_NAMES],
    ['siglens:noWebSearch', without(SIGLENS_NAMES, 'web_search')],
    ['siglens:noXPosts', without(SIGLENS_NAMES, 'get_x_posts')],
];

interface Cell {
    key: string;
    locale: AgentLocale;
    guest: boolean;
    portfolioSymbols: readonly string[] | undefined;
    available: ReadonlySet<string>;
}

const CELLS: readonly Cell[] = LOCALES.flatMap(locale =>
    [true, false].flatMap(guest =>
        PORTFOLIOS.flatMap(portfolioSymbols =>
            AVAILABILITY_SETS.map(([setName, names]) => ({
                key: [
                    locale,
                    guest ? 'guest' : 'member',
                    portfolioSymbols ? 'pf' : 'nopf',
                    setName,
                ].join('|'),
                locale,
                guest,
                portfolioSymbols,
                available: new Set(names),
            }))
        )
    )
);

function render(toolSet: AgentToolSet, cell: Cell) {
    const tools = selectToolSetSpecs(toolSet, cell.available);
    return {
        prompt: buildAgentSystemPrompt({
            locale: cell.locale,
            tools,
            toolSet,
            guest: cell.guest,
            portfolioSymbols: cell.portfolioSymbols,
        }),
        specs: JSON.stringify(tools),
    };
}

const sha = (text: string): string =>
    createHash('sha256').update(text).digest('hex');

function turnContextHashes(): Record<string, string> {
    return Object.fromEntries(
        LOCALES.flatMap(locale =>
            TURN_CONTEXT_INSTANTS.map(at => [
                `${locale}|${at}`,
                sha(buildAgentTurnContext({ locale, now: new Date(at) })),
            ])
        )
    );
}

const REGENERATE = process.env.UPDATE_AGENT_TOOLSET_GOLDEN === '1';
const FIXTURE_PATH = resolve(__dirname, 'golden/toolSetPromptHashes.json');

describe('SIGLENS_AGENT_TOOL_SET 프롬프트·명세 바이트 게이트', () => {
    it.runIf(REGENERATE)(
        'UPDATE_AGENT_TOOLSET_GOLDEN=1: 현재 모음으로 고정 해시 파일을 다시 쓴다',
        () => {
            const prompts = Object.fromEntries(
                CELLS.map(cell => {
                    const { prompt, specs } = render(
                        SIGLENS_AGENT_TOOL_SET,
                        cell
                    );
                    return [
                        cell.key,
                        { prompt: sha(prompt), specs: sha(specs) },
                    ];
                })
            );
            writeFileSync(
                FIXTURE_PATH,
                `${JSON.stringify(
                    {
                        toolsetVersion: AGENT_TOOLSET_VERSION,
                        prompts,
                        turnContext: turnContextHashes(),
                    },
                    null,
                    4
                )}\n`
            );
        }
    );

    it('칸은 928개(core 432 + siglens 496)이고 고정 해시 파일과 키가 정확히 같다', () => {
        expect(CELLS).toHaveLength(928);
        expect(new Set(CELLS.map(cell => cell.key)).size).toBe(928);
        expect(Object.keys(golden.prompts).toSorted()).toEqual(
            CELLS.map(cell => cell.key).toSorted()
        );
    });

    it('편집 목록: 기준 문자열은 core 설명에 한 번씩 있고, 새 문장은 아직 없다', () => {
        for (const edit of POST_MOVE_EDITS) {
            const core = BUILT_IN_AGENT_TOOL_SET.tools.find(
                tool => tool.name === edit.tool
            );
            expect(occurrences(core?.description ?? '', edit.after)).toBe(1);
            expect(core?.description).not.toContain(edit.insert.trim());
        }
    });

    it('모든 칸에서 시스템 프롬프트와 명세 JSON이 옮기기 전 조합에 편집 목록만 적용한 것과 문자열까지 같다', () => {
        const mismatches = CELLS.flatMap(cell => {
            const before = render(PRE_MOVE_TOOL_SET, cell);
            const after = render(SIGLENS_AGENT_TOOL_SET, cell);
            return [
                before.prompt === after.prompt ? [] : [`${cell.key} prompt`],
                before.specs === after.specs ? [] : [`${cell.key} specs`],
            ].flat();
        });
        expect(mismatches).toEqual([]);
    });

    it('모든 칸에서 시스템 프롬프트와 명세 JSON의 해시가 고정 해시와 같다', () => {
        const mismatches = CELLS.flatMap(cell => {
            const { prompt, specs } = render(SIGLENS_AGENT_TOOL_SET, cell);
            const expected =
                golden.prompts[cell.key as keyof typeof golden.prompts];
            return [
                sha(prompt) === expected.prompt ? [] : [`${cell.key} prompt`],
                sha(specs) === expected.specs ? [] : [`${cell.key} specs`],
            ].flat();
        });
        expect(mismatches).toEqual([]);
    });

    it('고정 해시는 현재 AGENT_TOOLSET_VERSION으로 만든 것이다', () => {
        expect(golden.toolsetVersion).toBe(AGENT_TOOLSET_VERSION);
    });

    it('턴 컨텍스트 노트(도구 모음과 무관한 core 출력)도 고정 해시와 같다', () => {
        expect(turnContextHashes()).toEqual(golden.turnContext);
    });
});

/** 루프 전용 필드의 표본 인자. 상한·계량·ETA가 인자에 따라 갈리는 경우를 모두 지난다. */
const SAMPLE_ARGS: readonly AgentToolArgs[] = [
    {},
    { kind: 'technical' },
    { kind: 'overall' },
    { kind: 'news' },
    { kind: 'options' },
    { kind: 'weekly' },
    { accession: '0000320193-26-000001' },
    { accession: '   ' },
    { accession: '' },
    { accession: 42 },
    { symbol: 'AAPL' },
];

describe('SIGLENS_AGENT_TOOL_SET 루프 필드는 core 내장 모음과 같다', () => {
    const builtIn = new Map(
        BUILT_IN_AGENT_TOOL_SET.tools.map(tool => [tool.name, tool])
    );
    const watchlistNames = new Set(WATCHLIST_ALERT_TOOLS.map(t => t.name));

    it('도구 순서는 core 내장 순서 뒤에 관심종목·가격대 알림 도구를 붙인 것이다', () => {
        expect(SIGLENS_NAMES).toEqual([
            ...CORE_NAMES,
            ...WATCHLIST_ALERT_TOOLS.map(tool => tool.name),
        ]);
    });

    it.each(SIGLENS_AGENT_TOOL_SET.tools.map(tool => [tool.name, tool]))(
        '%s: perTurn.max·meter·costClass·counts·estimatedSeconds',
        (name, tool) => {
            const reference = watchlistNames.has(name)
                ? WATCHLIST_ALERT_TOOLS.find(t => t.name === name)
                : builtIn.get(name);
            if (reference === undefined)
                throw new Error(`no reference definition for ${name}`);

            expect(tool.costClass).toBe(reference.costClass);
            expect(tool.perTurn?.max).toBe(reference.perTurn?.max);
            expect(tool.meter).toBe(reference.meter);
            expect(tool.perTurn?.counts === undefined).toBe(
                reference.perTurn?.counts === undefined
            );
            expect(tool.estimatedSeconds === undefined).toBe(
                reference.estimatedSeconds === undefined
            );
            for (const args of SAMPLE_ARGS) {
                expect(tool.perTurn?.counts?.(args)).toBe(
                    reference.perTurn?.counts?.(args)
                );
                expect(tool.estimatedSeconds?.(args)).toBe(
                    reference.estimatedSeconds?.(args)
                );
            }
        }
    );

    it('상한이 있는 도구는 core와 같은 다섯 개와 관심종목·알림 두 개다', () => {
        expect(
            SIGLENS_AGENT_TOOL_SET.tools
                .filter(tool => tool.perTurn !== undefined)
                .map(tool => [tool.name, tool.perTurn?.max])
        ).toEqual([
            ['get_company_filings', 2],
            ['run_fresh_analysis', 3],
            ['get_x_posts', 3],
            ['show_chart', 3],
            ['web_search', 4],
            ['get_my_watchlist', 1],
            ['propose_price_alert', 2],
        ]);
    });
});

describe('결과 notes 문구는 core의 deprecated 상수와 같은 문자열이다', () => {
    it('BARS_RESULT_NOTES: 키가 같고 고정 문구는 같은 문자열이다', () => {
        expect(Object.keys(BARS_RESULT_NOTES)).toEqual(
            Object.keys(CORE_BARS_RESULT_NOTES)
        );
        expect(BARS_RESULT_NOTES.closeStreakUnavailable).toBe(
            CORE_BARS_RESULT_NOTES.closeStreakUnavailable
        );
        expect(BARS_RESULT_NOTES.maCrossShortHistory).toBe(
            CORE_BARS_RESULT_NOTES.maCrossShortHistory
        );
        expect(BARS_RESULT_NOTES.fearGreedUnavailable).toBe(
            CORE_BARS_RESULT_NOTES.fearGreedUnavailable
        );
    });

    it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour', '1Week', '1Month'])(
        'BARS_RESULT_NOTES.dailyOnlyFields(%s)',
        timeframe => {
            expect(BARS_RESULT_NOTES.dailyOnlyFields(timeframe)).toBe(
                CORE_BARS_RESULT_NOTES.dailyOnlyFields(timeframe)
            );
        }
    );

    it('FUNDAMENTALS_RESULT_NOTES: 키 순서와 모든 문구가 같다', () => {
        expect(FUNDAMENTALS_RESULT_NOTES).toStrictEqual(
            CORE_FUNDAMENTALS_RESULT_NOTES
        );
        expect(Object.keys(FUNDAMENTALS_RESULT_NOTES)).toEqual(
            Object.keys(CORE_FUNDAMENTALS_RESULT_NOTES)
        );
    });
});
