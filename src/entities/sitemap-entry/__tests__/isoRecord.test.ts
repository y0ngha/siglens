import { fromIsoRecord, toIsoRecord } from '../lib/isoRecord';

describe('toIsoRecord', () => {
    it('Date 값을 ISO 문자열로 바꾼다', () => {
        expect(
            toIsoRecord({ tos: new Date('2026-03-01T00:00:00.000Z') })
        ).toEqual({ tos: '2026-03-01T00:00:00.000Z' });
    });

    it('값이 undefined면 건너뛰지 않고 던진다', () => {
        expect(() =>
            toIsoRecord({
                tos: new Date('2026-03-01T00:00:00.000Z'),
                privacy: undefined,
            })
        ).toThrow(TypeError);
    });

    it('빈 레코드는 빈 레코드다', () => {
        expect(toIsoRecord({})).toEqual({});
    });
});

describe('fromIsoRecord', () => {
    it('ISO 문자열을 Date로 복원한다', () => {
        const restored = fromIsoRecord({ tos: '2026-03-01T00:00:00.000Z' });

        expect(restored.tos).toBeInstanceOf(Date);
        expect(restored.tos?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('값이 없으면 건너뛰지 않고 Invalid Date로 복원한다', () => {
        const restored = fromIsoRecord({ tos: undefined });

        expect(Object.keys(restored)).toEqual(['tos']);
        expect(Number.isNaN(restored.tos?.getTime())).toBe(true);
    });

    it('JSON 왕복 뒤에도 원래 Date와 같다', () => {
        const original = { general: new Date('2026-09-17T12:34:56.789Z') };
        const roundTripped: unknown = JSON.parse(
            JSON.stringify(toIsoRecord(original))
        );

        expect(roundTripped).toEqual({ general: '2026-09-17T12:34:56.789Z' });
        expect(fromIsoRecord(toIsoRecord(original))).toEqual(original);
    });
});
