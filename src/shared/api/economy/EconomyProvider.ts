import type {
    EconomicCalendarEvent,
    EconomicIndicatorSeries,
    TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';

/**
 * /economy 페이지가 FMP에서 거시 데이터를 가져올 때 사용하는 추상 포트.
 *
 * 구현체:
 * - `FmpEconomyProvider` — 실 FMP fetch + core normalize.
 * - `OfficialTreasuryEconomyProvider` — prod에서 위를 감싼다. 국채 금리만 재무부 공식값과 비교해 더 최근 값을 낸다.
 * - `FakeEconomyProvider` — E2E·테스트용 결정적 fixture.
 *
 * 실패 의미론: 상위 캐시 레이어가 `Promise.all` 분기별 `.catch(() => …)`로
 * 부분 실패를 graceful하게 흡수하므로, provider는 FMP 장애 시 그대로 throw한다.
 */
/** 국채 금리 값과 출처. `officialAvailable`은 재무부 읽기가 값을 냈는지다(FMP로 물러났는지 판단용). */
export interface TreasuryReading {
    treasury: TreasuryRateSnapshot;
    source: 'us-treasury' | 'fmp';
    officialAvailable: boolean;
}

export interface EconomyProvider {
    /** 단일 지표 시계열(core 정규화 적용). */
    getIndicator(name: string): Promise<EconomicIndicatorSeries>;
    /** 최신 국채 2Y/10Y 스냅샷. */
    getTreasury(): Promise<TreasuryRateSnapshot | null>;
    /**
     * 출처가 붙은 국채 금리. 구현하지 않은 공급자(FMP 단독·E2E Fake)는 호출부가 `getTreasury` 값을
     * FMP 출처로 본다.
     */
    getTreasuryReading?(): Promise<TreasuryReading | null>;
    /**
     * US 경제 캘린더(`from`~`to`, ISO 'YYYY-MM-DD').
     * core가 country==='US' 필터 + 날짜 오름차순 정규화를 적용한다.
     */
    getCalendar(from: string, to: string): Promise<EconomicCalendarEvent[]>;
}
