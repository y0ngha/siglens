import { describe, expect, it } from 'vitest';
import {
    missingAssetMentions,
    SUPPORTED_ASSET_IDS,
    SUPPORTED_ASSET_TERMS,
} from '@/shared/config/supportedAssets';
import {
    ROOT_HEADLINE,
    ROOT_KEYWORDS,
    ROOT_TITLE,
    SITE_DESCRIPTION,
} from '@/shared/lib/seo';
import { buildHomeHowToJsonLd, HOME_FAQ_JSON_LD } from '@/app/homeJsonLd';
import { NEWS_HUB_DESCRIPTION, NEWS_HUB_TITLE } from '@/app/news/page';

const SKILL_COUNTS = {
    indicators: 25,
    candlesticks: 30,
    patterns: 12,
    strategies: 8,
    supportResistance: 5,
    fundamental: 4,
    news: 3,
};

/**
 * 자산군 커버리지가 표면마다 어긋나는 것을 막는다.
 *
 * 이 테스트가 지키는 실패 모드: 자산군을 하나 추가하면서 SEO 타이틀만 고치고
 * FAQ·HowTo·OG alt·키워드를 놓치는 것. 그러면 그 표면들은 "그 자산군은 지원하지
 * 않는다"는 신호를 검색엔진에 계속 보내는데, 렌더도 빌드도 아무 것도 실패하지
 * 않아 다음 감사까지 드러나지 않는다 — 실제로 세 라운드 연속 발생했다
 * (MISTAKES.md §6.6).
 *
 * `SUPPORTED_ASSET_TERMS`에 자산군을 추가하면 별칭을 언급하지 않은 표면 전부가
 * 여기서 동시에 깨진다. 문장은 사람이 쓰되, 커버리지는 기계가 강제한다.
 */
describe('자산군 커버리지 동기화', () => {
    const HOWTO = buildHomeHowToJsonLd(SKILL_COUNTS);

    const SURFACES: Array<[string, string]> = [
        ['ROOT_TITLE', ROOT_TITLE],
        ['ROOT_HEADLINE', ROOT_HEADLINE],
        ['SITE_DESCRIPTION', SITE_DESCRIPTION],
        ['ROOT_KEYWORDS', ROOT_KEYWORDS.join(' ')],
        ['HowTo.name', HOWTO.name],
        ['HowTo.description', HOWTO.description],
        [
            'FAQ 서비스 소개 답변',
            HOME_FAQ_JSON_LD.mainEntity[0]!.acceptedAnswer.text,
        ],
        // 뉴스 허브는 사이트에서 자산군 커버리지를 가장 직접적으로 주장하는 표면이다.
        ['NEWS_HUB_TITLE', NEWS_HUB_TITLE],
        ['NEWS_HUB_DESCRIPTION', NEWS_HUB_DESCRIPTION],
    ];

    it.each(SURFACES)('%s는 모든 자산군을 언급한다', (_label, text) => {
        expect(missingAssetMentions(text)).toEqual([]);
    });

    it('OG alt는 ROOT_HEADLINE에서 파생된다 — 별도 리터럴이면 동기화가 깨진다', async () => {
        const { readFile } = await import('node:fs/promises');
        const layout = await readFile('src/app/layout.tsx', 'utf8');
        expect(layout).toContain('${ROOT_HEADLINE}');
    });

    describe('missingAssetMentions', () => {
        it('언급이 없는 자산군만 돌려준다', () => {
            expect(missingAssetMentions('미국 주식과 암호화폐 분석')).toEqual([
                'krEquity',
            ]);
        });

        it('모두 언급하면 빈 배열', () => {
            expect(
                missingAssetMentions('미국 주식, 코스피 종목, 비트코인')
            ).toEqual([]);
        });

        it('빈 문자열은 전 자산군을 누락으로 본다', () => {
            expect(missingAssetMentions('')).toEqual(SUPPORTED_ASSET_IDS);
        });
    });

    it('별칭 목록이 비어 있는 자산군이 없다 — 빈 목록은 항상 통과해 검사를 무력화한다', () => {
        for (const id of SUPPORTED_ASSET_IDS) {
            expect(SUPPORTED_ASSET_TERMS[id].length).toBeGreaterThan(0);
        }
    });
});
