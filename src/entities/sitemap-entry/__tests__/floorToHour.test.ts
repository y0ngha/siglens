import { describe, expect, it } from 'vitest';

import { floorToHour } from '../lib/floorToHour';

describe('floorToHour', () => {
    it('분·초·밀리초를 0으로 내림한다', () => {
        expect(
            floorToHour(new Date('2026-05-23T20:47:12.345Z')).toISOString()
        ).toBe('2026-05-23T20:00:00.000Z');
    });

    it('이미 정시인 값은 그대로 유지한다', () => {
        expect(
            floorToHour(new Date('2026-05-23T20:00:00.000Z')).toISOString()
        ).toBe('2026-05-23T20:00:00.000Z');
    });

    it('같은 시간대 안의 서로 다른 두 시각은 동일한 결과를 낸다', () => {
        const a = floorToHour(new Date('2026-05-23T20:01:00.000Z'));
        const b = floorToHour(new Date('2026-05-23T20:59:59.999Z'));
        expect(a.getTime()).toBe(b.getTime());
    });

    it('시간대가 바뀌면 결과도 바뀐다', () => {
        const a = floorToHour(new Date('2026-05-23T20:59:59.999Z'));
        const b = floorToHour(new Date('2026-05-23T21:00:00.000Z'));
        expect(a.getTime()).not.toBe(b.getTime());
    });
});
