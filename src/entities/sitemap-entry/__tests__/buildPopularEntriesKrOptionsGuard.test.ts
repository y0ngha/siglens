/**
 * 회귀 가드(SEO 감사 finding 3): `POPULAR_OPTIONS_TICKERS`는 FMP의 미국 옵션
 * 유니버스에서 생성되므로 지금은 우연히 한국 종목이 하나도 없다 — 그래서
 * `/options` 배제가 "의도된 가드"인지 "생성기가 우연히 안 넣어준 것"인지
 * 실제 데이터만으로는 구분할 수 없다. 이 테스트는 `POPULAR_OPTIONS_TICKERS`를
 * 한국 종목을 포함하도록 모킹해, `buildPopularEntries`의 `isKr` 가드가 실제로
 * 그 경우를 막아내는지 직접 확인한다.
 *
 * MISTAKES §17: all vi.mock 위에서 호이스팅 — 별도 파일로 분리해 다른
 * buildPopularEntries 테스트에 이 모킹이 새지 않게 한다.
 */
vi.mock('../config/popular-options-tickers', () => ({
    POPULAR_OPTIONS_TICKERS: ['AAPL', '005930.KS'],
}));

import { describe, it, expect } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { buildPopularEntries } from '../lib/buildPopularEntries';

const NOW = new Date('2026-05-23T21:00:00.000Z');

describe('buildPopularEntries — options isKr guard (finding 3)', () => {
    it('한국 종목이 옵션 생성 목록에 있어도 /options 엔트리를 내지 않는다', () => {
        const entries = buildPopularEntries(NOW);
        const urls = entries.map(e => e.url);
        // 005930.KS는 POPULAR_TICKERS에 실존하는 한국 종목이고, 위 모킹으로
        // POPULAR_OPTIONS_TICKERS에도 포함돼 있다 — 그래도 /options는 없어야 한다.
        expect(urls).not.toContain(`${SITE_URL}/005930.KS/options`);
    });

    it('같은 목록의 미국 종목은 정상적으로 /options 엔트리를 낸다 (가드가 전체를 막은 게 아님을 확인)', () => {
        const entries = buildPopularEntries(NOW);
        const urls = entries.map(e => e.url);
        expect(urls).toContain(`${SITE_URL}/AAPL/options`);
    });
});
