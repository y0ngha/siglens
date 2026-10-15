import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import { CachedInvestorFlowsFmpProvider } from './CachedInvestorFlowsFmpProvider';
import { FmpInvestorFlowsClient } from './investorFlowsFmpClient';
import type { InvestorFlowsFmpProvider } from './investorFlowsProvider.types';

/** Returns the app's investorFlows FMP provider (FMP + Redis in prod, fake under E2E_TEST). */
export const getInvestorFlowsFmpProvider: () => InvestorFlowsFmpProvider =
    createE2EGatedSingleton<InvestorFlowsFmpProvider>(
        () => new CachedInvestorFlowsFmpProvider(new FmpInvestorFlowsClient()),
        () => {
            // Sync factory — the fake loads via a gated require (see getCongressTradesProvider).
            const { FakeInvestorFlowsFmpProvider } =
                require('./FakeInvestorFlowsFmpProvider') as typeof import('./FakeInvestorFlowsFmpProvider');
            return new FakeInvestorFlowsFmpProvider();
        }
    );
