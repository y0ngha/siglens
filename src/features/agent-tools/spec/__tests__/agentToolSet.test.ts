import {
    buildAgentSystemPrompt,
    selectToolSetSpecs,
    type AgentLocale,
} from '@y0ngha/siglens-core';
import {
    AGENT_TOOLSET_VERSION,
    SIGLENS_AGENT_TOOL_SET,
} from '@/features/agent-tools/spec/agentToolSet';
import {
    GET_MY_WATCHLIST_TOOL,
    PROPOSE_PRICE_ALERT_TOOL,
    WATCHLIST_ALERT_TOOLS,
} from '@/features/agent-tools/spec/watchlistAlertTools';

const ALL_NAMES = SIGLENS_AGENT_TOOL_SET.tools.map(tool => tool.name);
const LOCALES: readonly AgentLocale[] = ['ko', 'en', 'ja', 'zh'];

function render(available: ReadonlySet<string>, locale: AgentLocale) {
    const tools = selectToolSetSpecs(SIGLENS_AGENT_TOOL_SET, available);
    return {
        tools,
        prompt: buildAgentSystemPrompt({
            locale,
            tools,
            toolSet: SIGLENS_AGENT_TOOL_SET,
            portfolioSymbols: ['AAPL', 'NVDA'],
            guest: false,
        }),
    };
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('SIGLENS_AGENT_TOOL_SET: 관심종목·가격대 알림 도구가 있는 턴', () => {
    const available = new Set(ALL_NAMES);

    it.each(LOCALES)(
        '%s: 도구 명세와 라우팅 줄, 규칙 한 줄이 각각 한 번씩 렌더된다',
        locale => {
            const { tools, prompt } = render(available, locale);

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
        const { prompt } = render(available, 'en');

        expect(prompt.indexOf('→ propose_price_alert')).toBeLessThan(
            prompt.indexOf('Out-of-scope requests')
        );
        expect(prompt.indexOf('→ get_my_watchlist first')).toBeLessThan(
            prompt.indexOf('Out-of-scope requests')
        );
        expect(SIGLENS_AGENT_TOOL_SET.routingRows.at(-1)?.text).toBe(
            'Out-of-scope requests (code, homework, unrelated topics) → no tools.'
        );
    });

    it('한 도구만 있으면 그 도구의 줄만 렌더된다', () => {
        const watchlist = render(
            new Set(
                ALL_NAMES.filter(name => name !== PROPOSE_PRICE_ALERT_TOOL)
            ),
            'en'
        ).prompt;
        const propose = render(
            new Set(ALL_NAMES.filter(name => name !== GET_MY_WATCHLIST_TOOL)),
            'en'
        ).prompt;

        expect(watchlist).toContain('→ get_my_watchlist first');
        expect(watchlist).not.toContain('propose_price_alert');
        expect(watchlist).not.toContain('Alerts are created only');
        expect(propose).toContain('→ propose_price_alert');
        expect(propose).not.toContain('get_my_watchlist');
    });

    it('관심종목·알림 도구는 목록의 맨 뒤에 그 순서로 붙는다', () => {
        expect(
            SIGLENS_AGENT_TOOL_SET.tools.slice(-WATCHLIST_ALERT_TOOLS.length)
        ).toEqual(WATCHLIST_ALERT_TOOLS);
    });
});

describe('SIGLENS_AGENT_TOOL_SET 구성', () => {
    it('도구 이름은 서로 다르고 스키마는 추가 필드를 받지 않는다', () => {
        expect(new Set(ALL_NAMES).size).toBe(ALL_NAMES.length);
        for (const tool of SIGLENS_AGENT_TOOL_SET.tools)
            expect(tool.inputSchema.additionalProperties).toBe(false);
    });

    it('도구 모음 버전은 AGENT_TOOLSET_VERSION이고 <날짜>.<번호> 형식이다', () => {
        expect(SIGLENS_AGENT_TOOL_SET.version).toBe(AGENT_TOOLSET_VERSION);
        expect(AGENT_TOOLSET_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    });

    it('라우팅 줄이 요구하는 도구는 모두 모음에 있다', () => {
        const names = new Set(ALL_NAMES);
        const unknown = SIGLENS_AGENT_TOOL_SET.routingRows
            .flatMap(row => row.requires)
            .filter(name => !names.has(name));
        expect(unknown).toEqual([]);
    });
});
