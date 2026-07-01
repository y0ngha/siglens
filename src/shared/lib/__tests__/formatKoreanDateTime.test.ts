import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';

describe('formatKoreanDateTime', () => {
    it('UTC ISO를 KST(+09:00) 기준 한국어 날짜+시간으로 변환한다', () => {
        // 2026-06-30 14:47:00 UTC = 2026-06-30 23:47 KST
        expect(formatKoreanDateTime('2026-06-30T14:47:00.000Z')).toBe(
            '2026년 6월 30일 23시 47분'
        );
    });

    it('날짜 롤오버 — KST 날짜가 UTC 날짜보다 하루 앞당겨진다', () => {
        // 2026-05-21 15:00 UTC = 2026-05-22 00:00 KST
        expect(formatKoreanDateTime('2026-05-21T15:00:00.000Z')).toBe(
            '2026년 5월 22일 00시 00분'
        );
    });

    it('월/일/시는 leading-zero 없이 표기된다', () => {
        // 2026-01-05 02:05 UTC = 2026-01-05 11:05 KST
        expect(formatKoreanDateTime('2026-01-05T02:05:00.000Z')).toBe(
            '2026년 1월 5일 11시 05분'
        );
    });

    it('연말 UTC가 KST 익년으로 넘어간다', () => {
        // 2025-12-31 23:00 UTC = 2026-01-01 08:00 KST
        expect(formatKoreanDateTime('2025-12-31T23:00:00.000Z')).toBe(
            '2026년 1월 1일 08시 00분'
        );
    });

    it('잘못된 ISO 입력은 원본 문자열을 그대로 반환한다', () => {
        expect(formatKoreanDateTime('not-a-date')).toBe('not-a-date');
    });

    it('빈 문자열은 빈 문자열을 반환한다', () => {
        expect(formatKoreanDateTime('')).toBe('');
    });

    it("ICU hour='24' edge case를 '0'으로 정규화한다", () => {
        // 자정(00:00 KST)을 '24'로 반환하는 일부 ICU 버전 대응
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
            .mockReturnValueOnce([
                { type: 'year', value: '2026' },
                { type: 'literal', value: '년 ' },
                { type: 'month', value: '5' },
                { type: 'literal', value: '월 ' },
                { type: 'day', value: '22' },
                { type: 'literal', value: '일 ' },
                { type: 'hour', value: '24' },
                { type: 'literal', value: ':' },
                { type: 'minute', value: '00' },
            ]);
        try {
            expect(formatKoreanDateTime('2026-05-21T15:00:00.000Z')).toBe(
                '2026년 5월 22일 0시 00분'
            ); // normalised from '24' → '0' via the rawHour === '24' branch
        } finally {
            spy.mockRestore();
        }
    });
});
