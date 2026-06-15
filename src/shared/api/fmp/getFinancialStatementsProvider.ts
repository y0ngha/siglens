import { CachedFinancialStatementsProvider } from './CachedFinancialStatementsProvider';
import { FmpFinancialStatementsClient } from './financialStatementsClient';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';

export type { FinancialStatementsProvider } from '@y0ngha/siglens-core';

let cached: FinancialStatementsProvider | null = null;

/** Returns the app's financial statements provider (FMP in prod, fake under E2E_TEST). */
export function getFinancialStatementsProvider(): FinancialStatementsProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // Sync factory — no dynamic import possible here, so the fake loads via a
        // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
        // still bundles it into the server output).
        const { FakeFinancialStatementsProvider } =
            require('./FakeFinancialStatementsProvider') as typeof import('./FakeFinancialStatementsProvider');
        cached = new FakeFinancialStatementsProvider();
        return cached;
    }
    cached = new CachedFinancialStatementsProvider(
        new FmpFinancialStatementsClient()
    );
    return cached;
}
