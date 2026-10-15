import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { getInvestorFlowsFmpProvider } from '@/shared/api/fmp/getInvestorFlowsFmpProvider';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleInvestorFlowsShortRepository } from '../api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsSnapshotRepository } from '../api/investorFlowsSnapshotRepository';
import type { InvestorFlowsDataProvider } from '@y0ngha/siglens-core';
import { DbFmpInvestorFlowsDataProvider } from './loadInvestorFlowsSnapshot';

/**
 * 실제 의존(DB·FMP·FINRA 플래그)으로 `InvestorFlowsDataProvider`를 만든다. DB가 없으면 던진다 —
 * resilient 로더가 degrade로 흡수한다(빈 스냅샷으로 위장하지 않는다).
 */
export function getInvestorFlowsDataProvider(): InvestorFlowsDataProvider {
    if (isE2E()) {
        // 동기 팩토리라 동적 import를 못 쓴다 — 가짜는 게이트된 require로 읽는다
        // (`getInvestorFlowsFmpProvider`와 같은 이유·같은 형태).
        const { FakeInvestorFlowsDataProvider } =
            require('./FakeInvestorFlowsDataProvider') as typeof import('./FakeInvestorFlowsDataProvider');
        return new FakeInvestorFlowsDataProvider(isFinraShortDataEnabled);
    }
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[investor-flows] database unavailable');
    const snapshotRepo = new DrizzleInvestorFlowsSnapshotRepository(client.db);
    const shortRepo = new DrizzleInvestorFlowsShortRepository(client.db);
    return new DbFmpInvestorFlowsDataProvider({
        reads: {
            findCusipsBySymbol: s => snapshotRepo.findCusipsBySymbol(s),
            findAggregates: (c, l) => snapshotRepo.findAggregates(c, l),
            findLatestPositionPeriod: c =>
                snapshotRepo.findLatestPositionPeriod(c),
            findTopHolders: (c, p, l) => snapshotRepo.findTopHolders(c, p, l),
            findExitedHolders: (c, p, l, f) =>
                snapshotRepo.findExitedHolders(c, p, l, f),
            findShortInterest: (s, l) => shortRepo.findShortInterest(s, l),
            findShortVolume: (s, l) => shortRepo.findShortVolume(s, l),
        },
        fmp: getInvestorFlowsFmpProvider(),
        isFinraEnabled: isFinraShortDataEnabled,
        now: () => new Date(),
        log: (message, detail) => console.warn(message, detail),
    });
}
