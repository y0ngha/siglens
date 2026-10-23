import 'server-only';
import type {
    EconomicCalendarEvent,
    EconomicIndicatorSeries,
    TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';
import { fetchTreasuryGovSnapshot } from '@/shared/api/treasury/treasuryGovClient';
import { easternYear } from '@/shared/lib/eastern';
import type { EconomyProvider } from './EconomyProvider';

const errorName = (reason: unknown): string =>
    reason instanceof Error ? reason.name : typeof reason;

/**
 * 지표·캘린더는 그대로 넘기고, 국채 금리만 재무부 공식값과 FMP 값 중 **기준일이 더 최근인 쪽**을 낸다.
 *
 * FMP `treasury-rates`는 공표보다 늦게 행이 붙는다(근거는 `treasuryGovClient.ts`). 재무부를
 * 우선하되 한쪽이 실패하거나 비면 다른 쪽을 쓴다(같은 날이면 재무부). 둘 다 실패하면 FMP의
 * 오류를 그대로 던진다 — 호출부의 기존 실패 처리(`EconomyProvider` 실패 의미론)가 그대로 적용된다.
 */
export class OfficialTreasuryEconomyProvider implements EconomyProvider {
    constructor(
        private readonly base: EconomyProvider,
        private readonly fetchOfficial: (
            year: number
        ) => Promise<TreasuryRateSnapshot | null> = fetchTreasuryGovSnapshot,
        private readonly now: () => Date = () => new Date()
    ) {}

    getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        return this.base.getIndicator(name);
    }

    getCalendar(from: string, to: string): Promise<EconomicCalendarEvent[]> {
        return this.base.getCalendar(from, to);
    }

    async getTreasury(): Promise<TreasuryRateSnapshot | null> {
        const [official, vendor] = await Promise.allSettled([
            this.fetchOfficial(easternYear(this.now())),
            this.base.getTreasury(),
        ]);
        const officialSnapshot =
            official.status === 'fulfilled' ? official.value : null;
        const vendorSnapshot =
            vendor.status === 'fulfilled' ? vendor.value : null;
        // 실패는 이름만 남긴다(URL·본문 없음). 다른 쪽 값이 있으면 그대로 답이 나간다.
        if (official.status === 'rejected') {
            console.warn('[economy] treasury.gov read failed', {
                error: errorName(official.reason),
            });
        } else if (officialSnapshot === null) {
            // 200인데 쓸 행이 없다 — 열 이름·날짜 형식이 바뀌면 조용히 늦은 FMP 값으로 돌아간다.
            console.warn('[economy] treasury.gov returned no usable row');
        }
        if (vendor.status === 'rejected') {
            if (officialSnapshot === null) throw vendor.reason;
            console.warn('[economy] FMP treasury-rates read failed', {
                error: errorName(vendor.reason),
            });
        }
        if (officialSnapshot === null) return vendorSnapshot;
        if (vendorSnapshot === null) return officialSnapshot;
        return vendorSnapshot.date > officialSnapshot.date
            ? vendorSnapshot
            : officialSnapshot;
    }
}
