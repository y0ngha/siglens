import { createScheduleLabelFormatters } from '@/features/email-report-settings/lib/scheduleLabels';

describe('createScheduleLabelFormatters', () => {
    const en = createScheduleLabelFormatters('en-US');

    it('요일 값(0=일요일)을 로케일의 짧은 요일 이름으로 바꾼다', () => {
        expect([0, 1, 6].map(day => en.weekday(day as 0 | 1 | 6))).toEqual([
            'Sun',
            'Mon',
            'Sat',
        ]);
    });

    it('시각을 로케일의 정각 표기로 바꾼다', () => {
        expect([0, 8, 21].map(en.hour)).toEqual([
            '12:00 AM',
            '8:00 AM',
            '9:00 PM',
        ]);
    });

    it('한국어 로케일은 한국어 요일을 쓴다', () => {
        expect(createScheduleLabelFormatters('ko-KR').weekday(1)).toBe('월');
    });
});
