import { describe, expect, it } from 'vitest';
import {
    CONVERSATION_CHANGES_MAX_SYMBOLS,
    extractConversationAnalyses,
} from '@/entities/chat-conversation/server/conversationAnalyses';

type Row = Parameters<typeof extractConversationAnalyses>[0][number];

const assistantCalls = (
    seq: number,
    calls: { id: string; name: string; args: Record<string, unknown> }[]
): Row => ({
    seq,
    role: 'assistant',
    content: '',
    toolCalls: calls,
    toolCallId: null,
    toolName: null,
    status: 'complete',
});

const toolRow = (
    seq: number,
    callId: string,
    name: string,
    result: unknown,
    status: Row['status'] = 'complete'
): Row => ({
    seq,
    role: 'tool',
    content: typeof result === 'string' ? result : JSON.stringify(result),
    toolCalls: null,
    toolCallId: callId,
    toolName: name,
    status,
});

const technical = (
    generatedAt: string,
    over: Record<string, unknown> = {}
) => ({
    found: true,
    source: 'redis',
    tab: 'technical',
    timeframe: '1Day',
    generatedAt,
    analysis: { trend: 'bullish' },
    ...over,
});

/** 호출 한 쌍(assistant 호출 + tool 결과)을 만든다. */
const pair = (
    seq: number,
    callId: string,
    symbol: string,
    result: unknown,
    tool = 'get_cached_analysis'
): Row[] => [
    assistantCalls(seq, [{ id: callId, name: tool, args: { symbol } }]),
    toolRow(seq + 1, callId, tool, result),
];

describe('extractConversationAnalyses', () => {
    it('도구 결과를 호출 인자의 종목과 tool_call_id로 짝짓는다', () => {
        const rows = pair(
            1,
            'c1',
            'nvda',
            technical('2026-11-18T14:00:00.000Z')
        );
        expect(extractConversationAnalyses(rows)).toEqual([
            {
                symbol: 'NVDA',
                generatedAt: '2026-11-18T14:00:00.000Z',
                analysis: { trend: 'bullish' },
                seq: 2,
            },
        ]);
    });

    it('core가 회원 시간대로 바꿔 저장한 generatedAt(`… KST`)을 ISO로 되돌려 읽는다', () => {
        const rows = pair(1, 'c1', 'NVDA', technical('2026-11-28 15:44 KST'));
        expect(extractConversationAnalyses(rows)).toEqual([
            {
                symbol: 'NVDA',
                generatedAt: '2026-11-28T06:44:00.000Z',
                analysis: { trend: 'bullish' },
                seq: 2,
            },
        ]);
    });

    it('run_fresh_analysis 결과도 읽는다', () => {
        const rows = pair(
            1,
            'c1',
            'AAPL',
            technical('2026-11-18T14:00:00.000Z'),
            'run_fresh_analysis'
        );
        expect(extractConversationAnalyses(rows).map(a => a.symbol)).toEqual([
            'AAPL',
        ]);
    });

    it('다른 호출의 id와 섞이지 않는다', () => {
        const rows: Row[] = [
            assistantCalls(1, [
                {
                    id: 'a',
                    name: 'get_cached_analysis',
                    args: { symbol: 'AAPL' },
                },
                {
                    id: 'b',
                    name: 'get_cached_analysis',
                    args: { symbol: 'MSFT' },
                },
            ]),
            toolRow(
                2,
                'b',
                'get_cached_analysis',
                technical('2026-11-18T14:00:00.000Z')
            ),
        ];
        expect(extractConversationAnalyses(rows).map(a => a.symbol)).toEqual([
            'MSFT',
        ]);
    });

    it('짝이 없는 결과(호출 행이 없음)는 버린다', () => {
        const rows = [
            toolRow(
                2,
                'orphan',
                'get_cached_analysis',
                technical('2026-11-18T14:00:00.000Z')
            ),
        ];
        expect(extractConversationAnalyses(rows)).toEqual([]);
    });

    it.each([
        [
            'overall 탭',
            technical('2026-11-18T14:00:00.000Z', { tab: 'overall' }),
        ],
        [
            '1Hour',
            technical('2026-11-18T14:00:00.000Z', { timeframe: '1Hour' }),
        ],
        [
            '1Week',
            technical('2026-11-18T14:00:00.000Z', { timeframe: '1Week' }),
        ],
        [
            'found:false',
            technical('2026-11-18T14:00:00.000Z', { found: false }),
        ],
        ['generatedAt 없음', technical('x', { generatedAt: null })],
        ['읽을 수 없는 generatedAt', technical('어제')],
        [
            'analysis가 문자열',
            technical('2026-11-18T14:00:00.000Z', { analysis: '요약' }),
        ],
        [
            'analysis가 배열',
            technical('2026-11-18T14:00:00.000Z', { analysis: [] }),
        ],
        [
            '잘린 미리보기',
            { truncated: true, preview: '{"found":true,"tab":"tech' },
        ],
        ['JSON이 아님', 'not json'],
        ['배열 결과', []],
    ])('비교 기준이 될 수 없는 결과는 버린다: %s', (_label, result) => {
        expect(
            extractConversationAnalyses(pair(1, 'c1', 'AAPL', result))
        ).toEqual([]);
    });

    it('완료·중단 외 상태의 tool 행은 읽지 않는다', () => {
        const rows: Row[] = [
            assistantCalls(1, [
                {
                    id: 'c1',
                    name: 'get_cached_analysis',
                    args: { symbol: 'AAPL' },
                },
            ]),
            toolRow(
                2,
                'c1',
                'get_cached_analysis',
                technical('2026-11-18T14:00:00.000Z'),
                'superseded'
            ),
        ];
        expect(extractConversationAnalyses(rows)).toEqual([]);
        rows[1] = toolRow(
            2,
            'c1',
            'get_cached_analysis',
            technical('2026-11-18T14:00:00.000Z'),
            'aborted'
        );
        expect(extractConversationAnalyses(rows)).toHaveLength(1);
    });

    it('종목마다 가장 나중 분석 하나만 남긴다', () => {
        const rows = [
            ...pair(1, 'c1', 'AAPL', technical('2026-11-10T14:00:00.000Z')),
            ...pair(3, 'c2', 'AAPL', technical('2026-11-18T14:00:00.000Z')),
        ];
        expect(extractConversationAnalyses(rows)).toEqual([
            expect.objectContaining({
                symbol: 'AAPL',
                generatedAt: '2026-11-18T14:00:00.000Z',
            }),
        ]);
    });

    it('종목은 최근에 본 순으로 상한 없이 모두 돌려준다(상한은 카드 쪽이 건다)', () => {
        const symbols = ['A', 'B', 'C', 'D', 'E'];
        const rows = symbols.flatMap((symbol, index) =>
            pair(
                index * 2 + 1,
                `c${index}`,
                symbol,
                technical('2026-11-18T14:00:00.000Z')
            )
        );
        const result = extractConversationAnalyses(rows);
        expect(result.length).toBeGreaterThan(CONVERSATION_CHANGES_MAX_SYMBOLS);
        expect(result.map(a => a.symbol)).toEqual(['E', 'D', 'C', 'B', 'A']);
    });

    it('호출 id가 턴마다 다시 쓰여도(call_0) 바로 앞 호출의 종목에 짝짓는다', () => {
        const rows = [
            ...pair(1, 'call_0', 'AAPL', technical('2026-11-10T14:00:00.000Z')),
            ...pair(3, 'call_0', 'MSFT', technical('2026-11-18T14:00:00.000Z')),
        ];
        const result = extractConversationAnalyses(rows);
        expect(result.map(a => [a.symbol, a.generatedAt]).toSorted()).toEqual([
            ['AAPL', '2026-11-10T14:00:00.000Z'],
            ['MSFT', '2026-11-18T14:00:00.000Z'],
        ]);
    });

    it('더 앞 턴의 같은 id 호출은 뒤 턴의 결과에 섞이지 않는다', () => {
        const rows: Row[] = [
            assistantCalls(1, [
                {
                    id: 'call_0',
                    name: 'get_cached_analysis',
                    args: { symbol: 'AAPL' },
                },
            ]),
            // 이 턴의 호출은 분석 도구가 아니다 — call_0이 AAPL로 남아 있으면 안 된다.
            assistantCalls(3, [
                { id: 'call_0', name: 'get_quote', args: { symbol: 'MSFT' } },
            ]),
            toolRow(
                4,
                'call_0',
                'get_cached_analysis',
                technical('2026-11-18T14:00:00.000Z')
            ),
        ];
        expect(extractConversationAnalyses(rows)).toEqual([]);
    });

    it('행이 섞여 와도 seq 순으로 읽는다', () => {
        const rows = pair(
            1,
            'c1',
            'AAPL',
            technical('2026-11-18T14:00:00.000Z')
        ).toReversed();
        expect(extractConversationAnalyses(rows)).toHaveLength(1);
    });

    it('status가 없는 행(테스트·옛 호출자)도 읽는다', () => {
        const [call, tool] = pair(
            1,
            'c1',
            'AAPL',
            technical('2026-11-18T14:00:00.000Z')
        );
        const { status: _a, ...callNoStatus } = call;
        const { status: _b, ...toolNoStatus } = tool;
        expect(
            extractConversationAnalyses([callNoStatus, toolNoStatus])
        ).toHaveLength(1);
    });
});
