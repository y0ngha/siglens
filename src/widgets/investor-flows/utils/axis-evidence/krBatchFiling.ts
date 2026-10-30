/**
 * 한국 임원 축의 "하루 일괄 보고" 주석 — 건수가 한 접수일에 몰렸을 때 그 사실을 근거 줄에 밝힌다.
 */
import type { KrInsiderMetrics } from '@y0ngha/siglens-core';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { formatInteger } from '../flowFormat';

/**
 * 하루치 일괄 보고를 "포함" 주석으로 밝히는 건수 하한 — 한 접수일에 이 건수 이상일 때만 쓴다. 표시용 휴리스틱이며,
 * core `KR_INSIDER_ROUTINE_MASS_FILING_MAX_REPORTERS`(30일 범위의 고유 보고자 수, 엄격 비교)와 같은 판정이 아니라
 * 규모 숫자만 맞춘 것이다.
 */
export const KR_BATCH_FILING_MIN_COUNT = 30;

/** 하루치가 창 전체 보고의 이 비율 이상이어야 주석을 낸다 — 절반이 넘어야 "건수가 한 번에 몰렸다"는 설명이 맞다. */
export const KR_BATCH_FILING_MIN_SHARE = 0.5;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 근거 줄에 보간할 하루 일괄 보고의 날짜(로케일 표기)와 건수. */
export interface BatchFilingNote {
    date: string;
    batchCount: string;
}

/** `YYYY-MM-DD`를 UTC 자정 `Date`로 바꾼다. 형식이 틀리거나 존재하지 않는 날짜(`2026-02-31`)면 `null`이다. */
function parseIsoDateUtc(isoDate: string): Date | null {
    const match = ISO_DATE.exec(isoDate);
    if (match === null) return null;
    const [, year, month, day] = match.map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    const roundTrips =
        utc.getUTCFullYear() === year &&
        utc.getUTCMonth() === month - 1 &&
        utc.getUTCDate() === day;
    return roundTrips ? utc : null;
}

/**
 * core `largestSingleDayFiling`이 화면에 주석으로 쓸 만큼 큰 하루 일괄 보고인지 판정해 보간 값을 돌려준다. 보고가 없거나,
 * 하루 건수가 전체보다 크거나, 날짜가 올바르지 않으면 null이다. 날짜는 UTC로 해석해 시간대에 따른 하루 밀림을 막는다.
 */
export function batchFilingNote(
    m: Pick<KrInsiderMetrics, 'reports' | 'largestSingleDayFiling'>,
    locale: Locale
): BatchFilingNote | null {
    const filing = m.largestSingleDayFiling;
    if (filing === undefined || filing === null) return null;
    if (m.reports <= 0 || filing.count > m.reports) return null;
    if (filing.count < KR_BATCH_FILING_MIN_COUNT) return null;
    if (filing.count < m.reports * KR_BATCH_FILING_MIN_SHARE) return null;
    const utc = parseIsoDateUtc(filing.date);
    if (utc === null) return null;
    return {
        date: cachedDateTimeFormat(INTL_LOCALE[locale], {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(utc),
        batchCount: formatInteger(filing.count, locale),
    };
}
