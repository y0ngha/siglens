import { describe, expect, it } from 'vitest';
import { shouldRefetchBarsSeed } from '@/views/symbol/utils/shouldRefetchBarsSeed';

const CLOSED_AND_IDLE = {
    humanInteracted: false,
    hasStoredChartPreferences: false,
    seedHasFormingBarTrimmed: false,
    formingBarNow: false,
} as const;

describe('shouldRefetchBarsSeed', () => {
    it('seed가 완전하고 장 마감이며 입력·저장된 설정이 없으면 미룬다', () => {
        expect(shouldRefetchBarsSeed(CLOSED_AND_IDLE)).toBe(false);
    });

    it.each([
        ['사람 입력', { humanInteracted: true }],
        ['저장된 차트 설정', { hasStoredChartPreferences: true }],
        [
            '생성 시점에 형성 중 봉이 빠진 seed (장중 생성 → 장 마감 뒤 열람)',
            { seedHasFormingBarTrimmed: true },
        ],
        [
            '뷰 시점 정규장 (장 마감 중 생성 → 장중 열람)',
            { formingBarNow: true },
        ],
    ])('%s이면 연다', (_label, override) => {
        expect(shouldRefetchBarsSeed({ ...CLOSED_AND_IDLE, ...override })).toBe(
            true
        );
    });

    it('정규장 중 + 생성도 장중(e2e 회귀 구성)이면 입력 없이 연다', () => {
        expect(
            shouldRefetchBarsSeed({
                ...CLOSED_AND_IDLE,
                seedHasFormingBarTrimmed: true,
                formingBarNow: true,
            })
        ).toBe(true);
    });
});
