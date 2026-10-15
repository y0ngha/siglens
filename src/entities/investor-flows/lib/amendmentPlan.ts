import type { AmendmentType, PositionApplyMode } from '../model';

/** 정정 규칙 판정에 필요한 제출 정보. */
export interface AmendmentFiling {
    accession: string;
    filingDate: string;
    submissionType: string;
    amendmentType: AmendmentType | null;
}

const isRestatement = (filing: AmendmentFiling): boolean =>
    filing.submissionType === '13F-HR/A' &&
    filing.amendmentType === 'RESTATEMENT';

/** 제출 순서 비교 — 제출일, 같은 날이면 accession(발급 순). 음수면 a가 먼저. */
function compareFilingOrder(a: AmendmentFiling, b: AmendmentFiling): number {
    if (a.filingDate !== b.filingDate) {
        return a.filingDate < b.filingDate ? -1 : 1;
    }
    if (a.accession === b.accession) return 0;
    return a.accession < b.accession ? -1 : 1;
}

/**
 * 이번 제출이 같은 (cik, period)의 포지션에 어떻게 반영되는지 정한다.
 *
 * 규칙(설계 §2):
 *  - `RESTATEMENT`는 그 (cik, period) 포지션 **전체를 교체**한다.
 *  - `NEW HOLDINGS`는 **추가**(upsert)한다.
 *  - 정정 종류를 알 수 없는 `13F-HR/A`는 파괴적이지 않은 `NEW HOLDINGS`로 본다.
 *  - 원본 `13F-HR`은 처음이면 교체(= 채우기), 같은 (cik, period)에 이미 반영된 제출이 있으면 추가한다.
 *  - **나중에 제출된 RESTATEMENT가 이긴다**: 이미 반영된 RESTATEMENT가 이번 제출보다 늦으면(백필·재시도로
 *    순서가 뒤집힌 경우) 이번 제출은 건너뛴다 — 옛 데이터가 새 교체본을 덮으면 안 된다.
 *
 * `existing`은 같은 (cik, period)에 이미 **반영된**(processed) 제출들이다.
 */
export function planPositionApplication(
    incoming: AmendmentFiling,
    existing: readonly AmendmentFiling[]
): PositionApplyMode {
    const supersededByLaterRestatement = existing.some(
        filing =>
            filing.accession !== incoming.accession &&
            isRestatement(filing) &&
            compareFilingOrder(filing, incoming) > 0
    );
    if (supersededByLaterRestatement) return 'skip';
    if (isRestatement(incoming)) return 'replace';
    if (incoming.submissionType === '13F-HR/A') return 'merge';
    const hasEarlier = existing.some(
        filing => filing.accession !== incoming.accession
    );
    return hasEarlier ? 'merge' : 'replace';
}

/**
 * `incoming` RESTATEMENT가 **교체**로 반영된 뒤 다시 반영해야 하는 제출들 — 이미 반영돼 있고 `incoming`보다
 * **나중**에 제출된 NEW HOLDINGS(또는 종류 미상) 정정. 교체가 그 포지션을 지웠으므로(백필·재시도로 순서가 뒤집힌
 * 경우) 나중에 낸 추가분을 다시 얹어야 한다. 나중 RESTATEMENT가 있었다면 `planPositionApplication`이 이미
 * `skip`으로 걸렀으므로 여기엔 오지 않는다. 오래된 제출부터.
 */
export function findAmendmentsToReapply(
    incoming: AmendmentFiling,
    existing: readonly AmendmentFiling[]
): AmendmentFiling[] {
    if (!isRestatement(incoming)) return [];
    return existing
        .filter(
            filing =>
                filing.accession !== incoming.accession &&
                filing.submissionType === '13F-HR/A' &&
                !isRestatement(filing) &&
                compareFilingOrder(filing, incoming) > 0
        )
        .sort(compareFilingOrder);
}
