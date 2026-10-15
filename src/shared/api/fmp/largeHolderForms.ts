/**
 * 13D/G 공시의 **정확한 양식**을 SEC 제출 목록에서 찾는 순수 헬퍼.
 *
 * FMP `acquisition-of-beneficial-ownership` 행에는 양식 필드가 없다. 5% 보유 공시는 피공시 회사(subject)의
 * `data.sec.gov/submissions/CIK##########.json`에도 올라오며(2026-10 실측: 새 이름 `SCHEDULE 13G`·`SCHEDULE 13G/A`
 * 와 옛 이름 `SC 13G/A` 모두), accession으로 행과 짝지을 수 있다.
 */

/** `.../Archives/edgar/data/<cik>/<18자리 accession>/...` → 대시 포함 accession(`0002100119-26-000139`). */
export function accessionFromFilingUrl(
    url: string | null | undefined
): string | null {
    const match = url?.match(/\/Archives\/edgar\/data\/\d+\/(\d{18})(?:\/|$)/);
    if (match === null || match === undefined) return null;
    const digits = match[1] as string;
    return `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

/** 13D/G 양식인가(`SC 13D`, `SC 13D/A`, `SCHEDULE 13G`, `SCHEDULE 13G/A` …). */
export function isLargeHolderForm(form: string): boolean {
    return /^(SC|SCHEDULE)\s*13[DG](\/A)?$/i.test(form.trim());
}

export interface SubmissionsIndex {
    /** accession → 양식. 13D/G 양식만 담는다. */
    forms: Map<string, string>;
    /** 이 목록이 거슬러 올라가는 가장 오래된 제출일; 목록이 비면 null. */
    oldestFilingDate: string | null;
    /** 더 오래된 제출이 든 보조 파일(`filings.files[]`). */
    extraFiles: { name: string; filingFrom: string; filingTo: string }[];
}

interface FilingColumns {
    accessionNumber?: unknown;
    filingDate?: unknown;
    form?: unknown;
}

function readColumns(columns: unknown): SubmissionsIndex {
    const forms = new Map<string, string>();
    let oldest: string | null = null;
    const { accessionNumber, filingDate, form } = (columns ??
        {}) as FilingColumns;
    if (Array.isArray(accessionNumber) && Array.isArray(form)) {
        accessionNumber.forEach((accession, i) => {
            const f = form[i];
            if (
                typeof accession === 'string' &&
                typeof f === 'string' &&
                isLargeHolderForm(f)
            ) {
                forms.set(accession, f.trim());
            }
        });
    }
    if (Array.isArray(filingDate)) {
        for (const d of filingDate) {
            if (typeof d === 'string' && (oldest === null || d < oldest))
                oldest = d;
        }
    }
    return { forms, oldestFilingDate: oldest, extraFiles: [] };
}

/** 제출 목록 JSON(`filings.recent` 열 배열 구조)을 읽는다. 모양이 다르면 빈 결과. */
export function indexSubmissions(json: unknown): SubmissionsIndex {
    const filings = (
        json as { filings?: { recent?: unknown; files?: unknown } } | null
    )?.filings;
    const index = readColumns(filings?.recent);
    if (Array.isArray(filings?.files)) {
        for (const file of filings.files as Record<string, unknown>[]) {
            if (
                typeof file?.name === 'string' &&
                typeof file.filingFrom === 'string' &&
                typeof file.filingTo === 'string'
            ) {
                index.extraFiles.push({
                    name: file.name,
                    filingFrom: file.filingFrom,
                    filingTo: file.filingTo,
                });
            }
        }
    }
    return index;
}

/** 보조 파일(`filings.files[].name`을 받아 온 JSON — 열 배열이 최상위에 있다)을 읽는다. */
export function indexSubmissionsFile(json: unknown): SubmissionsIndex {
    return readColumns(json);
}
