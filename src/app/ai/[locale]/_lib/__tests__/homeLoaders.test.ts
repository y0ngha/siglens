import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    findByUser: vi.fn(),
    getAgentSuggestions: vi.fn(),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: class {
        findByUser = m.findByUser;
    },
}));
vi.mock('@/entities/agent-suggestions/api', () => ({
    getAgentSuggestions: m.getAgentSuggestions,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { loadAiHomeSuggestions } from '../homeLoaders';

describe('loadAiHomeSuggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('포트폴리오 심볼을 제안 생성에 넘긴다', async () => {
        m.findByUser.mockResolvedValue([
            { symbol: 'AAPL' },
            { symbol: 'TSLA' },
        ]);
        m.getAgentSuggestions.mockResolvedValue(['a']);
        await expect(loadAiHomeSuggestions('u1', 'ko')).resolves.toEqual(['a']);
        expect(m.getAgentSuggestions).toHaveBeenCalledWith({
            locale: 'ko',
            userId: 'u1',
            portfolioSymbols: ['AAPL', 'TSLA'],
        });
    });

    it('제안 생성이 실패하면 로그를 남기고 null이다', async () => {
        const error = new Error('boom');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        m.findByUser.mockResolvedValue([]);
        m.getAgentSuggestions.mockRejectedValue(error);
        await expect(loadAiHomeSuggestions('u1', 'ko')).resolves.toBeNull();
        expect(spy).toHaveBeenCalledWith(
            '[AiHomePage] loadSuggestions failed:',
            error
        );
    });

    it('포트폴리오 조회가 실패해도 null이다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        m.findByUser.mockRejectedValue(new Error('db'));
        await expect(loadAiHomeSuggestions('u1', 'ko')).resolves.toBeNull();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(m.getAgentSuggestions).not.toHaveBeenCalled();
    });
});
