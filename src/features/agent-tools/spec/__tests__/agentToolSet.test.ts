import {
    BUILT_IN_AGENT_TOOL_SET,
    buildAgentSystemPrompt,
    selectToolSetSpecs,
    type AgentLocale,
    type AgentToolSet,
} from '@y0ngha/siglens-core';
import { AGENT_TOOL_SET } from '@/features/agent-tools/spec/agentToolSet';
import {
    GET_MY_WATCHLIST_TOOL,
    PROPOSE_PRICE_ALERT_TOOL,
    WATCHLIST_ALERT_TOOLS,
} from '@/features/agent-tools/spec/watchlistAlertTools';

const BUILT_IN_NAMES = BUILT_IN_AGENT_TOOL_SET.tools.map(tool => tool.name);
const LOCALES: readonly AgentLocale[] = ['ko', 'en', 'ja', 'zh'];

/** 두 도구가 쓸 수 없는 턴의 가용 목록 매트릭스: 전부, 하나씩 뺀 것, 비어 있음, 최소. */
const WITHOUT_WP27_MATRIX: ReadonlyArray<
    readonly [string, ReadonlySet<string>]
> = [
    ['전부', new Set(BUILT_IN_NAMES)],
    ['없음', new Set<string>()],
    ['시세만', new Set(['get_quote'])],
    ...BUILT_IN_NAMES.map((name): readonly [string, ReadonlySet<string>] => [
        `${name} 제외`,
        new Set(BUILT_IN_NAMES.filter(other => other !== name)),
    ]),
];

function render(
    toolSet: AgentToolSet | undefined,
    available: ReadonlySet<string>,
    locale: AgentLocale,
    guest: boolean
) {
    const tools = selectToolSetSpecs(
        toolSet ?? BUILT_IN_AGENT_TOOL_SET,
        available
    );
    return {
        tools,
        prompt: buildAgentSystemPrompt({
            locale,
            tools,
            ...(toolSet === undefined ? {} : { toolSet }),
            portfolioSymbols: guest ? [] : ['AAPL', 'NVDA'],
            guest,
        }),
    };
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('AGENT_TOOL_SET: 두 도구가 없는 턴은 core 기본 모음과 바이트까지 같다', () => {
    describe.each(LOCALES)('%s', locale => {
        it.each(WITHOUT_WP27_MATRIX)(
            '가용 목록: %s (회원·게스트)',
            (_label, available) => {
                for (const guest of [false, true]) {
                    const base = render(undefined, available, locale, guest);
                    const composed = render(
                        AGENT_TOOL_SET,
                        available,
                        locale,
                        guest
                    );

                    expect(composed.prompt).toBe(base.prompt);
                    expect(JSON.stringify(composed.tools)).toBe(
                        JSON.stringify(base.tools)
                    );
                }
            }
        );
    });
});

describe('AGENT_TOOL_SET: 두 도구가 있는 턴', () => {
    const available = new Set([
        ...BUILT_IN_NAMES,
        GET_MY_WATCHLIST_TOOL,
        PROPOSE_PRICE_ALERT_TOOL,
    ]);

    it.each(LOCALES)(
        '%s: 도구 명세와 라우팅 줄, 규칙 한 줄이 각각 한 번씩 렌더된다',
        locale => {
            const { tools, prompt } = render(
                AGENT_TOOL_SET,
                available,
                locale,
                false
            );

            expect(tools.map(tool => tool.name).slice(-2)).toEqual([
                GET_MY_WATCHLIST_TOOL,
                PROPOSE_PRICE_ALERT_TOOL,
            ]);
            // 라우팅 줄(이름이 줄에 한 번씩) — 두 줄이 서로 다른 도구를 가리킨다.
            expect(count(prompt, '→ get_my_watchlist first')).toBe(1);
            expect(
                count(prompt, '→ propose_price_alert (for analysis levels')
            ).toBe(1);
            expect(count(prompt, 'Alerts are created only by the user')).toBe(
                1
            );
        }
    );

    it('덧붙인 줄이 "범위 밖 요청 → 도구 없음"보다 앞에 있어 그 줄이 표의 끝으로 남는다', () => {
        const { prompt } = render(AGENT_TOOL_SET, available, 'en', false);

        expect(prompt.indexOf('→ propose_price_alert')).toBeLessThan(
            prompt.indexOf('Out-of-scope requests')
        );
        expect(prompt.indexOf('→ get_my_watchlist first')).toBeLessThan(
            prompt.indexOf('Out-of-scope requests')
        );
        expect(AGENT_TOOL_SET.routingRows.at(-1)).toBe(
            BUILT_IN_AGENT_TOOL_SET.routingRows.at(-1)
        );
    });

    it('한 도구만 있으면 그 도구의 줄만 렌더된다', () => {
        const onlyWatchlist = new Set([
            ...BUILT_IN_NAMES,
            GET_MY_WATCHLIST_TOOL,
        ]);
        const onlyPropose = new Set([
            ...BUILT_IN_NAMES,
            PROPOSE_PRICE_ALERT_TOOL,
        ]);

        const watchlist = render(
            AGENT_TOOL_SET,
            onlyWatchlist,
            'en',
            false
        ).prompt;
        const propose = render(AGENT_TOOL_SET, onlyPropose, 'en', false).prompt;

        expect(watchlist).toContain('→ get_my_watchlist first');
        expect(watchlist).not.toContain('propose_price_alert');
        expect(watchlist).not.toContain('Alerts are created only');
        expect(propose).toContain('→ propose_price_alert');
        expect(propose).not.toContain('get_my_watchlist');
    });

    it('기본 도구의 명세·순서는 그대로고 새 도구가 뒤에 붙는다', () => {
        expect(AGENT_TOOL_SET.tools.slice(0, BUILT_IN_NAMES.length)).toEqual(
            BUILT_IN_AGENT_TOOL_SET.tools
        );
        expect(AGENT_TOOL_SET.tools.slice(BUILT_IN_NAMES.length)).toEqual(
            WATCHLIST_ALERT_TOOLS
        );
    });

    it('도구 모음 버전은 기본 버전에 덧붙인 표시를 단다', () => {
        expect(AGENT_TOOL_SET.version).toBe(
            `${BUILT_IN_AGENT_TOOL_SET.version}+wp27.1`
        );
    });

    it('tool fragments(게스트 안내·내부 이름 예시)는 기본 모음 것을 그대로 쓴다', () => {
        expect(AGENT_TOOL_SET.fragments).toBe(
            BUILT_IN_AGENT_TOOL_SET.fragments
        );
    });
});
