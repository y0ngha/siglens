import {
    buildAgentSystemPrompt,
    buildAgentTurnContext,
    selectToolSetSpecs,
    type AgentLocale,
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
import { WATCHLIST_ALERT_TOOLS } from '@/features/agent-tools/spec/watchlistAlertTools';
import golden from './golden/toolSetPromptHashes.json';

/**
 * 도구 명세가 core에서 siglens로 옮겨 온 뒤에도 모델이 보는 바이트가 바뀌지 않는지 지키는 게이트.
 *
 * core 3.1.0이 내장 도구 모음을 지웠으므로 비교 기준은 고정 해시(`golden/toolSetPromptHashes.json`) 하나다.
 * 같은 칸의 시스템 프롬프트와 명세 JSON의 SHA-256을 대조한다. 도구 문구를 일부러 바꾸면
 * `AGENT_TOOLSET_VERSION`을 올리고 같은 커밋에서
 *
 *   UPDATE_AGENT_TOOLSET_GOLDEN=1 yarn test src/features/agent-tools/spec/__tests__/toolSetParity.test.ts
 *
 * 로 현재 모음에서 해시 파일을 다시 쓴다(그 diff가 곧 프롬프트 변경이다). 변수가 없으면 쓰지 않는다.
 *
 * 칸: 4 로케일 × 게스트/회원 × 보유 종목 유/무 × 가용 목록. 가용 목록은 core 도구 24개 기준 27개
 * (전부, 하나씩 뺀 24개, E2E 목록, 공개 API 목록)와 siglens 목록 31개(siglens 도구 26개 전부, 하나씩 뺀 26개,
 * 실제 E2E fake 목록, 실제 공개 API 목록, 검색 키 없음, X 키 없음)를 더한 58개다. core 출신 24개는
 * 관심종목·알림 도구를 뺀 모음 순서 그대로다.
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

const SIGLENS_NAMES: readonly string[] = SIGLENS_AGENT_TOOL_SET.tools.map(
    tool => tool.name
);
const WATCHLIST_NAMES: readonly string[] = WATCHLIST_ALERT_TOOLS.map(
    tool => tool.name
);
const CORE_NAMES: readonly string[] = SIGLENS_NAMES.filter(
    name => !WATCHLIST_NAMES.includes(name)
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

    it('칸은 928개(core 24개 기준 432 + siglens 496)이고 고정 해시 파일과 키가 정확히 같다', () => {
        expect(CELLS).toHaveLength(928);
        expect(new Set(CELLS.map(cell => cell.key)).size).toBe(928);
        expect(Object.keys(golden.prompts).toSorted()).toEqual(
            CELLS.map(cell => cell.key).toSorted()
        );
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

describe('SIGLENS_AGENT_TOOL_SET 루프 필드', () => {
    it('도구 순서는 core 출신 24개 뒤에 관심종목·가격대 알림 도구를 붙인 것이다', () => {
        expect(CORE_NAMES).toHaveLength(24);
        expect(SIGLENS_NAMES).toEqual([...CORE_NAMES, ...WATCHLIST_NAMES]);
    });

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

    it('새 분석 일일 한도는 run_fresh_analysis만 dailyQuota로 선언한다', () => {
        expect(
            SIGLENS_AGENT_TOOL_SET.tools
                .filter(tool => tool.dailyQuota !== undefined)
                .map(tool => [tool.name, tool.dailyQuota])
        ).toEqual([['run_fresh_analysis', 'freshAnalysis']]);
    });
});
