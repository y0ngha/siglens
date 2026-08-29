import { describe, expect, it } from 'vitest';
import {
    missingAssetMentions,
    SUPPORTED_ASSET_IDS,
    SUPPORTED_ASSET_TERMS,
} from '@/shared/config/supportedAssets';
import { clampSeoDescription, ROOT_KEYWORDS } from '@/shared/lib/seo';
import { buildHomeFaqJsonLd } from '@/app/[locale]/homeJsonLd';
// newsHubTitle/newsHubDescription은 shared.seo 카탈로그를 받는 함수로 바뀌었다
// (요구사항: 로케일별 번역자 필수 인자). 이 테스트는 자산군 커버리지가 ko
// 소스 카피에서 완전한지만 확인하므로, 카탈로그 ko 원문을 직접 읽어 검사한다
// — next-intl 요청 스코프를 여기서 흉내 낼 필요가 없다.
import koMessages from '../../../messages/ko.json';

// 홈 카피도 카탈로그가 소유한다 — 자산군 커버리지는 ko 원문 기준이다.
const ROOT_HEADLINE = koMessages.shared.seo.root.headline;
const ROOT_TITLE = koMessages.shared.seo.root.title;
const SITE_DESCRIPTION = clampSeoDescription(
    koMessages.shared.seo.root.description
);

const NEWS_HUB_TITLE = koMessages.shared.seo.newsHub.title;
const NEWS_HUB_DESCRIPTION = clampSeoDescription(
    koMessages.shared.seo.newsHub.description
);

/**
 * 자산군 커버리지가 표면마다 어긋나는 것을 막는다.
 *
 * 이 테스트가 지키는 실패 모드: 자산군을 하나 추가하면서 SEO 타이틀만 고치고
 * FAQ·OG alt·키워드를 놓치는 것. 그러면 그 표면들은 "그 자산군은 지원하지
 * 않는다"는 신호를 검색엔진에 계속 보내는데, 렌더도 빌드도 아무 것도 실패하지
 * 않아 다음 감사까지 드러나지 않는다 — 실제로 세 라운드 연속 발생했다
 * (MISTAKES.md §6.6).
 *
 * `SUPPORTED_ASSET_TERMS`에 자산군을 추가하면 별칭을 언급하지 않은 표면 전부가
 * 여기서 동시에 깨진다. 문장은 사람이 쓰되, 커버리지는 기계가 강제한다.
 */
describe('자산군 커버리지 동기화', () => {
    /**
     * ko 카탈로그를 그대로 읽는 번역자 — `NEWS_HUB_TITLE`과 같은 이유다.
     * 자산군 커버리지가 **ko 소스 카피에서** 완전한지만 보므로 요청 스코프를
     * 흉내 낼 필요가 없다. 스텁이 아니라 실제 카탈로그라, 키가 빠지면
     * 키 문자열이 그대로 나와 커버리지 단언이 실패한다.
     */
    const tJsonLd = (
        key: string,
        values?: Record<string, string | number>
    ): string => {
        const raw = key
            .split('.')
            .reduce<unknown>(
                (node, seg) =>
                    node && typeof node === 'object'
                        ? (node as Record<string, unknown>)[seg]
                        : undefined,
                koMessages.app.home.jsonLd
            ) as string | undefined;
        if (raw === undefined) return key;
        return Object.entries(values ?? {}).reduce(
            (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
            raw
        );
    };

    const FAQ = buildHomeFaqJsonLd(tJsonLd) as {
        mainEntity: Array<{ acceptedAnswer: { text: string } }>;
    };

    const SURFACES: Array<[string, string]> = [
        ['ROOT_TITLE', ROOT_TITLE],
        ['ROOT_HEADLINE', ROOT_HEADLINE],
        ['SITE_DESCRIPTION', SITE_DESCRIPTION],
        ['ROOT_KEYWORDS', ROOT_KEYWORDS.join(' ')],
        ['FAQ 서비스 소개 답변', FAQ.mainEntity[0]!.acceptedAnswer.text],
        // 뉴스 허브는 사이트에서 자산군 커버리지를 가장 직접적으로 주장하는 표면이다.
        ['NEWS_HUB_TITLE', NEWS_HUB_TITLE],
        ['NEWS_HUB_DESCRIPTION', NEWS_HUB_DESCRIPTION],
    ];

    it.each(SURFACES)('%s는 모든 자산군을 언급한다', (_label, text) => {
        expect(missingAssetMentions(text)).toEqual([]);
    });

    it('OG alt는 root.headline에서 파생된다 — 별도 리터럴이면 동기화가 깨진다', async () => {
        // 루트 메타데이터가 카탈로그로 옮겨지면서 파생 소스도 상수에서
        // `shared.seo.root.headline`으로 바뀌었다. alt에 자산군 문구를
        // **직접 쓰면** 헤드라인과 갈리므로, 파생 형태를 그대로 강제한다.
        const { readFile } = await import('node:fs/promises');
        const layout = await readFile('src/app/[locale]/layout.tsx', 'utf8');

        expect(layout).toContain("tSeo('root.ogImageAlt'");
        expect(layout).toContain("v0: tSeo('root.headline')");
    });

    it('og alt 문구가 헤드라인을 자리표시자로 받는다', () => {
        // `{v0}`가 빠지면 헤드라인이 통째로 사라져 자산군 언급이 날아간다.
        expect(koMessages.shared.seo.root.ogImageAlt).toContain('{v0}');
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
