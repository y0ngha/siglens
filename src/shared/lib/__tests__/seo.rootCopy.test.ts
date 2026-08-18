import { describe, it, expect } from 'vitest';
import {
    ROOT_TITLE,
    SITE_DESCRIPTION,
    ROOT_KEYWORDS,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
} from '../seo';

/**
 * 홈은 사이트 전체의 주제를 선언하는 가장 강한 신호다. 서비스가 커버하는 자산군 중
 * 하나라도 여기서 빠지면 그 클러스터의 주제 관련성이 통째로 눌린다 — 실제로 국내
 * 상장 종목을 서비스하면서 루트 메타는 "미국 주식과 암호화폐"라고만 말하고 있었고,
 * 정작 홈 본문에는 `한국 주식` 카테고리 카드가 렌더되고 있었다.
 */
describe('root SEO copy is multi-asset (US + KR stocks + crypto)', () => {
    it('mentions 미국·한국 주식 and 암호화폐 in the title', () => {
        expect(ROOT_TITLE).toContain('미국');
        expect(ROOT_TITLE).toContain('한국');
        expect(ROOT_TITLE).toContain('암호화폐');
    });
    it('description references both equity markets and crypto', () => {
        expect(SITE_DESCRIPTION).toContain('미국');
        expect(SITE_DESCRIPTION).toContain('한국');
        expect(SITE_DESCRIPTION).toContain('암호화폐');
    });
    it('keywords include crypto search intents', () => {
        expect(ROOT_KEYWORDS).toContain('암호화폐 분석');
        expect(ROOT_KEYWORDS).toContain('비트코인 차트');
    });
    it('keywords include Korean-market search intents', () => {
        expect(ROOT_KEYWORDS).toContain('한국 주식 AI 분석');
        expect(ROOT_KEYWORDS).toContain('코스피 종목 분석');
        expect(ROOT_KEYWORDS).toContain('코스닥 종목 분석');
    });

    /**
     * 회귀 가드(SEO 감사 라운드 2 finding 3): `ROOT_TITLE`이 " | Siglens" 접미사를
     * 직접 갖고 있어(layout.tsx의 `title.default`는 `title.template`을 거치지
     * 않는다) 65 폭단위로 SEO_TITLE_MAX_WIDTH(55)를 넘고 있었다. 브랜드 접미사를
     * 빼서 symbolMetadataFromSeo가 2,247개 URL에 적용하는 것과 같은 근거를
     * 홈에도 적용한다.
     */
    it('ROOT_TITLE 폭이 SEO_TITLE_MAX_WIDTH를 넘지 않는다', () => {
        expect(seoTitleWidth(ROOT_TITLE)).toBeLessThanOrEqual(
            SEO_TITLE_MAX_WIDTH
        );
    });

    it('ROOT_TITLE이 "| Siglens" 브랜드 접미사를 포함하지 않는다', () => {
        expect(ROOT_TITLE).not.toContain('Siglens');
    });
});
