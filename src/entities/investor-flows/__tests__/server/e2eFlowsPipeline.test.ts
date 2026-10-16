import { afterEach, describe, expect, it, vi } from 'vitest';
import { isE2EFlowsPipelineCollecting } from '../../server/e2eFlowsPipeline';

describe('isE2EFlowsPipelineCollecting', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('is on only when E2E_TEST=1 and E2E_FLOWS_PIPELINE=collecting', () => {
        vi.stubEnv('E2E_TEST', '1');
        vi.stubEnv('E2E_FLOWS_PIPELINE', 'collecting');
        expect(isE2EFlowsPipelineCollecting()).toBe(true);
    });

    it('has no effect without E2E_TEST (a stray production env var must do nothing)', () => {
        vi.stubEnv('E2E_TEST', '');
        vi.stubEnv('E2E_FLOWS_PIPELINE', 'collecting');
        expect(isE2EFlowsPipelineCollecting()).toBe(false);
    });

    it('is off for any other value under E2E', () => {
        vi.stubEnv('E2E_TEST', '1');
        vi.stubEnv('E2E_FLOWS_PIPELINE', 'ready');
        expect(isE2EFlowsPipelineCollecting()).toBe(false);
        vi.stubEnv('E2E_FLOWS_PIPELINE', '');
        expect(isE2EFlowsPipelineCollecting()).toBe(false);
    });
});
