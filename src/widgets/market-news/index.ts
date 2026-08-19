export { MarketNewsCard, type MarketNewsCardProps } from './MarketNewsCard';
export {
    MarketNewsDigest,
    type MarketNewsDigestProps,
} from './MarketNewsDigest';
export { MarketNewsList, type MarketNewsListProps } from './MarketNewsList';

// 서버 섹션이 클라이언트로 넘길 카드 수를 자를 때 쓴다 — 근거는 constants.ts 주석.
export { MARKET_NEWS_ROW_SERIALIZATION_LIMIT } from './constants';
