import {
    createStartSpacer,
    type StartSpacerClock,
} from '@/shared/lib/startSpacer';

/** 시각을 직접 움직이는 가짜 시계 — `sleep`은 약속한 시각이 오면 풀린다. */
function fakeClock(): StartSpacerClock & {
    advance(ms: number): Promise<void>;
} {
    const state = {
        time: 1_000,
        sleepers: [] as { wakeAt: number; resolve: () => void }[],
    };
    return {
        now: () => state.time,
        sleep: ms =>
            new Promise<void>(resolve => {
                state.sleepers = [
                    ...state.sleepers,
                    { wakeAt: state.time + ms, resolve },
                ];
            }),
        advance: async ms => {
            state.time += ms;
            const due = state.sleepers.filter(s => s.wakeAt <= state.time);
            state.sleepers = state.sleepers.filter(s => s.wakeAt > state.time);
            due.forEach(s => s.resolve());
            await Promise.resolve();
        },
    };
}

describe('createStartSpacer', () => {
    it('첫 호출은 기다리지 않는다', async () => {
        const spacer = createStartSpacer(300, fakeClock());

        await expect(spacer.next()).resolves.toBeUndefined();
    });

    it('앞선 시작 뒤 최소 간격이 지나야 풀리고, 부른 순서대로 풀린다', async () => {
        const clock = fakeClock();
        const spacer = createStartSpacer(300, clock);
        const order = { released: [] as string[] };
        const track = (name: string) =>
            spacer.next().then(() => {
                order.released = [...order.released, name];
            });

        const first = track('first');
        const second = track('second');
        const third = track('third');
        await first;
        expect(order.released).toEqual(['first']);

        await clock.advance(299);
        expect(order.released).toEqual(['first']);

        await clock.advance(1);
        await second;
        expect(order.released).toEqual(['first', 'second']);

        await clock.advance(300);
        await third;
        expect(order.released).toEqual(['first', 'second', 'third']);
    });

    it('한참 쉰 뒤의 호출은 쌓인 빚 없이 바로 풀린다', async () => {
        const clock = fakeClock();
        const spacer = createStartSpacer(300, clock);
        await spacer.next();
        await clock.advance(10_000);

        const sleep = vi.spyOn(clock, 'sleep');
        await spacer.next();

        expect(sleep).not.toHaveBeenCalled();
    });

    it('같은 틱에 몰려도 칸을 서로 다르게 받는다(간격의 배수만큼 기다린다)', async () => {
        const clock = fakeClock();
        const sleep = vi.spyOn(clock, 'sleep');
        const spacer = createStartSpacer(250, clock);

        void spacer.next();
        void spacer.next();
        void spacer.next();

        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([250, 500]);
    });

    it('기본 시계는 실제 시간으로 간격을 둔다', async () => {
        vi.useFakeTimers();
        const spacer = createStartSpacer(300);
        await spacer.next();
        const second = vi.fn();
        void spacer.next().then(second);

        await vi.advanceTimersByTimeAsync(299);
        expect(second).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(second).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
