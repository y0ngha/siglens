import { latestOf } from '../lib/latestOf';

const FALLBACK = new Date('2026-01-01T00:00:00.000Z');
const EARLY = new Date('2026-05-01T00:00:00.000Z');
const LATE = new Date('2026-06-01T00:00:00.000Z');

describe('latestOf', () => {
    it('가장 늦은 후보를 고른다', () => {
        expect(latestOf([EARLY, LATE, undefined], FALLBACK)).toBe(LATE);
    });

    it('undefined 후보는 건너뛴다', () => {
        expect(latestOf([undefined, EARLY], FALLBACK)).toBe(EARLY);
    });

    it('알려진 후보가 없으면 fallback 객체를 그대로 돌려준다', () => {
        expect(latestOf([undefined], FALLBACK)).toBe(FALLBACK);
        expect(latestOf([], FALLBACK)).toBe(FALLBACK);
    });

    it('동률이면 앞선 후보를 유지한다', () => {
        const same = new Date(EARLY.getTime());

        expect(latestOf([EARLY, same], FALLBACK)).toBe(EARLY);
    });
});
