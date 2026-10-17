import { describe, expect, it } from 'vitest';
import { createCallPacer } from '../../lib/callPacer';

function fakeClock() {
    const clock = {
        ms: 0,
        sleeps: [] as number[],
        nowMs: () => clock.ms,
        sleep: async (ms: number) => {
            clock.sleeps.push(ms);
            clock.ms += ms;
        },
    };
    return clock;
}

describe('createCallPacer', () => {
    it('starts the first batch immediately', async () => {
        const clock = fakeClock();
        await createCallPacer(120, clock)(3);
        expect(clock.sleeps).toEqual([]);
    });

    it('waits calls × (60s / rate) after each batch start before the next one', async () => {
        const clock = fakeClock();
        const pace = createCallPacer(120, clock);
        await pace(3);
        await pace(3);
        await pace(1);
        await pace(3);
        // 3 calls at 120/min = 1.5s, 1 call = 0.5s
        expect(clock.sleeps).toEqual([1_500, 1_500, 500]);
    });

    it('does not wait when the batch itself took longer than its spacing', async () => {
        const clock = fakeClock();
        const pace = createCallPacer(120, clock);
        await pace(3);
        clock.ms += 5_000; // slow FMP responses
        await pace(3);
        expect(clock.sleeps).toEqual([]);
    });

    it('never exceeds the rate over many batches', async () => {
        const clock = fakeClock();
        const pace = createCallPacer(120, clock);
        for (let i = 0; i < 40; i += 1) await pace(3);
        // 120 calls: the 40th batch starts after 39 spacings of 1.5s
        expect(clock.ms).toBe(39 * 1_500);
    });
});
