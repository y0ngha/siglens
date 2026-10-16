import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { dartFatalReason, realDartClient } from '@/shared/api/dart/dartClient';
import { createFakeDartClient } from '@/shared/api/dart/fakeDartClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { DrizzleInvestorFlowsDartRepository } from '@/entities/investor-flows/api/investorFlowsDartRepository';
import type { IngestDartFilingsDeps } from '@/entities/investor-flows/server/ingestDartFilings';
import { revalidateSymbols } from '../revalidateSymbols';

/**
 * I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. E2E(`E2E_TEST=1`)에서는 네트워크 없는 가짜 DART를 쓴다 — 운영은
 * `isE2E()`가 거짓이라 항상 실 클라이언트다.
 */
export function createDartFilingsDeps(
    isDeadlineReached: () => boolean
): IngestDartFilingsDeps {
    const client = tryGetDatabaseClient();
    if (client === null) throw new Error('[dart-filings] database unavailable');
    return {
        dart: isE2E() ? createFakeDartClient() : realDartClient,
        repo: new DrizzleInvestorFlowsDartRepository(client.db),
        fatalReason: dartFatalReason,
        now: () => new Date(),
        isDeadlineReached,
        invalidateSymbols: symbols => revalidateSymbols(symbols),
        log: (message, detail) => console.warn(message, detail ?? ''),
    };
}
