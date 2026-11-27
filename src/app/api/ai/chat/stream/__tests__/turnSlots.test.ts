import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetTurnSlotsForTests,
    acquireTurnSlot,
    AGENT_TURN_QUEUE_MAX,
    AGENT_TURN_QUEUE_WAIT_MS,
    getActiveAgentTurns,
    getQueuedAgentTurns,
    MAX_ACTIVE_AGENT_TURNS,
    MAX_ADMITTED_AGENT_TURNS,
    type TurnSlot,
} from '@/app/api/ai/chat/stream/_lib/turnSlots';
import { MAX_CONCURRENT_FRESH } from '@/app/api/ai/chat/tools/runFreshAnalysis';

const open = () => true;

/** 큐 없이 즉시 풀리는 획득만 쓰는 헬퍼 — 실패하면 테스트가 바로 깨진다. */
async function take(
    canAcceptStream: () => boolean = open,
    signal: AbortSignal = new AbortController().signal
): Promise<TurnSlot> {
    const result = await acquireTurnSlot({ signal, canAcceptStream });
    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    return result.slot;
}

const takeMany = (n: number): Promise<TurnSlot[]> =>
    Promise.all(Array.from({ length: n }, () => take()));

/** 들어오자마자 주차하는 턴 `n`개 — 한 번에 하나씩, 앞 턴이 주차해 자리가 난 뒤 다음이 들어온다. */
async function takeParked(n: number): Promise<TurnSlot[]> {
    if (n === 0) return [];
    const slot = await take();
    slot.park();
    return [slot, ...(await takeParked(n - 1))];
}

describe('turnSlots', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetTurnSlotsForTests();
    });
    afterEach(() => {
        __resetTurnSlotsForTests();
        vi.useRealTimers();
    });

    // 용량 정책 값이라 의도적으로 리터럴로 고정한다 — 바꾸려면 이 줄도 함께 바꿔야 한다.
    it('정책 값: 일하는 턴 4, 대기 8명 15초, 하드 상한은 4 + 새 분석 슬롯 수', () => {
        expect(MAX_ACTIVE_AGENT_TURNS).toBe(4);
        expect(AGENT_TURN_QUEUE_MAX).toBe(8);
        expect(AGENT_TURN_QUEUE_WAIT_MS).toBe(15_000);
        expect(MAX_ADMITTED_AGENT_TURNS).toBe(4 + MAX_CONCURRENT_FRESH);
        expect(MAX_ADMITTED_AGENT_TURNS).toBe(14);
    });

    it('상한까지는 기다림 없이 들어오고, 5번째는 줄을 서다가 반납되면 들어온다', async () => {
        const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        expect(getActiveAgentTurns()).toBe(4);

        const fifth = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        expect(getQueuedAgentTurns()).toBe(1);
        vi.advanceTimersByTime(3_000);
        slots[0].release();
        const result = await fifth;

        expect(result).toMatchObject({ ok: true, waitedMs: 3_000 });
        expect(getActiveAgentTurns()).toBe(4);
        expect(getQueuedAgentTurns()).toBe(0);
    });

    it('줄은 먼저 온 순서대로 풀린다', async () => {
        const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        const order: string[] = [];
        const wait = (name: string) =>
            acquireTurnSlot({
                signal: new AbortController().signal,
                canAcceptStream: open,
            }).then(r => {
                order.push(name);
                return r;
            });
        const first = wait('first');
        const second = wait('second');
        const third = wait('third');

        slots[0].release();
        await first;
        expect(order).toEqual(['first']);
        slots[1].release();
        await second;
        slots[2].release();
        await third;
        expect(order).toEqual(['first', 'second', 'third']);
    });

    it('줄이 있으면 자리가 보여도 새로 온 요청이 앞질러 가지 않는다', async () => {
        const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        // 줄 맨 앞은 분석 스트림 슬롯이 없어 못 들어간다.
        const streamOpen = vi.fn(() => false);
        const head = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: streamOpen,
        });
        slots[0].release();
        expect(getActiveAgentTurns()).toBe(3);

        const behind = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        expect(getQueuedAgentTurns()).toBe(2);
        expect(getActiveAgentTurns()).toBe(3);

        streamOpen.mockReturnValue(true);
        vi.advanceTimersByTime(1_000);
        await expect(head).resolves.toMatchObject({ ok: true });
        // 맨 앞이 들어와 정원이 다시 찼으니 뒤 요청은 아직 줄에 있다.
        expect(getQueuedAgentTurns()).toBe(1);
        slots[1].release();
        await expect(behind).resolves.toMatchObject({ ok: true });
    });

    it('주차하면 일하는 턴에서 빠져 줄 맨 앞이 들어오고, 해제해도 누구도 밀려나지 않는다', async () => {
        const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        const unpark = slots[0].park();
        const admitted = await waiting;

        expect(admitted.ok).toBe(true);
        expect(getActiveAgentTurns()).toBe(4);
        unpark();
        // 주차 턴이 돌아와 일하는 턴이 5가 된다 — 이미 들어온 턴은 그대로다.
        expect(getActiveAgentTurns()).toBe(5);
    });

    it('중첩 주차는 마지막 해제까지 한 턴으로 센다', async () => {
        const [slot] = await takeMany(1);
        const a = slot.park();
        const b = slot.park();
        expect(getActiveAgentTurns()).toBe(0);
        a();
        expect(getActiveAgentTurns()).toBe(0);
        b();
        expect(getActiveAgentTurns()).toBe(1);
    });

    it('release와 unpark는 멱등이다', async () => {
        const [slot] = await takeMany(1);
        const other = await take();
        const unpark = slot.park();
        unpark();
        unpark();
        expect(getActiveAgentTurns()).toBe(2);
        slot.release();
        slot.release();
        expect(getActiveAgentTurns()).toBe(1);
        other.release();
        expect(getActiveAgentTurns()).toBe(0);
    });

    it('주차한 채 반납하면 주차 수도 함께 줄고, 반납 뒤의 unpark·park는 아무것도 바꾸지 않는다', async () => {
        const [slot] = await takeMany(1);
        const unpark = slot.park();
        slot.release();
        expect(getActiveAgentTurns()).toBe(0);
        unpark();
        slot.park()();
        expect(getActiveAgentTurns()).toBe(0);
        // 카운터가 어긋났다면 이 4개가 다 들어오지 못한다.
        await takeMany(MAX_ACTIVE_AGENT_TURNS);
        expect(getActiveAgentTurns()).toBe(4);
    });

    it('줄이 차면 기다리지 않고 queue_full로 거절한다', async () => {
        await takeMany(MAX_ACTIVE_AGENT_TURNS);
        Array.from({ length: AGENT_TURN_QUEUE_MAX }, () =>
            acquireTurnSlot({
                signal: new AbortController().signal,
                canAcceptStream: open,
            })
        );
        expect(getQueuedAgentTurns()).toBe(AGENT_TURN_QUEUE_MAX);

        const refused = await acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        expect(refused).toMatchObject({
            ok: false,
            reason: 'queue_full',
            blockedBy: 'agent_turn_slots',
            waitedMs: 0,
        });
        expect(getQueuedAgentTurns()).toBe(AGENT_TURN_QUEUE_MAX);
    });

    it('15초 안에 자리가 안 나면 queue_timeout으로 거절하고 줄에서 빠진다', async () => {
        await takeMany(MAX_ACTIVE_AGENT_TURNS);
        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        vi.advanceTimersByTime(AGENT_TURN_QUEUE_WAIT_MS - 1);
        expect(getQueuedAgentTurns()).toBe(1);
        vi.advanceTimersByTime(1);

        await expect(waiting).resolves.toEqual({
            ok: false,
            reason: 'queue_timeout',
            blockedBy: 'agent_turn_slots',
            waitedMs: AGENT_TURN_QUEUE_WAIT_MS,
        });
        expect(getQueuedAgentTurns()).toBe(0);
    });

    it('줄에서 끊긴 요청은 빠지고 다음 사람이 들어온다', async () => {
        const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        const gone = new AbortController();
        const first = acquireTurnSlot({
            signal: gone.signal,
            canAcceptStream: open,
        });
        const second = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });

        gone.abort();
        await expect(first).resolves.toMatchObject({
            ok: false,
            reason: 'aborted',
        });
        expect(getQueuedAgentTurns()).toBe(1);
        slots[0].release();
        await expect(second).resolves.toMatchObject({ ok: true });
    });

    it('이미 끊긴 요청은 줄에 서지 않고 자리가 있어도 받지 않는다', async () => {
        const gone = new AbortController();
        gone.abort();
        const result = await acquireTurnSlot({
            signal: gone.signal,
            canAcceptStream: open,
        });
        expect(result).toMatchObject({ ok: false, reason: 'aborted' });
        expect(getActiveAgentTurns()).toBe(0);
        expect(getQueuedAgentTurns()).toBe(0);
    });

    it('분석 스트림 슬롯이 막고 있으면 대기하고, 1초 재확인으로 풀리면 들어온다', async () => {
        const streamsOpen = vi.fn(() => false);
        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: streamsOpen,
        });
        expect(getQueuedAgentTurns()).toBe(1);
        vi.advanceTimersByTime(2_500);
        expect(getQueuedAgentTurns()).toBe(1);

        streamsOpen.mockReturnValue(true);
        vi.advanceTimersByTime(1_000);
        const result = await waiting;
        expect(result).toMatchObject({ ok: true });
        expect(getQueuedAgentTurns()).toBe(0);
        // 줄이 비면 재확인 타이머도 멈춘다.
        expect(vi.getTimerCount()).toBe(0);
    });

    it('분석 스트림 슬롯이 끝내 안 풀리면 blockedBy가 analysis_stream_slots다', async () => {
        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: () => false,
        });
        vi.advanceTimersByTime(AGENT_TURN_QUEUE_WAIT_MS);
        await expect(waiting).resolves.toMatchObject({
            ok: false,
            reason: 'queue_timeout',
            blockedBy: 'analysis_stream_slots',
        });
    });

    it('주차한 턴이 10개여도 들어온 턴은 14를 넘지 않는다', async () => {
        const parkedTurns = await takeParked(MAX_CONCURRENT_FRESH);
        // 일하는 턴 4개를 더 채우면 들어온 턴이 14가 된다.
        const working = await takeMany(MAX_ACTIVE_AGENT_TURNS);
        expect(getActiveAgentTurns()).toBe(4);

        // 14번째까지 들어왔으니 일하는 턴 한 자리가 비어도 하드 상한 때문에 15번째는 못 들어온다.
        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        working[0].park();
        expect(getQueuedAgentTurns()).toBe(1);
        // 주차한 턴 하나가 끝나 들어온 턴이 13이 되면 들어온다.
        parkedTurns[0].release();
        await expect(waiting).resolves.toMatchObject({ ok: true });
        expect(getActiveAgentTurns()).toBe(4);
    });

    it('테스트 초기화는 줄에 남은 대기자의 타이머와 abort 리스너까지 정리한다', async () => {
        await takeMany(MAX_ACTIVE_AGENT_TURNS);
        const controller = new AbortController();
        const settled = vi.fn();
        void acquireTurnSlot({
            signal: controller.signal,
            canAcceptStream: open,
        }).then(settled);
        expect(getQueuedAgentTurns()).toBe(1);
        expect(vi.getTimerCount()).toBeGreaterThan(0);

        __resetTurnSlotsForTests();

        expect(getQueuedAgentTurns()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        controller.abort();
        await vi.advanceTimersByTimeAsync(AGENT_TURN_QUEUE_WAIT_MS);
        expect(settled).not.toHaveBeenCalled();
        expect(getActiveAgentTurns()).toBe(0);
    });

    it('일하는 턴이 0이어도 들어온 턴이 14면 받지 않는다', async () => {
        const parkedTurns = await takeParked(MAX_ADMITTED_AGENT_TURNS);
        expect(getActiveAgentTurns()).toBe(0);

        const waiting = acquireTurnSlot({
            signal: new AbortController().signal,
            canAcceptStream: open,
        });
        expect(getQueuedAgentTurns()).toBe(1);
        parkedTurns[0].release();
        await expect(waiting).resolves.toMatchObject({ ok: true });
    });

    describe('맨 앞 대기자가 나가면 뒤 대기자를 바로 들여보낸다', () => {
        const blocked = () => false;

        it('끊기면 1초 재확인을 기다리지 않는다', async () => {
            const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
            const gone = new AbortController();
            void acquireTurnSlot({
                signal: gone.signal,
                canAcceptStream: blocked,
            });
            const behind = acquireTurnSlot({
                signal: new AbortController().signal,
                canAcceptStream: open,
            });
            // 자리는 났지만 맨 앞이 분석 스트림 때문에 못 들어가 둘 다 줄에 있다.
            slots[0].release();
            expect(getQueuedAgentTurns()).toBe(2);

            gone.abort();
            await expect(behind).resolves.toMatchObject({ ok: true });
        });

        it('시간 초과로 나가도 재확인 틱을 기다리지 않는다', async () => {
            const slots = await takeMany(MAX_ACTIVE_AGENT_TURNS);
            const firstGone = new AbortController();
            // 이 대기자가 재확인 타이머를 시작한다(틱: 1000, 2000, ...).
            void acquireTurnSlot({
                signal: firstGone.signal,
                canAcceptStream: blocked,
            });
            vi.advanceTimersByTime(300);
            const head = acquireTurnSlot({
                signal: new AbortController().signal,
                canAcceptStream: blocked,
            });
            const behind = acquireTurnSlot({
                signal: new AbortController().signal,
                canAcceptStream: open,
            });
            firstGone.abort();
            slots[0].release();
            expect(getQueuedAgentTurns()).toBe(2);

            // head의 시간 초과는 15300ms — 틱(15000, 16000)과 겹치지 않는다.
            vi.advanceTimersByTime(AGENT_TURN_QUEUE_WAIT_MS);
            await expect(head).resolves.toMatchObject({
                ok: false,
                reason: 'queue_timeout',
            });
            await expect(behind).resolves.toMatchObject({ ok: true });
        });
    });
});
