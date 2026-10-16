import 'server-only';
import {
    fetchDailyFormIndex,
    fetchFilingDocumentStream,
    fetchFilingDocumentText,
    fetchFilingIndexJson,
    SecHttpError,
} from '@/shared/api/sec/secClient';
import { revalidateFlowsReadiness } from '../revalidateFlowsReadiness';
import { revalidateSymbols } from '../revalidateSymbols';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { Drizzle13fRepository } from '@/entities/investor-flows/api/investorFlows13fRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '@/entities/investor-flows/api/investorFlowsUniverseRepository';
import type { Ingest13fDeps } from '@/entities/investor-flows/server/ingest13f';

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * SEC가 속도 제한·차단으로 거절했는가. 재시도를 다 쓴 429와 S3 AccessDenied가 아닌 403이 여기에 온다 —
 * 이 신호를 받으면 배치는 SEC를 더 두드리지 않고 멈춘다.
 */
export function isSecBlockedError(error: unknown): boolean {
    return (
        error instanceof SecHttpError &&
        (error.status === HTTP_FORBIDDEN ||
            error.status === HTTP_TOO_MANY_REQUESTS)
    );
}

/** I/O 구성은 entity `lib/`가 아니라 이 호출자에 둔다(EN-1). DB가 없으면 던진다. */
export function createSec13fDeps(
    isDeadlineReached: () => boolean
): Ingest13fDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[sec-13f] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    return {
        sec: {
            fetchDailyFormIndex,
            fetchFilingIndexJson,
            fetchFilingDocumentText,
            fetchFilingDocumentStream,
        },
        repo: new Drizzle13fRepository(client.db),
        loadUniverse: () => universeRepo.loadUniverse(),
        isSecBlockedError,
        now: () => new Date(),
        isDeadlineReached,
        invalidateSymbols: symbols => revalidateSymbols(symbols),
        onBackfillCompleted: revalidateFlowsReadiness,
        log: (message, detail) => console.warn(message, detail),
    };
}
