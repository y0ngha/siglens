import { FmpNewsClient } from './fmpNewsClient';
import { EMPTY_NEWS_CLIENT } from './emptyNewsClient';
import { NaverNewsClient } from './naverNewsClient';
import { hasNaverCredentials } from './naverNewsSearch';
import { getKoreanNames } from '@/entities/ticker/lib/koreanNameStore';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import type { NewsClientPort } from './newsClientPort';
import type { NewsSource } from '@/shared/config/marketProfile';
import { isE2E } from '@/shared/api/e2eEnv';

let cachedStock: NewsClientPort | null = null;
let cachedCrypto: NewsClientPort | null = null;
let cachedNaver: NewsClientPort | null = null;
let cachedFake: NewsClientPort | null = null;

/**
 * 한국 종목의 뉴스 검색어 — 한글 종목명("삼성전자")을 쓴다.
 *
 * 종목코드(`005930.KS`)로 검색하면 기사가 거의 잡히지 않는다. 한글명은 종목 페이지를
 * 한 번이라도 방문하면 `getAssetInfo`의 번역 경로가 `korean_tickers`에 채워 두므로,
 * 별도의 종목 마스터 없이 조회된다. 아직 없으면 `null`을 반환해 검색 자체를 건너뛴다 —
 * 영문명으로 검색하면 국내 기사가 거의 없어 빈 결과에 API 호출만 낭비된다.
 *
 * `CURATED_KOREAN_NAMES` 폴백은 콜드 스타트 경합을 막는다. `/005930.KS/news`가
 * `/005930.KS`보다 먼저 생성되면 DB에 아직 행이 없어 검색이 통째로 건너뛰어지고,
 * **빈 뉴스 페이지가 ISR에 12시간 굳는다** — sitemap은 그 URL을 `hourly`/0.78로
 * 광고하는 중이다. 제목 경로(`resolveKrEquityAssetInfo`)는 같은 이유로 이미 이
 * 폴백을 쓰고 있었고, 여기만 빠져 있었다.
 */
async function resolveKoreanQuery(symbol: string): Promise<string | null> {
    const upper = symbol.toUpperCase();
    const names = await getKoreanNames([upper]);
    return names[upper] ?? CURATED_KOREAN_NAMES.get(upper) ?? null;
}

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(
    newsSource: NewsSource = 'stock'
): NewsClientPort {
    if (isE2E()) {
        // Singleton fake: FakeNewsClient holds call-tracking state used by E2E
        // assertions, so all callers must share the same instance. Sync require()
        // keeps the fake out of the production bundle (Turbopack dead-code).
        if (!cachedFake) {
            const { FakeNewsClient } =
                require('./FakeNewsClient') as typeof import('./FakeNewsClient');
            cachedFake = new FakeNewsClient();
        }
        return cachedFake;
    }
    if (newsSource === 'naver') {
        // kr-equity. FMP는 KRX를 커버하지 않으므로 stock/crypto로 폴백하면 한국 종목에
        // 무관한 미국 뉴스가 노출된다.
        //
        // 자격증명이 없으면 클라이언트를 만들지 않고 빈 결과로 degrade한다 —
        // `NAVER_CLIENT_ID`/`SECRET` 미설정이 뉴스 탭만 비우고 나머지 탭·분석 경로는
        // 건드리지 않게 하는 지점이다(부재가 크래시가 되면 안 된다).
        if (!hasNaverCredentials()) return EMPTY_NEWS_CLIENT;
        if (!cachedNaver) cachedNaver = new NaverNewsClient(resolveKoreanQuery);
        return cachedNaver;
    }
    if (newsSource === 'crypto') {
        if (!cachedCrypto) cachedCrypto = new FmpNewsClient('crypto');
        return cachedCrypto;
    }
    if (!cachedStock) cachedStock = new FmpNewsClient('stock');
    return cachedStock;
}
