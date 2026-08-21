import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { isAdmissibleSymbolShape } from '@/shared/config/market';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
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
    locale,
}: SymbolIndexabilityInput): SymbolIndexabilityDecision {
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        return { indexable: false, reason: 'invalid-symbol' };
    }

    // 로케일 게이트는 **가장 먼저** 본다. 아래 화이트리스트(popular 등)보다
    // 뒤에 두면 인기 티커의 비-ko 페이지가 한국어 본문 그대로 색인된다.
    if (!SYMBOL_INDEXABLE_LOCALES.includes(locale)) {
        return { indexable: false, reason: 'locale-not-ready' };
    }

    if (!assetInfo) {
        return { indexable: false, reason: 'asset-missing' };
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
