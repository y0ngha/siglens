import { AGENT_FILINGS_WINDOW_DAYS } from '@y0ngha/siglens-core';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { isRecord } from '@/shared/lib/isRecord';
import { MS_PER_HOUR } from '@/shared/config/time';
import type { CompanyFilingForm, SubmissionFiling } from '../model';
import { filingItems } from './filingItems';
import { normalizeAccession } from './normalizeAccession';

const EVENT_FORMS: readonly CompanyFilingForm[] = ['8-K', '8-K/A', '6-K'];

function isEventForm(form: unknown): form is CompanyFilingForm {
    return EVENT_FORMS.some(known => known === form);
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function recentOf(json: unknown): Record<string, unknown> | null {
    const filings = isRecord(json) ? json.filings : undefined;
    const recent = isRecord(filings) ? filings.recent : undefined;
    return isRecord(recent) ? recent : null;
}

/** 제출 목록 JSON에 `filings.recent`가 있는가 — 없으면 빈 목록이 아니라 "읽지 못함"으로 다뤄야 한다. */
export function hasRecentFilings(json: unknown): boolean {
    return recentOf(json) !== null;
}

/**
 * SEC 접수일은 미국 동부 달력 날짜다. UTC 날짜로 "오늘"을 잡으면 동부 저녁(UTC 다음 날)에 하루 어긋나고,
 * 그 어긋남은 서머타임 여부에 따라 시각이 달라진다(SERVER.md#SA-21).
 */
function easternIsoDate(now: Date): string {
    return toUtcIsoDate(
        new Date(now.getTime() + getEasternOffsetHours(now) * MS_PER_HOUR)
    );
}

function column(recent: Record<string, unknown>, key: string): unknown[] {
    const value = recent[key];
    return Array.isArray(value) ? value : [];
}

/**
 * 제출 목록(`filings.recent`, 열 단위 평행 배열)에서 8-K·8-K/A·6-K만 골라 최근 `AGENT_FILINGS_WINDOW_DAYS`일
 * 안의 행을 최신순으로 돌려준다. 접수일은 동부 날짜 문자열끼리 비교하고, 경계일(오늘 − 창)은 포함한다.
 * 모양이 어긋난 행은 던지지 않고 건너뛴다. 같은 날 접수는 목록 원래 순서(SEC는 최신 먼저)를 유지한다.
 */
export function parseSubmissions(json: unknown, now: Date): SubmissionFiling[] {
    const recent = recentOf(json);
    if (recent === null) return [];
    const forms = column(recent, 'form');
    const dates = column(recent, 'filingDate');
    const accessions = column(recent, 'accessionNumber');
    const primaries = column(recent, 'primaryDocument');
    const items = column(recent, 'items');
    const cutoff = addUtcIsoDays(
        easternIsoDate(now),
        -AGENT_FILINGS_WINDOW_DAYS
    );

    const rows = forms.flatMap((form, index): SubmissionFiling[] => {
        const filedAt = dates[index];
        const rawAccession = accessions[index];
        const primaryDocument = primaries[index];
        const rawItems = items[index];
        if (!isEventForm(form)) return [];
        if (typeof filedAt !== 'string' || !ISO_DATE.test(filedAt)) return [];
        if (filedAt < cutoff) return [];
        if (typeof rawAccession !== 'string') return [];
        const accession = normalizeAccession(rawAccession);
        if (accession === null) return [];
        if (typeof primaryDocument !== 'string' || primaryDocument === '')
            return [];
        return [
            {
                accession,
                form,
                filedAt,
                primaryDocument,
                items: filingItems(
                    typeof rawItems === 'string' ? rawItems : ''
                ),
            },
        ];
    });
    return rows.toSorted((a, b) => b.filedAt.localeCompare(a.filedAt));
}
