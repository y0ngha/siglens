import 'server-only';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

/**
 * Current price for `FundamentalSnapshot.currentPrice` (spec: core's
 * fundamental axis has no quote provider of its own). Same
 * symbol→fmpSymbol→quote path the agent chat tools use
 * (`getFundamentals.ts`/`getQuote.ts`) and the technical SSE route uses for
 * its own position-bucket lookup. `undefined` on ANY failure/timeout/invalid
 * price — core already treats non-finite/zero/negative as absent, but
 * resolving to `undefined` here keeps a failed lookup from ever reaching the
 * options object at all. Shared by the request-path action
 * (`runFundamentalAnalysisAction`) and the SEO prewarm seam
 * (`prewarmFundamental`) so both fill `## Derived Metrics`'s target-upside
 * row instead of only the request path.
 *
 * Named `fetchQuotePriceForAnalysis`, not `resolveCurrentPrice` — this
 * entity previously shadowed `@/entities/analysis-plain`'s
 * `resolveCurrentPrice(symbol, payload)`, a different function with a
 * different signature (payload-aware, plain-language axis only). Same name,
 * different module/signature is a landmine for anyone importing both.
 */
export async function fetchQuotePriceForAnalysis(
    symbol: string
): Promise<number | undefined> {
    try {
        const [marketProfile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            getAssetInfo(symbol),
        ]);
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(sessionSpecFor(marketProfile)),
            asset?.fmpSymbol ?? symbol
        );
        return quote && Number.isFinite(quote.price) && quote.price > 0
            ? quote.price
            : undefined;
    } catch (error) {
        // Same privacy rule as `logToolError`/`logToolDegrade`
        // (`app/api/ai/chat/tools/logToolDegrade.ts`): never the error
        // object, `.message`, or `.stack` — only its `name` — a
        // `DrizzleQueryError`'s message can embed bound params. This
        // entities-layer module can't import that app-layer helper, so the
        // name-only extraction is inlined here.
        console.error(
            '[fetchQuotePriceForAnalysis] quote lookup failed, degrading to undefined:',
            { errorName: error instanceof Error ? error.name : 'unknown' }
        );
        return undefined;
    }
}
