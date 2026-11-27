import { KST_OFFSET_HOURS, HOURS_PER_DAY } from '@/shared/config/time';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { MAIL_ALERT_SEND_HOURS_KST } from './mailAlertConstants';

/**
 * 발송 슬롯. `first`는 첫 시각(소스가 덜 준비됐으면 통째로 미룬다), `final`은 마지막 재시도 시각(준비된
 * 소스만으로 보낸다). 그 밖의 시각은 `null`이다.
 */
export type MailAlertSlot = 'first' | 'final';

/** KST는 서머타임이 없어 UTC 시각에 고정 오프셋만 더하면 된다. */
function kstHour(now: Date): number {
    return (now.getUTCHours() + KST_OFFSET_HOURS) % HOURS_PER_DAY;
}

/**
 * 지금이 알림 메일 발송 시각이면 그 슬롯, 아니면 `null`. 시간당 한 번 도는 cron이 매시 이 함수로 거른다 —
 * 시(hour)만 보므로 같은 시간 안의 재실행(수동 포함)도 같은 슬롯이다.
 */
export function mailAlertSlot(now: Date): MailAlertSlot | null {
    const [firstHour, finalHour] = MAIL_ALERT_SEND_HOURS_KST;
    const hour = kstHour(now);
    if (hour === firstHour) return 'first';
    if (hour === finalHour) return 'final';
    return null;
}

/** 알림 날짜 = 발송 시점의 KST 날짜. 하루 한 통 선점과 반복 방지 창이 이 날짜로 센다. */
export function mailAlertDate(now: Date): string {
    return kstDateKey(now);
}

/**
 * 메일 제공자에 넘기는 멱등 키. 발송 기록 선점이 1차 방어이고, 기록 행이 지워지거나 선점이 겹쳐 같은 구독자·
 * 같은 알림 날짜의 메일이 두 번 시도돼도 제공자가 두 번째를 새 메일로 만들지 않게 하는 2차 방어다.
 * 07시 슬롯과 08시 최종 슬롯이 같은 키를 쓰므로 같은 날 두 슬롯이 겹쳐도 한 통이다.
 */
export function mailAlertIdempotencyKey(
    subscriberId: string,
    alertDate: string
): string {
    return `mail-alert/${subscriberId}/${alertDate}`;
}
