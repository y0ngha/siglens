import { CachedFinancialStatementsProvider } from './CachedFinancialStatementsProvider';
import { FmpFinancialStatementsClient } from './financialStatementsClient';
import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';

/** Returns the app's financial statements provider (FMP in prod, fake under E2E_TEST). */
export const getFinancialStatementsProvider: () => FinancialStatementsProvider =
    createE2EGatedSingleton(
        () =>
            new CachedFinancialStatementsProvider(
                new FmpFinancialStatementsClient()
            ),
        () => {
            // Sync factory — no dynamic import possible here, so the fake loads via a
            // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
            // still bundles it into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeFinancialStatementsProvider } =
                require('./FakeFinancialStatementsProvider') as typeof import('./FakeFinancialStatementsProvider');
            return new FakeFinancialStatementsProvider();
        }
    );
