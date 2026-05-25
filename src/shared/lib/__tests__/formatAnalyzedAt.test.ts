import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';

describe('formatAnalyzedAt', () => {
    it('UTC ISO 를 KST(+09:00) YYYY-MM-DD HH:mm 으로 환산한다', () => {
        // 2026-05-22 05:30 UTC = 2026-05-22 14:30 KST
        expect(formatAnalyzedAt('2026-05-22T05:30:00.000Z')).toBe(
            '2026-05-22 14:30'
        );
    });

    it('자정 경계에서 KST 날짜가 한 칸 앞당겨진다', () => {
        // 2026-05-21 15:00 UTC = 2026-05-22 00:00 KST
        expect(formatAnalyzedAt('2026-05-21T15:00:00.000Z')).toBe(
            '2026-05-22 00:00'
        );
    });

    it('연말 23:00 UTC 는 KST 익년 08:00 으로 변환된다', () => {
        // 2025-12-31 23:00 UTC = 2026-01-01 08:00 KST
        expect(formatAnalyzedAt('2025-12-31T23:00:00.000Z')).toBe(
            '2026-01-01 08:00'
        );
    });

    it('잘못된 ISO 입력은 16자로 잘라 fallback 한다 (기존 동작 호환)', () => {
        expect(formatAnalyzedAt('not-a-date')).toBe('not-a-date');
    });

    it('빈 문자열도 안전하게 처리된다', () => {
        expect(formatAnalyzedAt('')).toBe('');
    });

    it('missing part type falls back to empty string', () => {
        // Simulate a broken ICU formatter that omits the "minute" part
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
            .mockReturnValueOnce([
                { type: 'year', value: '2026' },
                { type: 'literal', value: '-' },
                { type: 'month', value: '05' },
                { type: 'literal', value: '-' },
                { type: 'day', value: '22' },
                { type: 'literal', value: ', ' },
                { type: 'hour', value: '14' },
                // "minute" part is deliberately missing
            ]);
        try {
            // The missing minute falls back to '' via the ?? '' branch
            expect(formatAnalyzedAt('2026-05-22T05:30:00.000Z')).toBe(
                '2026-05-22 14:'
            );
        } finally {
            spy.mockRestore();
        }
    });

    it("ICU hour='24' edge case 를 '00' 으로 정규화한다", () => {
        // 일부 Node/ICU 버전은 hour12:false + 자정에 '24'를 emit한다. V8 en-US 에선
        // 직접 trigger할 수 없으므로 formatToParts 를 spy 로 가로채 '24'를 강제로
        // 주입해 정규화 분기를 검증한다 (MISTAKES.md Tests §18).
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
            .mockReturnValueOnce([
                { type: 'year', value: '2026' },
                { type: 'literal', value: '-' },
                { type: 'month', value: '05' },
                { type: 'literal', value: '-' },
                { type: 'day', value: '22' },
                { type: 'literal', value: ', ' },
                { type: 'hour', value: '24' },
                { type: 'literal', value: ':' },
                { type: 'minute', value: '00' },
            ]);
        try {
            expect(formatAnalyzedAt('2026-05-21T15:00:00.000Z')).toBe(
                '2026-05-22 00:00'
            );
        } finally {
            spy.mockRestore();
        }
    });
});
