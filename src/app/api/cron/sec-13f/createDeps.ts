import 'server-only';
import {
    fetchDailyFormIndex,
    fetchFilingDocumentHead,
    fetchFilingDocumentStream,
    fetchFilingDocumentText,
    fetchFilingIndexJson,
    isSecBlockedError,
} from '@/shared/api/sec/secClient';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { revalidateFlowsReadiness } from '../revalidateFlowsReadiness';
import { revalidateSymbols } from '../revalidateSymbols';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { Drizzle13fRepository } from '@/entities/investor-flows/api/investorFlows13fRepository';
import { DrizzleSecFilingsRepository } from '@/entities/investor-flows/api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import { addDays } from '@/entities/investor-flows/lib/investorFlowsDates';
import type { Ingest13fDeps } from '@/entities/investor-flows/server/ingest13f';
import type { IngestSecFilingsDeps } from '@/entities/investor-flows/server/ingestSecFilings';
import { rememberRecentIndexes } from '@/entities/investor-flows/server/runSecIndexIngest';

/** 두 단계(13F·공시)가 함께 쓰도록 기억하는 최근 daily index 범위(일) — 평소 두 커서가 머무는 구간(겹침 3일 + 주말). */
const SHARED_INDEX_DAYS = 7;

/** `sec-13f` 한 실행의 두 단계 의존 — 13F와 Form 144·증자 공시. 같은 마감·같은 index 캐시를 쓴다. */
export interface Sec13fCronDeps {
    thirteenF: Ingest13fDeps;
    filings: IngestSecFilingsDeps;
}

/** I/O 구성은 entity `lib/`가 아니라 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createSec13fDeps(
    isDeadlineReached: () => boolean
): Sec13fCronDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[sec-13f] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    const now = (): Date => new Date();
    const log = (message: string, detail?: unknown): void =>
        console.warn(message, detail);
    const sharedIndex = rememberRecentIndexes(
        fetchDailyFormIndex,
        addDays(toUtcIsoDate(now()), -SHARED_INDEX_DAYS)
    );
    return {
        thirteenF: {
            sec: {
                fetchDailyFormIndex: sharedIndex,
                fetchFilingIndexJson,
                fetchFilingDocumentText,
                fetchFilingDocumentStream,
            },
            repo: new Drizzle13fRepository(client.db),
            loadUniverse: () => universeRepo.loadUniverse(),
            isSecBlockedError,
            now,
            isDeadlineReached,
            invalidateSymbols: symbols => revalidateSymbols(symbols),
            onBackfillCompleted: revalidateFlowsReadiness,
            log,
        },
        filings: {
            sec: {
                fetchDailyFormIndex: sharedIndex,
                fetchFilingDocumentText,
                fetchFilingDocumentHead,
            },
            repo: new DrizzleSecFilingsRepository(client.db),
            isSecBlockedError,
            now,
            isDeadlineReached,
            invalidateSymbols: symbols => revalidateSymbols(symbols),
            log,
        },
    };
}
