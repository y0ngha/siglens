import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { getInvestorFlowsFmpProvider } from '@/shared/api/fmp/getInvestorFlowsFmpProvider';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import { tryGetDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { DrizzleInvestorFlowsDartRepository } from '../api/investorFlowsDartRepository';
import { DrizzleSecFilingsRepository } from '../api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsFtdRepository } from '../api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsRegShoRepository } from '../api/investorFlowsRegShoRepository';
import { DrizzleInvestorFlowsShortRepository } from '../api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsSnapshotRepository } from '../api/investorFlowsSnapshotRepository';
import type { InvestorFlowsDataProvider } from '@y0ngha/siglens-core';
import { isE2EFlowsPipelineCollecting } from './e2eFlowsPipeline';
import { DbDartInvestorFlowsDataProvider } from './loadKrInvestorFlowsSnapshot';
import { DbFmpInvestorFlowsDataProvider } from './loadInvestorFlowsSnapshot';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';

/** 미국 주식 — DB(13F·FINRA·SEC FTD·Form 144·증자 공시·Reg SHO)와 FMP(내부자·13D/G·유통주식). */
function buildUsProvider(db: SiglensDatabase): InvestorFlowsDataProvider {
    const snapshotRepo = new DrizzleInvestorFlowsSnapshotRepository(db);
    const shortRepo = new DrizzleInvestorFlowsShortRepository(db);
    const ftdRepo = new DrizzleInvestorFlowsFtdRepository(db);
    const filingsRepo = new DrizzleSecFilingsRepository(db);
    const regShoRepo = new DrizzleInvestorFlowsRegShoRepository(db);
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
            findOptionAggregates: (c, l) =>
                snapshotRepo.findOptionAggregates(c, l),
            findFailsToDeliver: (s, since) =>
                ftdRepo.findFailsToDeliver(s, since),
            findProposedSales: (s, since, l) =>
                filingsRepo.findProposedSales(s, since, l),
            findOfferings: (s, since, l) =>
                filingsRepo.findOfferings(s, since, l),
            findThresholdListings: (s, since) =>
                regShoRepo.findListings(s, since),
            listThresholdTradeDates: since => regShoRepo.listTradeDates(since),
        },
        fmp: getInvestorFlowsFmpProvider(),
        isFinraEnabled: isFinraShortDataEnabled,
        isRegShoEnabled: isRegShoThresholdDataEnabled,
        now: () => new Date(),
        log: warnWithDetail,
    });
}

/** 한국 주식 — DB의 DART 테이블만(FMP·SEC·FINRA를 부르지 않는다, 설계 §4.5). */
function buildKrProvider(db: SiglensDatabase): InvestorFlowsDataProvider {
    const dartRepo = new DrizzleInvestorFlowsDartRepository(db);
    return new DbDartInvestorFlowsDataProvider({
        reads: {
            resolveCorpCode: code => dartRepo.resolveCorpCode(code),
            findMajorHoldings: (c, since) =>
                dartRepo.findMajorHoldings(c, since),
            findInsiderReports: (c, since) =>
                dartRepo.findInsiderReports(c, since),
            findTradingPlans: (c, since) => dartRepo.findTradingPlans(c, since),
            findListedShares: code => dartRepo.findListedShares(code),
        },
        now: () => new Date(),
        log: warnWithDetail,
    });
}

/**
 * 실제 의존으로 `InvestorFlowsDataProvider`를 만든다 — **시장별로 갈린다**: 한국 심볼(`005930.KS`, `isKrEquitySymbol`)은 DART
 * 테이블만 읽는 provider, 그 밖(미국 주식)은 DB + FMP provider다. 시장 구현은 심볼마다 그때 만든다 — 한국 종목 조회가 FMP
 * provider(키 검사 포함)를 만들지도 않게 한다. DB가 없으면 던진다 — resilient 로더가 degrade로 흡수한다(빈 스냅샷으로 위장하지
 * 않는다).
 */
export function getInvestorFlowsDataProvider(): InvestorFlowsDataProvider {
    if (isE2E()) {
        // 동기 팩토리라 동적 import를 못 쓴다 — 가짜는 게이트된 require로 읽는다
        // (`getInvestorFlowsFmpProvider`와 같은 이유·같은 형태). 가짜도 한국 심볼은 가짜 DART 데이터로 답한다.
        const { FakeInvestorFlowsDataProvider } =
            require('./FakeInvestorFlowsDataProvider') as typeof import('./FakeInvestorFlowsDataProvider');
        return new FakeInvestorFlowsDataProvider(
            isFinraShortDataEnabled,
            isE2EFlowsPipelineCollecting(),
            isRegShoThresholdDataEnabled
        );
    }
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[investor-flows] database unavailable');
    const { db } = client;
    return {
        getInvestorFlowsSnapshot: symbol =>
            (isKrEquitySymbol(symbol)
                ? buildKrProvider(db)
                : buildUsProvider(db)
            ).getInvestorFlowsSnapshot(symbol),
    };
}
