import {
    formatClose,
    formatConsentAt,
    formatDate,
    formatPercent,
    formatSchedule,
    formatSignedPercent,
    formatTimeZoneName,
} from '@/entities/email-report/templates/emailFormat';
import { INTL_LOCALE } from '@/shared/i18n/locales';

/** ICU가 주는 시간대 이름을 테스트 안에서 같은 API·옵션으로 구한다(문구를 박아 두지 않는다). */
function expectedZoneName(
    timeZone: string,
    locale: 'ko' | 'en'
): string | undefined {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone,
        timeZoneName: 'longGeneric',
    })
        .formatToParts(new Date('2024-01-07T00:00:00Z'))
        .find(part => part.type === 'timeZoneName')?.value;
}

describe('formatDate', () => {
    it('발송일을 로케일의 "월 일" 꼴로 쓴다', () => {
        expect(formatDate('2026-10-14', 'ko')).toBe('10월 14일');
        expect(formatDate('2026-10-14', 'en')).toBe('October 14');
    });
});

describe('formatPercent', () => {
    it('이미 퍼센트 단위인 값에 자릿수만 맞춰 %를 붙인다', () => {
        expect(formatPercent(28.456, 1)).toBe('28.5%');
    });
});

describe('formatSignedPercent', () => {
    it.each([
        [1.234, '+1.23%'],
        [0, '0.00%'],
        [-0.5, '-0.50%'],
    ])('%s -> %s', (value, expected) => {
        expect(formatSignedPercent(value)).toBe(expected);
    });
});

describe('formatClose', () => {
    it('천 단위 구분과 소수 둘째 자리까지 쓴다', () => {
        expect(formatClose(1234.5678, 'en')).toBe('1,234.57');
    });
});

describe('formatSchedule', () => {
    it('ko 월요일 8시는 요일 이름과 12시간제 시각으로 쓴다', () => {
        expect(formatSchedule(0b0000010, 8, 'ko')).toEqual({
            days: '월요일',
            time: '오전 8:00',
        });
    });

    it('여러 요일은 월요일부터 순서대로 로케일의 접속 규칙으로 잇는다', () => {
        // 일(0)·월(1)·금(5): 월요일 시작 순서는 월, 금, 일.
        const mask = (1 << 0) | (1 << 1) | (1 << 5);

        expect(formatSchedule(mask, 8, 'en').days).toBe(
            'Monday, Friday, and Sunday'
        );
        expect(formatSchedule(mask, 8, 'ko').days).toBe(
            '월요일, 금요일 및 일요일'
        );
    });

    it('en 로케일은 영어 요일과 AM/PM 시각으로 쓴다', () => {
        expect(formatSchedule(0b0000010, 21, 'en')).toEqual({
            days: 'Monday',
            time: '9:00 PM',
        });
    });

    it('요일이 하나도 없으면 빈 문자열이다', () => {
        expect(formatSchedule(0, 8, 'ko').days).toBe('');
    });
});

describe('formatTimeZoneName', () => {
    it('ko Asia/Seoul은 ICU가 주는 한국어 이름이고 IANA 이름이 아니다', () => {
        const name = formatTimeZoneName('Asia/Seoul', 'ko');

        expect(name).toBe(expectedZoneName('Asia/Seoul', 'ko'));
        expect(name).not.toBe('Asia/Seoul');
    });

    it('en 로케일은 영어 이름을 쓴다', () => {
        expect(formatTimeZoneName('America/New_York', 'en')).toBe(
            'Eastern Time'
        );
    });

    it('모르는 시간대는 IANA 이름을 그대로 돌려준다', () => {
        expect(formatTimeZoneName('Mars/Base', 'ko')).toBe('Mars/Base');
    });
});

describe('formatConsentAt', () => {
    const consentedAt = new Date('2026-11-21T00:30:00.000Z');

    it('회원 시간대의 날짜와 시각으로 쓴다', () => {
        expect(formatConsentAt(consentedAt, 'Asia/Seoul', 'ko')).toBe(
            '2026년 11월 21일 오전 9:30'
        );
        expect(formatConsentAt(consentedAt, 'America/New_York', 'en')).toBe(
            'November 20, 2026 at 7:30 PM'
        );
    });

    it('모르는 시간대는 UTC로 쓴다', () => {
        expect(formatConsentAt(consentedAt, 'Mars/Base', 'ko')).toBe(
            '2026년 11월 21일 오전 12:30'
        );
    });
});
