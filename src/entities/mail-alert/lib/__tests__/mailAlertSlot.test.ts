import { MAIL_ALERT_SEND_HOURS_KST } from '../mailAlertConstants';
import {
    mailAlertDate,
    mailAlertIdempotencyKey,
    mailAlertSlot,
} from '../mailAlertSlot';

/** KST `hour:minute`를 UTC 시각으로(KST = UTC+9, 2026-11-25 기준). */
function kst(hour: number, minute = 0): Date {
    return new Date(Date.UTC(2026, 10, 24, hour - 9, minute));
}

describe('mailAlertSlot', () => {
    it('첫 시각은 first, 마지막 시각은 final이다', () => {
        const [firstHour, finalHour] = MAIL_ALERT_SEND_HOURS_KST;

        expect(mailAlertSlot(kst(firstHour))).toBe('first');
        expect(mailAlertSlot(kst(firstHour, 59))).toBe('first');
        expect(mailAlertSlot(kst(finalHour))).toBe('final');
        expect(mailAlertSlot(kst(finalHour, 59))).toBe('final');
    });

    it('그 밖의 시각은 null이다', () => {
        const [firstHour, finalHour] = MAIL_ALERT_SEND_HOURS_KST;

        expect(mailAlertSlot(kst(firstHour - 1, 59))).toBeNull();
        expect(mailAlertSlot(kst(finalHour + 1))).toBeNull();
        expect(mailAlertSlot(kst(23))).toBeNull();
        expect(mailAlertSlot(kst(0))).toBeNull();
    });

    it('UTC 자정을 걸친 한국 시각도 한국 시(hour)로 센다', () => {
        // 2026-11-24T22:05Z = 2026-11-25 07:05 KST
        expect(mailAlertSlot(new Date('2026-11-24T22:05:00Z'))).toBe('first');
        expect(mailAlertSlot(new Date('2026-11-24T23:05:00Z'))).toBe('final');
    });
});

describe('mailAlertDate', () => {
    it('발송 시점의 한국 날짜다', () => {
        expect(mailAlertDate(new Date('2026-11-24T22:05:00Z'))).toBe(
            '2026-11-25'
        );
        expect(mailAlertDate(new Date('2026-11-24T14:59:00Z'))).toBe(
            '2026-11-24'
        );
    });
});

describe('mailAlertIdempotencyKey', () => {
    it('구독자와 알림 날짜가 키이고 슬롯은 키에 없다(두 슬롯이 같은 키)', () => {
        expect(mailAlertIdempotencyKey('sub-1', '2026-11-25')).toBe(
            'mail-alert/sub-1/2026-11-25'
        );
    });
});
