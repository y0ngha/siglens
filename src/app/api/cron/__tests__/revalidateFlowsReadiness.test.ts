const { mockRevalidateTag } = vi.hoisted(() => ({
    mockRevalidateTag: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));
vi.mock('server-only', () => ({}));

import { describe, expect, it, vi } from 'vitest';
import { INVESTOR_FLOWS_READINESS_TAG } from '@/entities/investor-flows/lib/investorFlowsTag';
import { revalidateFlowsReadiness } from '../revalidateFlowsReadiness';

describe('revalidateFlowsReadiness', () => {
    it('invalidates the global readiness tag with the max profile (Next 16 two-argument form)', () => {
        revalidateFlowsReadiness();
        expect(mockRevalidateTag).toHaveBeenCalledWith(
            INVESTOR_FLOWS_READINESS_TAG,
            'max'
        );
        expect(INVESTOR_FLOWS_READINESS_TAG).toBe(
            'investor-flows:pipeline-readiness'
        );
    });
});
