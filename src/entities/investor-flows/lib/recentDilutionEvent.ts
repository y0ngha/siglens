import type { OfferingKind, OfferingRecord } from '../model';
import { addDays, compareIsoDate } from './investorFlowsDates';

/** 차트 헤더 희석 배지가 보는 창(신고일 기준, 오늘 포함 과거 N일). */
export const DILUTION_BADGE_LOOKBACK_DAYS = 90;

/**
 * 창 안에서 읽는 최대 공시 수(최신순). 선반 등록·사모 같은 "용량" 공시가 창을 채워도 실제 발행 공시가 밀려나지 않을
 * 만큼 넉넉하게 — 90일에 이보다 많은 증자 공시를 내는 발행사는 사실상 없다.
 */
export const DILUTION_BADGE_FETCH_LIMIT = 40;

/**
 * 배지에 오르는 사건 종류. 실제로 주식이 시장에 풀리는 공시만 해당한다.
 * - `atm`: 시장가 상시 발행(ATM) 424B5 — 회사가 장중에 조금씩 판다.
 * - `priced`: 가격이 정해진 공모(인수 `underwritten`·모집 주선 `best_efforts`).
 */
export type DilutionEventKind = 'atm' | 'priced';

export interface RecentDilutionEvent {
    readonly kind: DilutionEventKind;
    /** `YYYY-MM-DD` 신고일. */
    readonly filingDate: string;
}

/**
 * 공시 종류 → 배지 사건. 선반 등록·증권 등록·설명서·사모·기타는 "팔 수 있는 용량"일 뿐 실제 공급이 아니라 배지에서
 * 뺀다(`null`) — 대형주도 선반 등록은 상시로 두고 있어 넣으면 거의 모든 종목에 배지가 붙는다.
 * `Record`라 core에 종류가 늘면 여기서 컴파일이 깨진다(TS-2).
 */
const SUPPLY_EVENT_KIND: Readonly<
    Record<OfferingKind, DilutionEventKind | null>
> = {
    atm: 'atm',
    underwritten: 'priced',
    best_efforts: 'priced',
    shelf: null,
    registration: null,
    prospectus: null,
    private_placement: null,
    other: null,
};

/** 같은 신고일이면 가격이 정해진 공모를 앞세운다(실제 매도가 확정된 쪽) — 결과를 입력 순서와 무관하게 만든다. */
const KIND_RANK: Readonly<Record<DilutionEventKind, number>> = {
    priced: 0,
    atm: 1,
};

/**
 * 최근 `DILUTION_BADGE_LOOKBACK_DAYS`일 안의 실제 공급 공시 중 가장 최신 한 건. 없으면 `null`.
 * 입력 순서는 믿지 않는다(저장소가 최신순으로 주지만 이 함수의 계약이 아니다). 오늘 이후 날짜는 무시한다.
 *
 * @param today `YYYY-MM-DD`(UTC 달력 날짜)
 */
export function pickRecentDilutionEvent(
    filings: readonly Pick<OfferingRecord, 'filingDate' | 'kind'>[],
    today: string
): RecentDilutionEvent | null {
    const since = addDays(today, -DILUTION_BADGE_LOOKBACK_DAYS);
    const events = filings.flatMap(filing => {
        const kind = SUPPLY_EVENT_KIND[filing.kind];
        if (kind === null) return [];
        if (compareIsoDate(filing.filingDate, since) < 0) return [];
        if (compareIsoDate(filing.filingDate, today) > 0) return [];
        return [{ kind, filingDate: filing.filingDate }];
    });
    const [newest] = events.toSorted(
        (a, b) =>
            compareIsoDate(b.filingDate, a.filingDate) ||
            KIND_RANK[a.kind] - KIND_RANK[b.kind]
    );
    return newest ?? null;
}
