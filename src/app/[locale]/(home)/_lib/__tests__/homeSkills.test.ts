const mocks = vi.hoisted(() => ({
    countSkillFiles: vi.fn(),
    loadShowcaseSkills: vi.fn(),
}));

vi.mock('@/entities/skill/api', () => ({
    countSkillFiles: mocks.countSkillFiles,
    loadShowcaseSkills: mocks.loadShowcaseSkills,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Skill } from '@y0ngha/siglens-core';
import {
    EMPTY_SKILL_COUNTS,
    loadShowcase,
    loadSkillCounts,
} from '@/app/[locale]/(home)/_lib/homeSkills';

const COUNTS = {
    indicators: 13,
    candlesticks: 30,
    patterns: 5,
    strategies: 4,
    supportResistance: 3,
    fundamental: 2,
    news: 1,
};

describe('loadSkillCounts', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('읽은 개수를 그대로 돌려준다', async () => {
        mocks.countSkillFiles.mockResolvedValue(COUNTS);

        await expect(loadSkillCounts()).resolves.toEqual(COUNTS);
    });

    it('읽기가 실패하면 전 항목 0으로 폴백한다', async () => {
        mocks.countSkillFiles.mockRejectedValue(new Error('ENOENT'));

        await expect(loadSkillCounts()).resolves.toEqual({
            indicators: 0,
            candlesticks: 0,
            patterns: 0,
            strategies: 0,
            supportResistance: 0,
            fundamental: 0,
            news: 0,
        });
    });

    it('실패를 [Home] 접두사로 로그에 남긴다', async () => {
        const error = new Error('ENOENT');
        mocks.countSkillFiles.mockRejectedValue(error);

        await loadSkillCounts();

        expect(consoleError).toHaveBeenCalledWith(
            '[Home] countSkillFiles failed:',
            error
        );
    });

    it('폴백 값은 EMPTY_SKILL_COUNTS다', async () => {
        mocks.countSkillFiles.mockRejectedValue(new Error('ENOENT'));

        await expect(loadSkillCounts()).resolves.toBe(EMPTY_SKILL_COUNTS);
    });
});

describe('loadShowcase', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('쇼케이스 목록을 그대로 돌려준다', async () => {
        const skills = [{ name: 'RSI' }] as unknown as Skill[];
        mocks.loadShowcaseSkills.mockResolvedValue(skills);

        await expect(loadShowcase()).resolves.toBe(skills);
    });

    it('읽기가 실패하면 빈 목록으로 폴백하고 [Home] 접두사로 로그에 남긴다', async () => {
        const error = new Error('skills dir unreadable');
        mocks.loadShowcaseSkills.mockRejectedValue(error);

        await expect(loadShowcase()).resolves.toEqual([]);
        expect(consoleError).toHaveBeenCalledWith(
            '[Home] loadShowcaseSkills failed:',
            error
        );
    });
});
