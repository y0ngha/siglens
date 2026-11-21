import { MS_PER_DAY } from '@/shared/config/time';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { WEEKDAYS_MONDAY_FIRST } from '../lib/emailReportConstants';
import { maskToWeekdays } from '../lib/weekdayMask';

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

/** 로케일별 "A, B 및 C" 접속 규칙 — 모듈에서 한 번만 만든다. */
const LIST_FORMATS: Record<Locale, Intl.ListFormat> = {
    ko: new Intl.ListFormat(INTL_LOCALE.ko, { type: 'conjunction' }),
    en: new Intl.ListFormat(INTL_LOCALE.en, { type: 'conjunction' }),
    ja: new Intl.ListFormat(INTL_LOCALE.ja, { type: 'conjunction' }),
    zh: new Intl.ListFormat(INTL_LOCALE.zh, { type: 'conjunction' }),
};

// 2024-01-07은 일요일 — `Date#getDay()`가 n인 날짜를 만들려고 n일을 더한다.
const SUNDAY_UTC = Date.UTC(2024, 0, 7);

/**
 * 수신 일정을 문장에 끼울 조각으로 만든다. `days`는 월요일부터 순서대로 긴 요일 이름을 로케일의
 * 접속 규칙으로 이은 것(예: ko `월요일`, en `Monday and Friday`), `time`은 회원 로컬 정각
 * (예: ko `오전 8:00`). 라벨은 카탈로그가 아니라 `Intl`로 만든다 — 네 로케일을 손으로 옮기면
 * 번역 드리프트만 생긴다(설정 화면 `scheduleLabels`와 같은 이유).
 */
export function formatSchedule(
    daysMask: number,
    sendHour: number,
    locale: Locale
): { days: string; time: string } {
    const intlLocale = INTL_LOCALE[locale];
    const selected = new Set(maskToWeekdays(daysMask));
    const weekdayName = cachedDateTimeFormat(intlLocale, {
        weekday: 'long',
        timeZone: 'UTC',
    });
    const names = WEEKDAYS_MONDAY_FIRST.filter(day => selected.has(day)).map(
        day => weekdayName.format(new Date(SUNDAY_UTC + day * MS_PER_DAY))
    );
    const time = cachedDateTimeFormat(intlLocale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, 1, sendHour)));
    return {
        days: LIST_FORMATS[locale].format(names),
        time,
    };
}

/**
 * IANA 시간대의 사람이 읽는 이름(예: ko `대한민국 시간`). 런타임이 모르는 시간대면 IANA 이름을
 * 그대로 돌려준다 — 메일 한 통 때문에 발송이 멈추지 않게 한다.
 */
export function formatTimeZoneName(timeZone: string, locale: Locale): string {
    try {
        return (
            cachedDateTimeFormat(INTL_LOCALE[locale], {
                timeZone,
                timeZoneName: 'longGeneric',
            })
                .formatToParts(new Date(SUNDAY_UTC))
                .find(part => part.type === 'timeZoneName')?.value ?? timeZone
        );
    } catch {
        return timeZone;
    }
}

/** 수신 동의 시각을 회원 시간대로 "2026년 11월 21일 오전 9:30" 꼴로 쓴다. 시간대를 모르면 UTC로 쓴다. */
export function formatConsentAt(
    date: Date,
    timeZone: string,
    locale: Locale
): string {
    const format = (zone: string) =>
        cachedDateTimeFormat(INTL_LOCALE[locale], {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: zone,
        }).format(date);
    try {
        return format(timeZone);
    } catch {
        return format('UTC');
    }
}
