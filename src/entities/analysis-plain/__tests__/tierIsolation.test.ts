import { createHash } from 'node:crypto';
import { filterAnalysisResult } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { extractProse } from '@/entities/analysis-translation';
import { collectFacts } from '../lib/collectFacts';
import { buildPlainPrompt } from '../lib/buildPlainPrompt';
import { dropSupersededPaths } from '../lib/supersededPaths';

/**
 * 평이화 산출물은 문자열 한 덩어리라 **사후 필드 마스킹이 불가능하다.** 필터 전
 * payload를 넣으면 유료 콘텐츠가 평문 산문으로 그대로 샌다. 캐시 키가 티어를
 * 가르는 것도 전적으로 "필터가 먼저"에 의존한다 — 필터 전 값을 해시하면 세 티어가
 * 같은 키를 갖고 하나의 유료 문장이 전 티어에 서빙된다.
 *
 * 이 스위트가 그 계약을 고정한다.
 */
const ANALYSIS = {
    summary: '요약 문장입니다.',
    trend: 'bullish' as const,
    riskLevel: 'medium' as const,
    indicatorResults: [],
    keyLevels: {
        support: [
            { price: 183.6, reason: '여러 번 반등이 나온 자리입니다.' },
            { price: 180.34, reason: '더 아래의 지지 구간입니다.' },
        ],
        resistance: [{ price: 188.37, reason: '직전 고점입니다.' }],
    },
    priceTargets: { bullish: null, bearish: null },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
    actionRecommendation: {
        entry: '183.60달러 부근에서 진입을 검토합니다.',
        exit: '196.53달러에서 청산합니다.',
        riskReward: '손익비는 3.2입니다.',
        positionAnalysis: '상승 추세가 유효합니다.',
    },
};

/** `rewriteToPlainLanguage`가 캐시 키를 만드는 것과 같은 순서로 프롬프트를 만든다. */
function promptFor(analysis: unknown): string {
    const entries = dropSupersededPaths(extractProse(analysis));
    return buildPlainPrompt({
        entries,
        facts: collectFacts(analysis, 'PLTR'),
        locale: 'ko',
    });
}
const keyFor = (analysis: unknown) =>
    createHash('sha256').update(promptFor(analysis)).digest('hex');

describe('티어 격리', () => {
    it('free 필터는 산문 조각을 실제로 줄인다', () => {
        const free = filterAnalysisResult(ANALYSIS, 'free');
        const member = filterAnalysisResult(ANALYSIS, 'member');
        const freeEntries = extractProse(free.result);
        const memberEntries = extractProse(member.result);

        expect(free.lockedInfoDepth.length).toBeGreaterThan(0);
        expect(freeEntries.length).toBeLessThan(memberEntries.length);
    });

    it('free의 프롬프트에 잠긴 매매 문구가 실리지 않는다', () => {
        const free = filterAnalysisResult(ANALYSIS, 'free');
        const prompt = promptFor(free.result);

        expect(prompt).not.toContain('196.53달러에서 청산');
        expect(prompt).not.toContain('183.60달러 부근에서 진입');
    });

    it('free와 member의 캐시 키가 다르다', () => {
        expect(keyFor(filterAnalysisResult(ANALYSIS, 'free').result)).not.toBe(
            keyFor(filterAnalysisResult(ANALYSIS, 'member').result)
        );
    });

    /**
     * 같은 것은 leak이 아니라 정확한 동작이다 — 두 티어의 필터 결과가 실제로
     * 동일하므로 같은 문장을 공유해야 맞다. 티어 세그먼트를 키에 넣으면 이 공유가
     * 깨져 LLM 호출이 불필요하게 두 배가 된다.
     */
    it('필터 결과가 같은 티어끼리는 캐시를 공유한다', () => {
        expect(keyFor(filterAnalysisResult(ANALYSIS, 'member').result)).toBe(
            keyFor(filterAnalysisResult(ANALYSIS, 'pro').result)
        );
    });

    it('필터 전 payload는 free와 다른 키를 만든다 — 순서가 뒤바뀌면 테스트가 깨진다', () => {
        expect(keyFor(ANALYSIS)).not.toBe(
            keyFor(filterAnalysisResult(ANALYSIS, 'free').result)
        );
    });
});
