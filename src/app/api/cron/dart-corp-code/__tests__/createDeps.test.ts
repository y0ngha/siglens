const { mockClient } = vi.hoisted(() => ({ mockClient: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dartFatalReason, realDartClient } from '@/shared/api/dart/dartClient';
import { DrizzleInvestorFlowsDartRepository } from '@/entities/investor-flows/api/investorFlowsDartRepository';
import { createDartCorpCodeDeps } from '../createDeps';

describe('createDartCorpCodeDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('throws when the database is unavailable', () => {
        mockClient.mockReturnValue(null);
        expect(() => createDartCorpCodeDeps()).toThrow(
            '[dart-corp-code] database unavailable'
        );
    });

    it('wires the real DART client, the repository and the fatal classifier', () => {
        vi.stubEnv('E2E_TEST', '');
        mockClient.mockReturnValue({ db: {} });
        const deps = createDartCorpCodeDeps();
        expect(deps.dart).toBe(realDartClient);
        expect(deps.repo).toBeInstanceOf(DrizzleInvestorFlowsDartRepository);
        expect(deps.fatalReason).toBe(dartFatalReason);
    });

    it('uses the fake DART client under E2E', () => {
        vi.stubEnv('E2E_TEST', '1');
        mockClient.mockReturnValue({ db: {} });
        expect(createDartCorpCodeDeps().dart).not.toBe(realDartClient);
    });
});
