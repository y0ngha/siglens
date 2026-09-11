import type { SkillCounts } from '@y0ngha/siglens-core';
import { describe, it, expect } from 'vitest';
import { resolveAboutContent } from '@/app/[locale]/about/content';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import { GITHUB_URL } from '@/shared/lib/seo';

const COUNTS: SkillCounts = {
    indicators: 13,
    candlesticks: 30,
    patterns: 5,
    strategies: 4,
    supportResistance: 3,
    fundamental: 2,
    news: 1,
};

function h2Lines(markdown: string): string[] {
    return markdown.split('\n').filter(line => line.startsWith('## '));
}

describe('resolveAboutContent', () => {
    it('ko는 폴백 없이 원문을 그대로 낸다', () => {
        const result = resolveAboutContent('ko', COUNTS);
        expect(result.bodyLocale).toBe('ko');
        expect(result.isTranslationFallback).toBe(false);
    });

    it('번역이 없는 로케일(ja)은 ko로 폴백하고 isTranslationFallback을 true로 표시한다', () => {
        const result = resolveAboutContent('ja', COUNTS);
        expect(result.bodyLocale).toBe('ko');
        expect(result.isTranslationFallback).toBe(true);
    });

    it('ko·en 본문 모두 정확히 h2 7개를 갖는다(extractToc의 목차 개수와 직결)', () => {
        expect(h2Lines(resolveAboutContent('ko', COUNTS).body)).toHaveLength(7);
        expect(h2Lines(resolveAboutContent('en', COUNTS).body)).toHaveLength(7);
    });

    it('ko 본문에 운영자 이메일과 GitHub URL이 실제로 포함된다', () => {
        const { body } = resolveAboutContent('ko', COUNTS);
        expect(body).toContain(SITE_OPERATOR.email);
        expect(body).toContain(SITE_OPERATOR.githubUrl);
        expect(body).toContain(GITHUB_URL);
    });

    it('ko·en 본문 모두 홈과 같은 소스(countSkillFiles)의 카운트를 그대로 반영한다', () => {
        const ko = resolveAboutContent('ko', COUNTS).body;
        const en = resolveAboutContent('en', COUNTS).body;
        expect(ko).toContain(`보조지표 ${COUNTS.indicators}종`);
        expect(ko).toContain(`캔들 패턴 ${COUNTS.candlesticks}종`);
        expect(ko).toContain(`전략 스킬 ${COUNTS.strategies}종`);
        expect(en).toContain(`${COUNTS.indicators} technical indicators`);
        expect(en).toContain(`${COUNTS.candlesticks} candlestick patterns`);
        expect(en).toContain(`${COUNTS.strategies} strategy skills`);
    });
});
