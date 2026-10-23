import 'server-only';
import type {
    EconomicCalendarEvent,
    EconomicIndicatorSeries,
    TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';
import {
    fetchTreasuryGovSnapshot,
    TREASURY_GOV_REQUEST_TIMEOUT_MS,
} from '@/shared/api/treasury/treasuryGovClient';
import type { EconomyProvider, TreasuryReading } from './EconomyProvider';

/**
 * 재무부 값을 기다리는 최대 시간. 이 시간이 지나면 요청을 끊고 FMP 값으로 답한다 — `get_economy` 도구
 * 제한(30초)과 /economy ISR 재생성이 재무부 지연에 끌려가지 않게 한다(재무부 응답은 실측 1초 안팎).
 * 1월의 올해 → 전년도 순차 요청 두 번이 들어가도록 "시도 제한 × 2 + 1초"로 둔다.
 */
export const OFFICIAL_TREASURY_WAIT_MS =
    2 * TREASURY_GOV_REQUEST_TIMEOUT_MS + 1_000;

/** 로그용 오류 요약 — 이름과, HTTP 오류면 상태 코드(비밀값 없음). 403 차단과 5xx를 구분하려는 것이다. */
function errorSummary(reason: unknown): { error: string; status?: number } {
    const error = reason instanceof Error ? reason.name : typeof reason;
    const status =
        typeof reason === 'object' && reason !== null && 'status' in reason
            ? Number((reason as { status: unknown }).status)
            : undefined;
    return status === undefined || Number.isNaN(status)
        ? { error }
        : { error, status };
}

/**
 * 두 출처 중 고른다. 10년물이 있는 쪽끼리만 날짜를 비교하고(10년물이 빈 더 새 행이 완전한 행을 이기지
 * 않게), 같은 날이면 재무부를 쓰되 빈 2년물은 같은 날 FMP 값으로 채운다.
 * (`getEconomy.ts`의 `pickTreasury`는 다른 선택 — 같은 날 읽기 캐시 대 경제 스냅샷 — 이다.)
 */
export function pickNewerTreasurySource(
    official: TreasuryRateSnapshot | null,
    vendor: TreasuryRateSnapshot | null
): Omit<TreasuryReading, 'officialAvailable'> | null {
    const usable = [
        { treasury: official, source: 'us-treasury' as const },
        { treasury: vendor, source: 'fmp' as const },
    ].filter(
        (
            c
        ): c is {
            treasury: TreasuryRateSnapshot;
            source: 'us-treasury' | 'fmp';
        } => c.treasury !== null && c.treasury.year10 !== null
    );
    if (usable.length === 0) {
        if (official !== null)
            return { treasury: official, source: 'us-treasury' };
        return vendor === null ? null : { treasury: vendor, source: 'fmp' };
    }
    const newest = usable.reduce((a, b) =>
        b.treasury.date > a.treasury.date ? b : a
    );
    const sameDay = usable.find(
        c => c !== newest && c.treasury.date === newest.treasury.date
    );
    return newest.treasury.year2 === null && sameDay?.treasury.year2 != null
        ? {
              ...newest,
              treasury: { ...newest.treasury, year2: sameDay.treasury.year2 },
          }
        : newest;
}

/**
 * 지표·캘린더는 그대로 넘기고, 국채 금리만 재무부 공식값과 FMP 값 중 **기준일이 더 최근인 쪽**을 낸다.
 *
 * FMP `treasury-rates`는 공표보다 늦게 행이 붙는다(근거는 `treasuryGovClient.ts`). 재무부를
 * 우선하되 한쪽이 실패하거나 비면 다른 쪽을 쓴다(같은 날이면 재무부). 둘 다 실패하면 FMP의
 * 오류를 그대로 던진다 — 호출부의 기존 실패 처리(`EconomyProvider` 실패 의미론)가 그대로 적용된다.
 * 재무부를 못 읽어 FMP로 물러난 결과는 `officialAvailable: false`로 표시해, 짧은 캐시가 그 값을 굳히지
 * 않게 한다(`treasuryRatesCache.ts`).
 */
export class OfficialTreasuryEconomyProvider implements EconomyProvider {
    constructor(
        private readonly base: EconomyProvider,
        private readonly fetchOfficial: (
            now: Date,
            signal: AbortSignal
        ) => Promise<TreasuryRateSnapshot | null> = fetchTreasuryGovSnapshot,
        private readonly now: () => Date = () => new Date(),
        private readonly officialWaitMs: number = OFFICIAL_TREASURY_WAIT_MS
    ) {}

    getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        return this.base.getIndicator(name);
    }

    getCalendar(from: string, to: string): Promise<EconomicCalendarEvent[]> {
        return this.base.getCalendar(from, to);
    }

    async getTreasury(): Promise<TreasuryRateSnapshot | null> {
        return (await this.getTreasuryReading())?.treasury ?? null;
    }

    async getTreasuryReading(): Promise<TreasuryReading | null> {
        // 상한이 지나면 재무부 요청 자체를 끊는다(버려진 요청이 소켓을 잡고 남지 않게).
        const deadline = AbortSignal.timeout(this.officialWaitMs);
        const [official, vendor] = await Promise.allSettled([
            this.fetchOfficial(this.now(), deadline),
            this.base.getTreasury(),
        ]);
        const officialSnapshot =
            official.status === 'fulfilled' ? official.value : null;
        const vendorSnapshot =
            vendor.status === 'fulfilled' ? vendor.value : null;
        // 실패는 이름(과 HTTP 상태)만 남긴다(URL·본문 없음). 다른 쪽 값이 있으면 그대로 답이 나간다.
        if (official.status === 'rejected') {
            console.warn(
                '[economy] treasury.gov read failed',
                errorSummary(official.reason)
            );
        } else if (officialSnapshot === null) {
            // 200인데 쓸 행이 없다 — 열 이름·날짜 형식이 바뀌면 조용히 늦은 FMP 값으로 돌아간다.
            console.warn('[economy] treasury.gov returned no usable row');
        }
        if (vendor.status === 'rejected') {
            if (officialSnapshot === null) throw vendor.reason;
            console.warn(
                '[economy] FMP treasury-rates read failed',
                errorSummary(vendor.reason)
            );
        }
        const picked = pickNewerTreasurySource(
            officialSnapshot,
            vendorSnapshot
        );
        return picked === null
            ? null
            : { ...picked, officialAvailable: officialSnapshot !== null };
    }
}
