import { buildTechnicalFacts } from '@/entities/bars/lib/technicalFacts';
import { buildFearGreedSeedBars } from '@/__tests__/utils/fearGreedSeedBars';
import { hasFearGreedScore } from '../utils/hasFearGreedScore';

describe('hasFearGreedScore', () => {
    it('점수 표본이 충분하면 true', () => {
        expect(hasFearGreedScore(buildFearGreedSeedBars(300))).toBe(true);
    });

    it('봉은 있으나 점수 표본이 모자라면 false — buildTechnicalFacts는 값을 내는 구간', () => {
        const shortBars = buildFearGreedSeedBars(20);

        // 이 구간이 바로 옛 게이트(`buildTechnicalFacts !== null`)와 본문(`점수 null →
        // 요약 생략`)이 갈리던 영역이다. 두 술어가 실제로 다르다는 것을 못 박는다.
        expect(
            buildTechnicalFacts(shortBars.bars, shortBars.indicators)
        ).not.toBeNull();
        expect(hasFearGreedScore(shortBars)).toBe(false);
    });

    it('봉이 비어 있으면 false', () => {
        expect(hasFearGreedScore(buildFearGreedSeedBars(0))).toBe(false);
    });
});
