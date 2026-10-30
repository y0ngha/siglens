import { isE2E } from '@/shared/api/e2eEnv';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import type { MarketNewsClientPort } from '../lib/marketNewsClientPort';
import { FmpMarketNewsClient } from './fmpMarketNewsClient';
import { NaverMarketNewsClient } from './naverMarketNewsClient';

let cachedFmp: MarketNewsClientPort | null = null;
let cachedNaver: MarketNewsClientPort | null = null;
let cachedFake: MarketNewsClientPort | null = null;

/**
 * 현재 환경에서 `category`가 쓸 시장 뉴스 클라이언트 싱글턴을 돌려준다.
 *
 * E2E 모드(`E2E_TEST=1`)에서는 FMP/네이버나 env 키를 건드리지 않고 결정적 픽스처를
 * 주는 `FakeMarketNewsClient`를 쓴다 — 소스와 무관하게 하나만 쓴다(픽스처가
 * 카테고리별로 갈리면 E2E가 소스 배선을 검증하는 것처럼 보이지만 실제로는 픽스처만
 * 검증한다).
 *
 * 프로덕션에서는 `CATEGORY_CONFIG[category].source`로 고른다:
 * FMP는 미국·암호화폐 피드, 네이버는 한국 증시 피드다. 싱글턴은 모듈 레벨이라
 * Next.js 워커 프로세스당 최대 한 번 생성된다.
 */
export function getMarketNewsClient(
    category: NewsFeedCategoryId
): MarketNewsClientPort {
    if (isE2E()) {
        // safe: require()로 조건부 로드해 FakeMarketNewsClient를 프로덕션 번들에서
        // 뺀다. 모듈 경로는 빌드 시점에 확정돼 있다.
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
