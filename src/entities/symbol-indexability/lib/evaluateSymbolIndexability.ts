import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { isAdmissibleSymbolShape } from '@/shared/config/market';
import { APPROVED_LONGTAIL_TICKERS } from '../config/approved-longtail-tickers';
import type {
    SymbolIndexabilityDecision,
    SymbolIndexabilityInput,
} from '../model';

const POPULAR_TICKER_SET = new Set<string>(POPULAR_TICKERS);
const POPULAR_CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);
const APPROVED_LONGTAIL_SET = new Set<string>(APPROVED_LONGTAIL_TICKERS);

export function evaluateSymbolIndexability({
    symbol,
    assetInfo,
    degraded,
    hasSnapshot,
    hasPriceData,
}: SymbolIndexabilityInput): SymbolIndexabilityDecision {
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        return { indexable: false, reason: 'invalid-symbol' };
    }

    if (!assetInfo) {
        return { indexable: false, reason: 'asset-missing' };
    }

    // 콘텐츠 게이트는 화이트리스트보다 **위**에 온다. 멤버십은 "색인할 가치가
    // 있는 종목인가"만 답하므로, 봉이 하나도 없어 본문이 빈 껍데기인 페이지를
    // 그대로 통과시킨다(2026-08-24 실측 14종 — `hasPriceData` JSDoc).
    // degraded 분기보다도 위인 이유: degraded는 "일시적으로 데이터가 얕다"이고
    // 이쪽은 "가격 자체가 없다"라, 저장된 스냅샷이 있더라도(=degraded-with-snapshot
    // 경로) 죽은 티커에 대한 낡은 서술을 색인시킬 이유가 없다.
    if (hasPriceData === false) {
        return { indexable: false, reason: 'no-price-data' };
    }

    if (degraded) {
        // Whitelisted symbols with a stored SEO snapshot can stay indexable even
        // while degraded — the body renders substantive snapshot content instead
        // of the thin degraded shell. Non-whitelisted or snapshot-less degraded
        // pages stay noindex (this must NOT move below the whitelist checks below,
        // or a degraded, snapshot-less popular symbol would get indexed).
        const whitelisted =
            POPULAR_TICKER_SET.has(upper) ||
            POPULAR_CRYPTO_SET.has(upper) ||
            APPROVED_LONGTAIL_SET.has(upper);
        if (hasSnapshot === true && whitelisted) {
            return { indexable: true, reason: 'degraded-with-snapshot' };
        }
        return { indexable: false, reason: 'degraded' };
    }

    if (POPULAR_TICKER_SET.has(upper)) {
        return { indexable: true, reason: 'popular' };
    }

    if (POPULAR_CRYPTO_SET.has(upper)) {
        return { indexable: true, reason: 'curated-crypto' };
    }

    if (APPROVED_LONGTAIL_SET.has(upper)) {
        return { indexable: true, reason: 'approved-longtail' };
    }

    return { indexable: false, reason: 'longtail-default-blocked' };
}
