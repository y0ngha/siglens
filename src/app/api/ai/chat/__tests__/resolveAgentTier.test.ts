import { describe, expect, it, vi } from 'vitest';

const { mockTier } = vi.hoisted(() => ({ mockTier: vi.fn() }));
vi.mock('@/shared/lib/byokGate', () => ({ resolveTierOnly: mockTier }));

import { resolveAgentTier } from '@/app/api/ai/chat/resolveAgentTier';

describe('resolveAgentTier', () => {
    it('회원 티어를 그대로 돌려준다', async () => {
        mockTier.mockResolvedValue('member');
        expect(await resolveAgentTier('u1')).toBe('member');
        expect(mockTier).toHaveBeenCalledWith('u1');
    });
});
