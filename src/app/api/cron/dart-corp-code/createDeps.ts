import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { dartFatalReason, realDartClient } from '@/shared/api/dart/dartClient';
import { createFakeDartClient } from '@/shared/api/dart/fakeDartClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { DrizzleInvestorFlowsDartRepository } from '@/entities/investor-flows/api/investorFlowsDartRepository';
import type { IngestDartCorpCodeDeps } from '@/entities/investor-flows/server/ingestDartCorpCode';

/** I/O 구성은 이 호출자에 둔다(EN-1). DB가 없으면 던진다. E2E에서는 가짜 DART를 쓴다. */
export function createDartCorpCodeDeps(): IngestDartCorpCodeDeps {
    const client = tryGetDatabaseClient();
    if (client === null) {
        throw new Error('[dart-corp-code] database unavailable');
    }
    return {
        dart: isE2E() ? createFakeDartClient() : realDartClient,
        repo: new DrizzleInvestorFlowsDartRepository(client.db),
        fatalReason: dartFatalReason,
        log: warnWithDetail,
    };
}
