/**
 * OptionsDataProvider implementation backed by yahoo-finance2.
 *
 * Error policy: all errors are caught, logged via console.error, and returned
 * as null. The consuming use-case treats null as "no data available" and
 * should not receive thrown exceptions from the data layer.
 */
import YahooFinance from 'yahoo-finance2';
import {
    mapExpirationsToSlots,
    sanitizeOptionsChain,
} from '@y0ngha/siglens-core';
import { toYahooSymbol } from '@/shared/lib/yahooSymbol';
import type {
    OptionsChain,
    OptionsDataProvider,
    OptionsSnapshot,
    SlotMapping,
} from '@y0ngha/siglens-core';
import {
    normalizeYahooSnapshot,
    type YahooOption,
    type YahooOptionsResult,
} from './yahooNormalize';

// `yahooSurvey` 공지는 yahoo-finance2가 첫 호출 시 한 번 출력하는 마케팅 배너로,
// 운영 로그에 노이즈만 남기므로 명시적으로 억제한다.
// ref: https://github.com/gadicc/yahoo-finance2/issues/764#issuecomment-2056623851
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export class YahooOptionsAdapter implements OptionsDataProvider {
    /**
     * Fetch the options snapshot for a symbol, covering the canonical
     * expiration slots (1W / 2W / 1M / 2M / 3M / 6M) plus the nearest chain.
     *
     * yahoo-finance2의 `options(symbol)` 호출은 `expirationDates`에 19개 안팎의
     * 만기 리스트를 반환하지만, `options[]` 체인 데이터는 첫 만기 1개만 포함된다.
     * 종목에 따라 첫 만기가 오늘과 같은 날이면 1W 슬롯 매칭 조건(≥7일)을 충족하지
     * 못해 ExpirationSelector에 '종합'만 노출되는 문제가 있다(예: PLTR weekly).
     *
     * 따라서 첫 호출에서 받은 expirationDates를 `mapExpirationsToSlots`로 슬롯
     * 후보로 좁힌 뒤, 누락된 만기는 `{ date: ... }` 인자로 병렬 추가 호출해
     * 모은다. 추가 호출 실패는 해당 만기 누락으로만 처리하고 전체를 실패시키지
     * 않는다.
     *
     * After normalization, each chain is run through `sanitizeOptionsChain`.
     * Chains rejected by sanitization (null return) are filtered out.
     * If no chains remain, returns null.
     */
    async fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null> {
        try {
            const yahooSymbol = toYahooSymbol(symbol);
            const initial = await yahooFinance.options(yahooSymbol);

            if (!initial.options || initial.options.length === 0) {
                return null;
            }

            const now = new Date();

            const allExpirationIsos = (initial.expirationDates ?? []).map(
                toIsoDate
            );
            const slotMappings = mapExpirationsToSlots(allExpirationIsos, now);
            const targetIsos = new Set<string>(
                slotMappings
                    .filter((m): m is SlotMapping => m !== null)
                    .map(m => m.expirationDate)
            );

            // Cast through unknown: yahoo-finance2의 `OptionsResult.options`는
            // `[key: string]: unknown` index signature가 붙은 구조라 우리 로컬
            // YahooOption 인터페이스와 구조적 호환을 TS가 증명하지 못한다.
            // 런타임에는 `expirationDate / calls / puts` 형태가 동일하다.
            const initialOptions = initial.options as unknown as YahooOption[];
            const initialIsos = new Set(
                initialOptions.map(o => toIsoDate(o.expirationDate))
            );
            const missingIsos = [...targetIsos].filter(
                iso => !initialIsos.has(iso)
            );

            const additional = await Promise.all(
                missingIsos.map(iso =>
                    yahooFinance
                        .options(yahooSymbol, {
                            date: new Date(`${iso}T00:00:00.000Z`),
                        })
                        .then(
                            // Cast through unknown: 첫 응답과 동일한 TS 한계
                            // (yahoo-finance2 `OptionsResult.options`의 index
                            // signature와 우리 YahooOption 인터페이스 사이의
                            // 구조적 동등성 증명 불가). 런타임 형태는 동일.
                            r => (r.options as unknown as YahooOption[]) ?? []
                        )
                        .catch(err => {
                            console.warn(
                                '[YahooOptionsAdapter] fetch expiration failed',
                                symbol,
                                iso,
                                err
                            );
                            return [] as YahooOption[];
                        })
                )
            );

            const mergedByIso = new Map(
                [...initialOptions, ...additional.flat()].map(
                    opt => [toIsoDate(opt.expirationDate), opt] as const
                )
            );

            // Cast through unknown: OptionsResult.quote is a large union type
            // that TypeScript cannot prove structurally compatible with our
            // local YahooOptionsResult interface, even though regularMarketPrice
            // is present at runtime across all Quote union members.
            const combined = {
                ...(initial as unknown as YahooOptionsResult),
                underlyingSymbol: symbol,
                options: [...mergedByIso.values()],
            } as YahooOptionsResult;

            const raw = normalizeYahooSnapshot(combined, now);

            // Yahoo가 quote.regularMarketPrice를 누락하면 normalize 단에서 0으로
            // 폴백된다. underlyingPrice=0 인 채로 그냥 통과시키면 downstream
            // (findNearestStrike, ImpliedMove, Max Pain 가이드라인)이 최저 strike에
            // 가이드라인을 그리는 등 시각적으로 잘못된 정보를 노출한다.
            // 단일 경계인 adapter에서 null로 reject해 OptionsEmptyState로 떨어뜨린다.
            if (raw.underlyingPrice <= 0) {
                console.warn(
                    '[YahooOptionsAdapter] missing underlyingPrice — treating snapshot as unavailable',
                    symbol
                );
                return null;
            }

            const sanitizedChains = raw.chains
                .map(chain => sanitizeOptionsChain(chain))
                .filter((chain): chain is OptionsChain => chain !== null);

            if (sanitizedChains.length === 0) {
                return null;
            }

            return { ...raw, chains: sanitizedChains };
        } catch (err) {
            console.error('[YahooOptionsAdapter] fetchSnapshot failed', err);
            return null;
        }
    }

    /**
     * Fast existence check — resolves true when the symbol has at least one
     * listed expiration, false on any error or when no expirations are available.
     */
    async hasOptionsMarket(symbol: string): Promise<boolean> {
        try {
            const response = await yahooFinance.options(toYahooSymbol(symbol));
            return (response.expirationDates?.length ?? 0) > 0;
        } catch (err) {
            console.warn(
                '[YahooOptionsAdapter] hasOptionsMarket failed',
                symbol,
                err
            );
            return false;
        }
    }
}
