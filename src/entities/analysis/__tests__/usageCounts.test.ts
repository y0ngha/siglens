import type { UsageCounts, UsageRepository } from '@y0ngha/siglens-core';
import type {
    SiglensUsageCounts,
    SiglensUsageRepository,
} from '@/entities/analysis/usageCounts';

describe('SiglensUsageCounts type', () => {
    it('extends UsageCounts with a premium_model field', () => {
        const counts: SiglensUsageCounts = {
            analysis: 5,
            chatbot: 3,
            premium_model: 2,
        };

        expect(counts.premium_model).toBe(2);
        expect(counts.analysis).toBe(5);
        expect(counts.chatbot).toBe(3);
    });

    it('is structurally compatible with UsageCounts (superset)', () => {
        const siglensCount: SiglensUsageCounts = {
            analysis: 1,
            chatbot: 0,
            premium_model: 0,
        };

        // Widening: SiglensUsageCounts -> UsageCounts should compile
        const baseCounts: UsageCounts = siglensCount;
        expect(baseCounts.analysis).toBe(1);
        expect(baseCounts.chatbot).toBe(0);
    });
});

describe('SiglensUsageRepository interface', () => {
    it('getUsageToday returns SiglensUsageCounts including premium_model', async () => {
        const mockRepo: SiglensUsageRepository = {
            getUsageToday: vi.fn().mockResolvedValue({
                analysis: 10,
                chatbot: 5,
                premium_model: 3,
            }),
            recordUsage: vi.fn(),
        };

        const counts = await mockRepo.getUsageToday('test-ip-hash');

        expect(counts.premium_model).toBe(3);
        expect(counts.analysis).toBe(10);
        expect(counts.chatbot).toBe(5);
    });

    it('accepts optional now parameter', async () => {
        const now = new Date('2026-05-25T12:00:00Z');
        const mockRepo: SiglensUsageRepository = {
            getUsageToday: vi.fn().mockResolvedValue({
                analysis: 0,
                chatbot: 0,
                premium_model: 0,
            }),
            recordUsage: vi.fn(),
        };

        await mockRepo.getUsageToday('test-ip-hash', now);

        expect(mockRepo.getUsageToday).toHaveBeenCalledWith(
            'test-ip-hash',
            now
        );
    });

    it('extends UsageRepository — callers expecting UsageRepository accept SiglensUsageRepository', () => {
        const siglensRepo: SiglensUsageRepository = {
            getUsageToday: vi.fn().mockResolvedValue({
                analysis: 0,
                chatbot: 0,
                premium_model: 0,
            }),
            recordUsage: vi.fn(),
        };

        // Structural subtyping: SiglensUsageRepository ⊃ UsageRepository
        const baseRepo: UsageRepository = siglensRepo;
        expect(baseRepo.getUsageToday).toBeDefined();
        expect(baseRepo.recordUsage).toBeDefined();
    });
});
