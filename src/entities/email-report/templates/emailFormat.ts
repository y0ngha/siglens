import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * 회원 로컬 발송일(`YYYY-MM-DD`)을 "10월 14일" 꼴로 쓴다. 정오 UTC로 만들어 어느
 * 타임존에서 포맷해도 날짜가 하루 밀리지 않게 한다.
 */
export function formatDate(localDate: string, locale: Locale): string {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${localDate}T12:00:00Z`));
}

/** `value`는 이미 퍼센트 단위다(0.28이 아니라 28). 소수 자릿수는 호출자가 정한다. */
export function formatPercent(value: number, digits: number): string {
    return `${value.toFixed(digits)}%`;
}

/** 양수에만 `+`를 붙인다 — 0과 음수는 `toFixed`가 쓴 그대로다. */
export function formatSignedPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatPercent(value, 2)}`;
}

/** 요약 표의 종가 — 천 단위 구분과 소수 둘째 자리까지, 수신자 로케일 규칙대로. */
export function formatClose(value: number, locale: Locale): string {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: 2,
    }).format(value);
}
