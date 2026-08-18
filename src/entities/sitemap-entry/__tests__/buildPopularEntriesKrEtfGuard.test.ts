/**
 * 회귀 가드(뮤테이션 감사 2026-08-18) — `buildPopularEntries.ts`는
 * `classifyAsset(ticker)`를 인자 1개로만 호출했다. `assetClassification.ts`의
 * `isKrEquitySymbol(symbol) && isKrEtfName(name)` 분기는 `name`이 없으면 절대
 * 참이 될 수 없으므로(`isKrEtfName(undefined)` === false) 국내 ETF 가드가
 * sitemap 경로에서는 구조적으로 도달 불가능했다 — 미국 ETF 12종이 방금 고친
 * 것과 같은 결함이 국내 ETF에 그대로 남아 있었다.
 *
 * `069500.KS`(KODEX 200)를 픽스처로 주입해 `stock`으로 오분류되지 않고
 * `/financials` 엔트리가 나가지 않는지 확인한다(그 페이지는 재무제표가 없어
 * 영구 noindex이므로, 잘못 sitemap에 실리면 크롤 예산만 태운다).
 *
 * MISTAKES §17: vi.mock을 별도 파일로 분리해 다른 buildPopularEntries 테스트에
 * 이 모킹이 새지 않게 한다(buildPopularEntriesKrOptionsGuard.test.ts와 동일 패턴).
 */
vi.mock('@/shared/config/popular-tickers', () => ({
    POPULAR_TICKERS: ['AAPL', '069500.KS'],
    CURATED_KOREAN_NAMES: new Map([['069500.KS', 'KODEX 200']]),
}));

import { describe, it, expect } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { buildPopularEntries } from '../lib/buildPopularEntries';

const NOW = new Date('2026-05-23T21:00:00.000Z');

describe('buildPopularEntries — KR ETF guard (mutation audit finding 6)', () => {
    it('KODEX 200(069500.KS)은 stock으로 오분류되지 않아 /financials 엔트리를 내지 않는다', () => {
        const entries = buildPopularEntries(NOW);
        const urls = entries.map(e => e.url);

        expect(urls).not.toContain(`${SITE_URL}/069500.KS/financials`);
        // 대조군: name 없이도 항상 stock으로 떨어지는 일반 미국 종목은
        // /financials가 정상적으로 존재해야 한다 — 가드가 전체를 막은 게 아님을 확인.
        expect(urls).toContain(`${SITE_URL}/AAPL/financials`);
    });
});
