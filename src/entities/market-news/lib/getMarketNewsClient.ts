import { isE2E } from '@/shared/api/e2eEnv';
import { FmpMarketNewsClient } from './fmpMarketNewsClient';
import { NaverMarketNewsClient } from './naverMarketNewsClient';
import { CATEGORY_CONFIG, type NewsFeedCategoryId } from './categoryConfig';
import type { MarketNewsClientPort } from './marketNewsClientPort';

let cachedFmp: MarketNewsClientPort | null = null;
let cachedNaver: MarketNewsClientPort | null = null;
let cachedFake: MarketNewsClientPort | null = null;

/**
 * Returns the singleton market-news client for `category` in the current environment.
 *
 * In E2E mode (`E2E_TEST=1`), returns `FakeMarketNewsClient` which serves
 * deterministic fixture data without touching FMP/네이버 or env keys — 소스와
 * 무관하게 하나만 쓴다(픽스처가 카테고리별로 갈리면 E2E가 소스 배선을 검증하는
 * 것처럼 보이지만 실제로는 픽스처만 검증한다).
 *
 * In production the client is chosen by `CATEGORY_CONFIG[category].source`:
 * FMP는 미국·암호화폐 피드, 네이버는 한국 증시 피드다. 싱글턴은 모듈 레벨이라
 * Next.js 워커 프로세스당 최대 한 번 생성된다.
 */
export function getMarketNewsClient(
    category: NewsFeedCategoryId
): MarketNewsClientPort {
    if (isE2E()) {
        // safe: require() enables conditional loading to exclude FakeMarketNewsClient from
        // the production bundle; the module path is known-correct at build time.
        if (cachedFake === null) {
            const { FakeMarketNewsClient } =
                require('./FakeMarketNewsClient') as typeof import('./FakeMarketNewsClient');
            cachedFake = new FakeMarketNewsClient();
        }
        return cachedFake;
    }
    if (CATEGORY_CONFIG[category].source === 'naver') {
        if (cachedNaver === null) cachedNaver = new NaverMarketNewsClient();
        return cachedNaver;
    }
    if (cachedFmp === null) cachedFmp = new FmpMarketNewsClient();
    return cachedFmp;
}
