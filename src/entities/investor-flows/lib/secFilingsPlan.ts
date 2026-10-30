import { addDays } from './investorFlowsDates';
import {
    INVESTOR_FLOWS_FORM144_RETENTION_DAYS,
    INVESTOR_FLOWS_OFFERING_RETENTION_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
} from './investorFlowsPolicy';
import {
    FORM_144_FORMS,
    OFFERING_FORMS,
    OFFERING_FORM_NEEDS_DOCUMENT,
    offeringKindForForm,
    secFilingIndexUrl,
    type IndexTarget,
} from './offeringIndex';
import type { FilingRetry, OfferingFilingRow, OfferingKind } from '../model';

/** 같은 날 index를 다시 읽는 겹침(일) — 늦게 반영된 제출·직전 실행이 중단된 날을 주운다. */
export const SEC_FILINGS_CURSOR_OVERLAP_DAYS = 3;
/** Form 144 제출에서 받는 문서 — 파일명이 고정이라 index.json 요청이 필요 없다. */
export const FORM_144_DOCUMENT = 'primary_doc.xml';
/** daily form index에서 수집 대상으로 읽는 양식 전부(Form 144 + 증자 공시). */
export const INDEX_FORMS: ReadonlySet<string> = new Set([
    ...FORM_144_FORMS,
    ...OFFERING_FORMS,
]);

/** 문서를 받는 제출 하나 — 실패하면 이 값으로 재시도 큐에 남는다(시도 횟수는 저장소가 센다). */
export type DocumentTarget = Omit<FilingRetry, 'attempts'>;

/** 문서를 받아야 하는 일 하나 — `form144`는 `primary_doc.xml`, `prospectus`는 424B5 제출 본문의 머리를 읽는다. */
export type DocumentPlan =
    | { kind: 'form144'; target: DocumentTarget }
    | {
          kind: 'prospectus';
          target: DocumentTarget;
          issuers: ReadonlyMap<string, readonly string[]>;
      };

/** 하루치 index의 수집 계획 — 문서 없이 바로 저장할 증자 공시 행과, 문서를 받아야 하는 일. */
export interface DayPlan {
    formOnly: OfferingFilingRow[];
    documents: DocumentPlan[];
}

const NO_WORK: DayPlan = { formOnly: [], documents: [] };

/** 발행사 CIK의 대표 심볼(정렬 첫째) — Form 144 행의 `symbol`. 읽을 때는 CIK로 찾아 모든 클래스가 본다. */
export const representativeSymbol = (
    symbols: readonly string[]
): string | undefined => [...symbols].toSorted()[0];

/** 발행사 CIK마다 심볼 수만큼 증자 공시 행을 만든다. */
export function offeringRows(
    accession: string,
    formType: string,
    filingDate: string,
    issuers: ReadonlyMap<string, readonly string[]>,
    kind: OfferingKind
): OfferingFilingRow[] {
    return [...issuers].flatMap(([cik, symbols]) =>
        symbols.map(symbol => ({
            accession,
            symbol,
            issuerCik: Number(cik),
            formType,
            filingDate,
            kind,
            url: secFilingIndexUrl(cik, accession),
        }))
    );
}

const failureTarget = (target: IndexTarget): DocumentTarget => ({
    accession: target.accession,
    // 문서를 받을 폴더 — 유니버스 발행사 CIK 중 첫째(같은 accession은 어느 등록인 폴더로도 열린다).
    cik: target.primaryCik,
    formType: target.formType,
    filingDate: target.filingDate,
});

/**
 * 하루치 수집 대상을 문서 없이 저장할 행과 문서를 받을 일로 가른다. 이미 저장된 accession과 시도를 소진한 실패는
 * 다시 받지 않는다. 문서 없는 증자 양식은 양식으로 종류가 정해져 행이 되고, `424B5`와 Form 144만 문서를 받는다. 문서를
 * 받을 일의 순서는 대상 순서를 따른다.
 */
export function planDay(
    targets: readonly IndexTarget[],
    storedForm144: ReadonlySet<string>,
    storedOfferings: ReadonlySet<string>,
    failureAttempts: ReadonlyMap<string, number>
): DayPlan {
    const exhausted = (accession: string): boolean =>
        (failureAttempts.get(accession) ?? 0) >=
        INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS;
    const plans = targets.map((target): DayPlan => {
        if (FORM_144_FORMS.has(target.formType)) {
            return storedForm144.has(target.accession) ||
                exhausted(target.accession)
                ? NO_WORK
                : {
                      formOnly: [],
                      documents: [
                          { kind: 'form144', target: failureTarget(target) },
                      ],
                  };
        }
        if (storedOfferings.has(target.accession)) return NO_WORK;
        const kind = offeringKindForForm(target.formType);
        if (kind === undefined) return NO_WORK;
        if (kind === null) {
            return exhausted(target.accession)
                ? NO_WORK
                : {
                      formOnly: [],
                      documents: [
                          {
                              kind: 'prospectus',
                              target: failureTarget(target),
                              issuers: target.issuers,
                          },
                      ],
                  };
        }
        return {
            formOnly: offeringRows(
                target.accession,
                target.formType,
                target.filingDate,
                target.issuers,
                kind
            ),
            documents: [],
        };
    });
    return {
        formOnly: plans.flatMap(plan => plan.formOnly),
        documents: plans.flatMap(plan => plan.documents),
    };
}

/**
 * 날짜 순회 밖에 남은 실패 문서를 다시 받을 일로 바꾼다. Form 144는 그대로, 424B5는 발행사 CIK가 아직 유니버스에 있을 때만
 * 다시 받는다(그새 빠진 발행사는 받을 이유가 없다 — 실패 기록은 보존 정리가 지운다). 그 밖의 양식은 버린다.
 */
export function planRetries(
    pending: readonly FilingRetry[],
    cikSymbols: ReadonlyMap<number, readonly string[]>
): DocumentPlan[] {
    return pending.flatMap(
        ({ attempts: _attempts, ...target }): DocumentPlan[] => {
            if (FORM_144_FORMS.has(target.formType)) {
                return [{ kind: 'form144', target }];
            }
            const symbols = cikSymbols.get(Number(target.cik));
            if (
                target.formType !== OFFERING_FORM_NEEDS_DOCUMENT ||
                symbols === undefined
            )
                return [];
            return [
                {
                    kind: 'prospectus',
                    target,
                    issuers: new Map([[target.cik, symbols]]),
                },
            ];
        }
    );
}

/**
 * 일일 index를 읽기 시작할 날짜: 커서에서 `SEC_FILINGS_CURSOR_OVERLAP_DAYS`를 뺀 날. 커서가 없거나 백필 창보다 이른 날이면
 * 백필 시작일이다(ISO 날짜는 문자열 비교가 날짜 비교다).
 */
export function secFilingsStartDate(
    cursor: string | null,
    backfillStart: string
): string {
    if (cursor === null) return backfillStart;
    const overlapStart = addDays(cursor, -SEC_FILINGS_CURSOR_OVERLAP_DAYS);
    return overlapStart > backfillStart ? overlapStart : backfillStart;
}

/** 보존 정리 기준일 — 이 날짜보다 이른 행을 지운다. 실패 기록은 Form 144와 같은 기간을 보존한다. */
export function filingsPruneCutoffs(today: string): {
    form144Before: string;
    offeringsBefore: string;
    failuresBefore: string;
} {
    const form144Before = addDays(
        today,
        -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
    );
    return {
        form144Before,
        offeringsBefore: addDays(
            today,
            -INVESTOR_FLOWS_OFFERING_RETENTION_DAYS
        ),
        failuresBefore: form144Before,
    };
}
