import { describe, expect, it } from 'vitest';
import {
    buildGuideLinks,
    renderGuideLinksSource,
    type GuideSeedMeta,
    type SkillMeta,
} from '../generate-guide-links';

const skill = (
    basename: string,
    name: string,
    triggerIds: string[] = [],
    dir = 'indicators'
): SkillMeta => ({ basename, dir, name, triggerIds });

const guide = (
    slug: string,
    category: GuideSeedMeta['category'],
    order: number,
    skills: string[] | null = null
): GuideSeedMeta => ({ slug, category, order, skills });

describe('buildGuideLinks', () => {
    it('스킬 name과 트리거 id를 가이드 경로로 잇는다', () => {
        const links = buildGuideLinks(
            [guide('rsi', 'indicators', 1)],
            [skill('rsi', 'RSI Guide', ['rsi_oversold', 'rsi_overbought'])]
        );

        expect(links.byName).toEqual({ 'RSI Guide': '/guide/indicators/rsi' });
        expect(links.byTrigger).toEqual({
            rsi_oversold: '/guide/indicators/rsi',
            rsi_overbought: '/guide/indicators/rsi',
        });
    });

    it('skills를 생략하면 [slug]를 쓰고, 같은 이름 스킬이 없어도 에러가 아니다', () => {
        const links = buildGuideLinks(
            [guide('candle-basics', 'candlesticks', 1)],
            []
        );

        expect(links.byName).toEqual({});
    });

    it('명시한 skills가 없는 파일이면 던진다', () => {
        expect(() =>
            buildGuideLinks([guide('macd', 'indicators', 1, ['ghost'])], [])
        ).toThrow(/ghost 스킬 파일이 없다/);
    });

    it('skills 빈 배열은 아무것도 잇지 않는다', () => {
        const links = buildGuideLinks(
            [guide('rsi', 'indicators', 1, [])],
            [skill('rsi', 'RSI Guide', ['rsi_oversold'])]
        );

        expect(links.byName).toEqual({});
        expect(links.byTrigger).toEqual({});
    });

    it('한 항목이 여러 스킬을 설명할 수 있다', () => {
        const links = buildGuideLinks(
            [guide('macd', 'indicators', 1, ['macd', 'macd-v'])],
            [skill('macd', 'MACD'), skill('macd-v', 'MACD-V')]
        );

        expect(links.byName).toEqual({
            MACD: '/guide/indicators/macd',
            'MACD-V': '/guide/indicators/macd',
        });
    });

    it('트리거가 겹치면 카테고리 순서상 앞선 항목이 이기고 충돌을 알린다', () => {
        const links = buildGuideLinks(
            [
                guide('divergence', 'strategies', 1),
                guide('rsi', 'indicators', 9),
            ],
            [
                skill('divergence', '다이버전스', ['rsi_bullish_divergence']),
                skill('rsi', 'RSI', ['rsi_bullish_divergence']),
            ]
        );

        expect(links.byTrigger.rsi_bullish_divergence).toBe(
            '/guide/indicators/rsi'
        );
        expect(links.collisions).toEqual([
            'trigger "rsi_bullish_divergence": /guide/indicators/rsi 유지, /guide/strategies/divergence 무시',
        ]);
    });

    it('입력 순서가 달라도 결과가 같다', () => {
        const guides = [
            guide('a', 'indicators', 2),
            guide('b', 'indicators', 1),
            guide('c', 'candlesticks', 5),
        ];
        const skills = [
            skill('a', 'A', ['t']),
            skill('b', 'B', ['t']),
            skill('c', 'C', ['t']),
        ];

        expect(
            buildGuideLinks(guides.toReversed(), skills.toReversed())
        ).toEqual(buildGuideLinks(guides, skills));
    });

    it('스킬 basename이 겹치면 던진다', () => {
        expect(() =>
            buildGuideLinks(
                [],
                [skill('x', 'X1'), skill('x', 'X2', [], 'patterns')]
            )
        ).toThrow(/겹친다/);
    });

    it('pattern id도 트리거로 쓴다', () => {
        const links = buildGuideLinks(
            [guide('double-top', 'chart-patterns', 1)],
            [skill('double-top', '이중천장', ['double_top'], 'patterns')]
        );

        expect(links.byTrigger).toEqual({
            double_top: '/guide/chart-patterns/double-top',
        });
    });
});

describe('renderGuideLinksSource', () => {
    const links = {
        byName: { 이중천장: '/guide/a/b', 'Two Words': '/guide/c/d' },
        byTrigger: { double_top: '/guide/a/b' },
        collisions: [],
    };

    it('생성물 안내 주석과 두 상수를 낸다', () => {
        const source = renderGuideLinksSource(links);

        expect(source).toContain('생성물이다');
        expect(source).toContain('yarn guide:links');
        expect(source).toContain('export const GUIDE_PATH_BY_SKILL_NAME');
        expect(source).toContain('export const GUIDE_PATH_BY_TRIGGER');
    });

    it('식별자가 될 수 있는 키만 따옴표를 벗긴다', () => {
        const source = renderGuideLinksSource(links);

        expect(source).toContain("    이중천장: '/guide/a/b',");
        expect(source).toContain("    'Two Words': '/guide/c/d',");
        expect(source).toContain("    double_top: '/guide/a/b',");
    });

    it('80칸을 넘기면 값을 다음 줄로 내린다', () => {
        const long = '/guide/candlesticks/' + 'x'.repeat(50);
        const source = renderGuideLinksSource({
            ...links,
            byName: { 'A fairly long skill name here': long },
        });

        expect(source).toContain(
            `    'A fairly long skill name here':\n        '${long}',`
        );
    });
});
