import { describe, expect, it } from 'vitest';
import { formatTradeTime } from '@/widgets/extended-hours/utils/formatTradeTime';

describe('formatTradeTime', () => {
    it('체결 시각을 ET 벽시계 HH:mm으로 보여 준다(EDT)', () => {
        expect(formatTradeTime(Date.UTC(2026, 9, 15, 11, 7, 12), 'ko')).toBe(
            '07:07'
        );
    });

    it('겨울(EST)에는 UTC-5로 환산한다', () => {
        expect(formatTradeTime(Date.UTC(2026, 11, 14, 14, 5), 'ko')).toBe(
            '09:05'
        );
    });

    it('오후 시각도 24시간제로 나온다', () => {
        expect(formatTradeTime(Date.UTC(2026, 9, 15, 23, 59), 'en')).toBe(
            '19:59'
        );
    });

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s 로케일에서도 같은 형식이다',
        locale => {
            expect(formatTradeTime(Date.UTC(2026, 9, 15, 20, 0), locale)).toBe(
                '16:00'
            );
        }
    );
});
