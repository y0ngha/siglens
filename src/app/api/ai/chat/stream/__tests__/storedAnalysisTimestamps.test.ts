import {
    runAgentTurn,
    type AgentCounters,
    type AgentProviderResult,
    type CounterStore,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import type { ChatMessageRecord } from '@/entities/chat-conversation/model';
import { extractConversationAnalyses } from '@/entities/chat-conversation/server/conversationAnalyses';
import { SIGLENS_AGENT_TOOL_SET } from '@/features/agent-tools/spec/agentToolSet';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';

/**
 * core `runAgentTurn`은 도구 결과의 ISO 시각을 회원 시간대의 `YYYY-MM-DD HH:MM <라벨>`로 바꾼 뒤 돌려주고
 * (`localizeTimestamps`), `agentTurnStream`은 그 `intermediate`를 그대로 `chat_messages`에 저장한다. 이 테스트는
 * 실제 core 루프가 만든 tool 행을 저장 모양으로 옮겨 `extractConversationAnalyses`에 넣는다 — 파서가 ISO만 읽던
 * 때는 모든 저장 분석이 빠져 "달라진 점" 카드와 `sinceEarlier`가 운영에서 한 번도 나오지 않았다.
 */

const USAGE = {
    promptTokens: 10,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 5,
};

function memoryCounter(): CounterStore {
    const state = { count: 0 };
    return {
        consume: async (_subject, limit) => {
            if (state.count + 1 > limit) return false;
            state.count += 1;
            return true;
        },
        refund: async () => {
            state.count -= 1;
        },
        remaining: async (_subject, limit) => Math.max(0, limit - state.count),
    };
}

const counters = (): AgentCounters => ({
    turns: memoryCounter(),
    premiumTurns: memoryCounter(),
    freshAnalysis: memoryCounter(),
    webSearchUser: memoryCounter(),
    webSearchGlobalDay: memoryCounter(),
    webSearchGlobalMonth: memoryCounter(),
});

type StoredRow = Parameters<typeof extractConversationAnalyses>[0][number];

/** 한 턴을 실제 core 루프로 돌려 저장될 행(assistant 호출 + tool 결과)을 돌려준다. */
async function storedRowsFor(
    generatedAt: string,
    timeZone: string
): Promise<StoredRow[]> {
    const script: AgentProviderResult[] = [
        {
            text: '',
            toolCalls: [
                {
                    id: 'call_0',
                    name: 'get_cached_analysis',
                    args: {
                        symbol: 'NVDA',
                        tab: 'technical',
                        timeframe: '1Day',
                    },
                },
            ],
            stopReason: 'tool_use',
            usage: USAGE,
        },
        { text: '답', toolCalls: [], stopReason: 'end', usage: USAGE },
    ];
    const result = await runAgentTurn(
        {
            userId: 'u1',
            tier: 'member',
            model: 'deepseek-v4.1-flash',
            locale: 'ko',
            history: [],
            userMessage: '엔비디아 분석',
            availableTools: new Set(['get_cached_analysis']),
            toolSet: SIGLENS_AGENT_TOOL_SET,
            krSession: KR_EQUITY_SESSION,
            timeZone,
            now: new Date('2026-11-28T07:00:00.000Z'),
        },
        {
            callAgentProvider: async () => {
                const next = script.shift();
                if (!next) throw new Error('script exhausted');
                return next;
            },
            executeTool: async () => ({
                found: true,
                source: 'redis',
                tab: 'technical',
                timeframe: '1Day',
                generatedAt,
                analysis: { trend: 'bullish' },
            }),
            counters: counters(),
            onEvent: () => {},
        }
    );
    if (!result.ok) throw new Error('expected an ok turn');
    return result.intermediate.map((m, index): StoredRow => ({
        seq: index + 1,
        role: m.role as ChatMessageRecord['role'],
        content: m.content,
        toolCalls: m.toolCalls ?? null,
        toolCallId: m.toolCallId ?? null,
        toolName: m.toolName ?? null,
        status: 'complete',
    }));
}

function storedGeneratedAt(rows: readonly StoredRow[]): unknown {
    const tool = rows.find(r => r.role === 'tool');
    if (tool === undefined) throw new Error('no tool row');
    return (JSON.parse(tool.content) as { generatedAt: unknown }).generatedAt;
}

describe('저장된 분석 시각 — 실제 core 지역화 출력을 되읽는다', () => {
    it.each([
        ['Asia/Seoul', '2026-11-28T06:44:12.345Z'],
        ['America/New_York', '2026-11-28T06:44:12.345Z'],
        ['America/New_York', '2026-07-01T14:05:59.999Z'],
        // 서머타임이 끝나는 날의 겹치는 01:30 두 번 — 라벨(EDT/EST)로 갈린다.
        ['America/New_York', '2026-11-01T05:30:00.000Z'],
        ['America/New_York', '2026-11-01T06:30:00.000Z'],
        ['America/Los_Angeles', '2026-07-01T14:05:00.000Z'],
        ['Asia/Tokyo', '2026-11-28T06:44:00.000Z'],
        ['Asia/Shanghai', '2026-11-28T06:44:00.000Z'],
        ['Europe/London', '2026-07-01T14:05:00.000Z'],
        ['Europe/London', '2026-11-28T06:44:00.000Z'],
        ['Asia/Kolkata', '2026-11-28T06:44:00.000Z'],
        ['UTC', '2026-11-28T06:44:00.000Z'],
    ])('%s · %s', async (timeZone, generatedAt) => {
        const rows = await storedRowsFor(generatedAt, timeZone);
        // 저장되는 값은 ISO가 아니다 — 이 전제가 바뀌면(core가 원본을 저장하게 되면) 이 테스트를 다시 본다.
        expect(storedGeneratedAt(rows)).not.toBe(generatedAt);
        const minute = `${generatedAt.slice(0, 16)}:00.000Z`;
        expect(extractConversationAnalyses(rows)).toEqual([
            {
                symbol: 'NVDA',
                generatedAt: minute,
                analysis: { trend: 'bullish' },
                seq: 2,
            },
        ]);
    });
});

/** `Etc/GMT±N`(부호가 반대다: `Etc/GMT-9`는 UTC+9)과 `Etc/UTC` — `Intl.supportedValuesOf`에 없는 고정 오프셋 시간대. */
const ETC_ZONES = [
    'Etc/GMT',
    'Etc/UTC',
    ...Array.from({ length: 14 }, (_, i) => `Etc/GMT-${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `Etc/GMT+${i + 1}`),
];

describe('저장된 분석 시각 — Etc 고정 오프셋 시간대', () => {
    it.each(ETC_ZONES)('%s', async timeZone => {
        const generatedAt = '2026-11-28T06:44:12.345Z';
        const rows = await storedRowsFor(generatedAt, timeZone);
        expect(storedGeneratedAt(rows)).not.toBe(generatedAt);
        expect(extractConversationAnalyses(rows)[0]?.generatedAt).toBe(
            '2026-11-28T06:44:00.000Z'
        );
    });
});
