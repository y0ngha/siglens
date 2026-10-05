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

    /**
     * 게이트는 본문·헤더 배지와 같은 5년 일봉으로 판정해야 한다. 표준(2년) 봉으로
     * 판정하면, 표준 봉만으로는 표본이 모자라도 5년으로는 점수가 나오는 종목이
     * noindex로 닫힌다(또는 그 반대).
     */
    it('표준 봉으로는 표본이 모자라도 5년 일봉(fearGreedBars)으로 점수가 나오면 true', () => {
        const standard = buildFearGreedSeedBars(20);
        const long = buildFearGreedSeedBars(300);

        expect(hasFearGreedScore(standard)).toBe(false);
        expect(
            hasFearGreedScore({ ...standard, fearGreedBars: long.bars })
        ).toBe(true);
    });

    it('5년 일봉으로 표본이 모자라면 표준 봉에 표본이 있어도 false', () => {
        const standard = buildFearGreedSeedBars(300);
        const shortLong = buildFearGreedSeedBars(20);

        expect(hasFearGreedScore(standard)).toBe(true);
        expect(
            hasFearGreedScore({ ...standard, fearGreedBars: shortLong.bars })
        ).toBe(false);
    });

    it('봉이 비어 있으면 false', () => {
        expect(hasFearGreedScore(buildFearGreedSeedBars(0))).toBe(false);
    });
});
