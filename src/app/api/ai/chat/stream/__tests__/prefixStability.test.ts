import {
    runAgentTurn,
    type AgentCounters,
    type AgentMessage,
    type AgentProviderResult,
    type CallAgentProviderOptions,
    type CounterStore,
} from '@y0ngha/siglens-core';
import { describe, expect, it, vi } from 'vitest';
import {
    toAgentHistory,
    type ChatMessageRecord,
} from '@/entities/chat-conversation/model';
import { toOpenAiChatMessages } from '@/entities/llm-provider/api/agent/mapMessages';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { compareCodeUnits } from '@/shared/lib/compareCodeUnits';

/**
 * DeepSeek bills the longest byte-identical request prefix at a cached rate, so turn N+1's first request must
 * start with every byte of turn N's last request. Three app-side steps decide that, and this test runs all of
 * them with the REAL core loop and no LLM: the instant the "## Now" note was built from is stored with the
 * user row (`turn_at`, a Date) and core rebuilds the note from it (`turnAt`), the stored rows pass through a jsonb simulation (object keys come back sorted by length,
 * then bytes), and the adapter serializes tool-call arguments (`stableStringify`). Without the last one the
 * prefix breaks at the previous turn's assistant tool-call message.
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

/** Postgres jsonb order: shorter keys first, ties by bytes — applied at every depth. */
function jsonbOrder(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(jsonbOrder);
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => a.length - b.length || compareCodeUnits(a, b))
            .map(([key, v]) => [key, jsonbOrder(v)])
    );
}

/** A stored row as `listMessages` returns it, after the jsonb round trip. */
function storedRow(
    m: AgentMessage
): Pick<
    ChatMessageRecord,
    | 'role'
    | 'content'
    | 'toolCalls'
    | 'toolCallId'
    | 'toolName'
    | 'status'
    | 'images'
    | 'turnAt'
> {
    return {
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls
            ? (jsonbOrder(m.toolCalls) as AgentMessage['toolCalls'])
            : null,
        toolCallId: m.toolCallId ?? null,
        toolName: m.toolName ?? null,
        status: 'complete',
        images: [],
        // timestamptz round trip: the ISO string core returned becomes a Date, then the repository hands it back.
        turnAt: m.turnAt ? new Date(m.turnAt) : null,
    };
}

interface Request {
    turn: number;
    /** What the adapter would put on the wire for this call's `messages`. */
    wire: string;
}

/** Runs `turnCount` member turns the way `agentTurnStream` stores them, one tool call each. */
async function simulate(turnCount: number): Promise<Request[]> {
    const requests: Request[] = [];
    const turns = Array.from({ length: turnCount }, (_, i) => i + 1);
    await turns.reduce<Promise<AgentMessage[]>>(async (previous, turn) => {
        const stored = await previous;
        const script: AgentProviderResult[] = [
            {
                text: '',
                toolCalls: [
                    {
                        id: `call-${turn}`,
                        name: 'get_bars_indicators',
                        // Model order: not the order jsonb gives back.
                        args: {
                            symbol: 'AAPL',
                            timeframe: '1Day',
                            bars: 30,
                            filter: { zeta: [{ b: 2, a: 1 }], alpha: turn },
                        },
                    },
                ],
                stopReason: 'tool_use',
                usage: USAGE,
            },
            {
                text: `답 ${turn}`,
                toolCalls: [],
                stopReason: 'end',
                usage: USAGE,
            },
        ];
        const userMessage = `질문 ${turn}`;
        const result = await runAgentTurn(
            {
                userId: 'u1',
                tier: 'member',
                model: 'deepseek-v4.1-flash',
                locale: 'ko',
                history: toAgentHistory(stored.map(storedRow)),
                userMessage,
                availableTools: new Set(['get_quote', 'get_bars_indicators']),
                krSession: KR_EQUITY_SESSION,
                now: new Date(Date.UTC(2026, 10, 20, 14, 9 + turn * 7)),
            },
            {
                callAgentProvider: async (
                    options: CallAgentProviderOptions
                ) => {
                    // Snapshot now: the loop keeps appending to its own message list.
                    requests.push({
                        turn,
                        wire: JSON.stringify(
                            toOpenAiChatMessages(options.messages)
                        ),
                    });
                    const next = script.shift();
                    if (!next) throw new Error('script exhausted');
                    return next;
                },
                executeTool: vi.fn(async () => ({ price: 231.42 })),
                counters: counters(),
                onEvent: () => {},
            }
        );
        if (!result.ok || result.turnAt === undefined)
            throw new Error('expected an ok turn with an instant');
        return [
            ...stored,
            {
                role: 'user',
                content: userMessage,
                turnAt: result.turnAt,
            },
            ...result.intermediate,
            result.assistant,
        ];
    }, Promise.resolve([]));
    return requests;
}

const firstOfTurn = (requests: readonly Request[], turn: number): Request => {
    const found = requests.find(r => r.turn === turn);
    if (found === undefined) throw new Error(`no request for turn ${turn}`);
    return found;
};
const lastOfTurn = (requests: readonly Request[], turn: number): Request => {
    const found = requests.filter(r => r.turn === turn).at(-1);
    if (found === undefined) throw new Error(`no request for turn ${turn}`);
    return found;
};

/** `wire` is a JSON array: the previous request is a prefix when it matches up to its closing bracket. */
const extendsPrevious = (requests: readonly Request[], turn: number): boolean =>
    firstOfTurn(requests, turn).wire.startsWith(
        `${lastOfTurn(requests, turn - 1).wire.slice(0, -1)},`
    );

describe('turn N+1 extends turn N as a string prefix (real core loop, no LLM)', () => {
    it('keeps every byte of the previous turn across 4 turns, tool-call arguments included', async () => {
        const requests = await simulate(4);
        expect(extendsPrevious(requests, 2)).toBe(true);
        expect(extendsPrevious(requests, 3)).toBe(true);
        expect(extendsPrevious(requests, 4)).toBe(true);
    });

    it('rebuilds each stored note from its instant on its own message and sends only the latest as the present', async () => {
        const requests = await simulate(3);
        const turn3 = JSON.parse(firstOfTurn(requests, 3).wire) as {
            role: string;
            content: string;
        }[];
        const notes = turn3
            .filter(m => m.role === 'user')
            .map(m => m.content.split('\n')[0]);
        expect(notes).toEqual(['## Now', '## Now', '## Now']);
        expect(turn3.at(-1)?.content).toContain('## Message\n질문 3');
        expect(turn3.at(-1)?.content).toContain(
            '- Korean stocks (KRX): closed; opens Mon 2026-11-23 09:00 KST'
        );
    });

    it('serializes the same arguments whichever key order storage hands back', async () => {
        const requests = await simulate(2);
        const wire = firstOfTurn(requests, 2).wire;
        expect(wire).toContain(
            '"arguments":"{\\"bars\\":30,\\"filter\\":{\\"alpha\\":1,\\"zeta\\":[{\\"a\\":1,\\"b\\":2}]},\\"symbol\\":\\"AAPL\\",\\"timeframe\\":\\"1Day\\"}"'
        );
    });
});
