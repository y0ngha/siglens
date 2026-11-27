import 'server-only';
import type { ChartToolCall } from '@/app/api/ai/chat/tools/chatTools';
import type { ChatBlock } from '@/entities/chat-conversation/types';

/**
 * 한 턴의 차트 블록 짝짓기. core의 도구 실행 컨텍스트에는 호출 id가 없어, 실행기가 낸 블록은 **이름·인자**로 받고
 * (`ToolExecutorOptions.onChart`), `tool_start`(같은 이름·인자와 id)로 id에 묶은 뒤 `tool_end`에서 프레임으로 낸다.
 * core는 `tool_start`의 `args`와 실행기 인자로 같은 검증 결과 객체를 넘기므로 직렬화가 같다.
 *
 * 같은 턴에 이름·인자가 똑같은 호출이 두 번이면 같은 블록을 가리킨다(같은 데이터라 문제없다).
 */
export interface TurnCharts {
    /** 실행기가 블록을 냈다(`onChart`). */
    register: (call: ChartToolCall, pending: Promise<ChatBlock | null>) => void;
    /** `tool_start` — 이 호출 id를 이름·인자에 묶는다. */
    started: (id: string, name: string, args: Record<string, unknown>) => void;
    /** 성공한 `tool_end` — 그 호출의 블록이 준비되면 `emit`한다(블록이 없으면 아무것도 하지 않는다). */
    ended: (id: string, emit: (block: ChatBlock) => void) => void;
    /** 이 턴에 나간 블록을 모두 기다려 호출 id → 블록으로 돌려준다(저장용). */
    settled: () => Promise<ReadonlyMap<string, ChatBlock>>;
}

const keyOf = (name: string, args: Record<string, unknown>): string =>
    `${name}\u0000${JSON.stringify(args)}`;

export function createTurnCharts(): TurnCharts {
    const pendingByCall = new Map<string, Promise<ChatBlock | null>>();
    const keyById = new Map<string, string>();
    const emitted = new Map<string, Promise<ChatBlock | null>>();
    return {
        register: (call, pending) =>
            void pendingByCall.set(keyOf(call.name, call.args), pending),
        started: (id, name, args) => void keyById.set(id, keyOf(name, args)),
        ended: (id, emit) => {
            const key = keyById.get(id);
            const pending =
                key === undefined ? undefined : pendingByCall.get(key);
            if (pending === undefined) return;
            emitted.set(
                id,
                pending.then(block => {
                    if (block !== null) emit(block);
                    return block;
                })
            );
        },
        settled: async () => {
            const entries = await Promise.all(
                [...emitted.entries()].map(
                    async ([id, pending]) => [id, await pending] as const
                )
            );
            return new Map(
                entries.flatMap(([id, block]) =>
                    block === null ? [] : [[id, block] as const]
                )
            );
        },
    };
}
