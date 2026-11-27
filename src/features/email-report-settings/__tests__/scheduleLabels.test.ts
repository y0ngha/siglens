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

    it('긴 요일 이름은 문장에 넣을 수 있게 로케일의 전체 이름이다', () => {
        expect(createScheduleLabelFormatters('ko-KR').weekdayLong(1)).toBe(
            '월요일'
        );
        expect([0, 1, 6].map(day => en.weekdayLong(day as 0 | 1 | 6))).toEqual([
            'Sunday',
            'Monday',
            'Saturday',
        ]);
    });

    it('분 없는 시각은 문장에 넣을 수 있게 시만 적는다', () => {
        expect(createScheduleLabelFormatters('ko-KR').hourOnly(8)).toBe(
            '오전 8시'
        );
        expect([0, 8, 21].map(en.hourOnly)).toEqual(['12 AM', '8 AM', '9 PM']);
        // 방침 문구(毎週月曜日の午前8時, 每周一上午8点)와 같은 표기.
        expect(createScheduleLabelFormatters('ja-JP').hourOnly(8)).toBe(
            '午前8時'
        );
        expect(createScheduleLabelFormatters('zh-CN').hourOnly(8)).toBe(
            '上午8点'
        );
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
