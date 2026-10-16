import { SEC_ARCHIVES_BASE_URL } from '@/shared/config/investorFlows';
import type { OfferingKind, SecFormIndexEntry } from '../model';

/** Form 144(매도 예정 신고)와 그 정정. */
export const FORM_144_FORMS: ReadonlySet<string> = new Set(['144', '144/A']);

/** `424B5`는 양식만으로 종류를 알 수 없다 — 문서 앞부분을 읽어 분류한다(`classify424B5`). */
export const OFFERING_FORM_NEEDS_DOCUMENT = '424B5';

/**
 * 증자·희석 공시 양식 → 종류. `424B2`(은행 구조화채 발행이 대부분)와 `FWP`(자유 서식 홍보물)는 희석 신호가 아니라 뺀다.
 *  - `S-1`·`F-1`(+정정): 신규 등록(대개 IPO·후속 공모 등록) → `registration`
 *  - `S-3`·`F-3`(+정정)·`S-3ASR`: 일괄 신고(shelf) → `shelf`
 *  - `424B1`·`424B3`·`424B4`·`424B7`: 투자설명서(prospectus) → `prospectus`
 *  - `D`·`D/A`: 사모(Regulation D) → `private_placement`
 */
const OFFERING_FORM_KIND: ReadonlyMap<string, OfferingKind | null> = new Map<
    string,
    OfferingKind | null
>([
    ['S-1', 'registration'],
    ['S-1/A', 'registration'],
    ['F-1', 'registration'],
    ['F-1/A', 'registration'],
    ['S-3', 'shelf'],
    ['S-3/A', 'shelf'],
    ['S-3ASR', 'shelf'],
    ['F-3', 'shelf'],
    ['F-3/A', 'shelf'],
    ['424B1', 'prospectus'],
    ['424B3', 'prospectus'],
    ['424B4', 'prospectus'],
    ['424B7', 'prospectus'],
    // 문서 분류 대상 — 종류는 문서를 읽은 뒤에 정해진다.
    [OFFERING_FORM_NEEDS_DOCUMENT, null],
    ['D', 'private_placement'],
    ['D/A', 'private_placement'],
]);

export const OFFERING_FORMS: ReadonlySet<string> = new Set(
    OFFERING_FORM_KIND.keys()
);

/** 양식만으로 정해지는 종류. 문서 분류가 필요하면(`424B5`) null. 증자 양식이 아니면 undefined. */
export function offeringKindForForm(
    formType: string
): OfferingKind | null | undefined {
    return OFFERING_FORM_KIND.get(formType);
}

/** 제출의 SEC 원문(제출 색인 페이지) URL. 화면·도구가 원문 링크로 쓴다. */
export function secFilingIndexUrl(
    cik: string | number,
    accession: string
): string {
    return `${SEC_ARCHIVES_BASE_URL}/data/${Number(cik)}/${accession.replaceAll('-', '')}/${accession}-index.htm`;
}

/** 수집 대상 하나 — 한 accession과, 그 줄들 중 유니버스에 있는 CIK들(우리 심볼 포함). */
export interface IndexTarget {
    accession: string;
    formType: string;
    filingDate: string;
    /** 유니버스 발행사 CIK(10자리) → 우리 심볼들. 등장 순서를 지킨다. */
    issuers: ReadonlyMap<string, readonly string[]>;
}

/**
 * daily index 줄들을 accession별로 묶고, 줄의 CIK가 `cikSymbols`(SEC CIK → 유니버스 심볼, `sec_cik_symbol_map`)에 있는
 * 것만 남긴다. 유니버스 CIK가 하나도 없는 accession은 버린다 — 그래야 문서를 받기 **전에** 거른다(Form 144는 하루 수백
 * 건이고 상당수가 비상장·유니버스 밖 발행사다).
 *
 *  - Form 144: 같은 accession이 발행사 CIK와 보고자 CIK로 두 줄 나온다 → 한 대상으로 합쳐진다.
 *  - 증자 공시: 공동 등록인(모회사·자회사)이 각자 한 줄 → 유니버스 발행사만 남는다.
 */
export function selectIndexTargets(
    entries: readonly SecFormIndexEntry[],
    cikSymbols: ReadonlyMap<number, readonly string[]>
): IndexTarget[] {
    const byAccession = new Map<
        string,
        {
            accession: string;
            formType: string;
            filingDate: string;
            issuers: Map<string, readonly string[]>;
        }
    >();
    for (const entry of entries) {
        const symbols = cikSymbols.get(Number(entry.cik));
        if (symbols === undefined || symbols.length === 0) continue;
        const target = byAccession.get(entry.accession) ?? {
            accession: entry.accession,
            formType: entry.formType,
            filingDate: entry.filingDate,
            issuers: new Map<string, readonly string[]>(),
        };
        target.issuers.set(entry.cik, symbols);
        byAccession.set(entry.accession, target);
    }
    return [...byAccession.values()];
}
