import { hasNaverCredentials } from '@/shared/api/naver/naverSearch';
import { getKoreanNames } from '@/entities/ticker/lib/koreanNameStore';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import type { NewsSource } from '@/shared/config/marketProfile/types';
import { isE2E } from '@/shared/api/e2eEnv';
import { EMPTY_NEWS_CLIENT } from './emptyNewsClient';
import { FmpNewsClient } from './fmpNewsClient';
import { NaverNewsClient } from './naverNewsClient';
import type { NewsClientPort } from './newsClientPort';

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

/**
 * 시장 프로필의 뉴스 소스에 맞는 클라이언트를 돌려준다(E2E_TEST에서는 가짜 클라이언트).
 * 소스별로 프로세스당 한 인스턴스를 재사용한다.
 */
export function getNewsClient(
    newsSource: NewsSource = 'stock'
): NewsClientPort {
    if (isE2E()) {
        // 싱글턴 가짜: FakeNewsClient는 E2E 단언이 읽는 호출 추적 상태를 들고 있어
        // 모든 호출부가 같은 인스턴스를 써야 한다. 동기 require()로 불러 가짜가
        // 프로덕션 번들에 들어가지 않게 한다(Turbopack dead-code).
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
