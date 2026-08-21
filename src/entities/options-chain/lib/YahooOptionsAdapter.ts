/**
 * OptionsDataProvider implementation backed by yahoo-finance2.
 *
 * Error policy: all errors are caught and returned as null. The consuming
 * use-case treats null as "no data available" and should not receive thrown
 * exceptions from the data layer. Genuine failures are logged; Yahoo schema
 * validation errors are not, because they mean "this symbol has no options
 * market" (see `isYahooValidationError`).
 */
import { createYahooClient } from '@/shared/api/yahoo/createYahooClient';
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
//
// `validation.logErrors: false` — 옵션이 없거나 비정형 데이터를 가진 심볼을 probe할 때
// yahoo-finance2가 schema 불일치 시 다중 행의 "Failed Yahoo Schema validation …
// This may happen intermittently…" 메시지를 logger.error로 출력한다.
// 이 에러는 adapter의 catch 블록에서 null 반환으로 이미 처리되므로 로그 자체는 노이즈다.
// validation: { logErrors: false }를 설정하면 FailedYahooValidationError throw는
// 그대로 유지한 채 로그 출력만 비활성화된다(라이브러리 v3.15.3 defaults.js:24).
const yahooFinance = createYahooClient();

/**
 * yahoo-finance2가 스키마 검증에 실패했을 때 던지는 에러인지.
 *
 * **옵션 시장이 없는 심볼에서 정상적으로 발생한다.** OTC·초소형주를 probe하면 Yahoo가
 * 우리 스키마와 어긋나는 페이로드를 주고 라이브러리가 이 에러를 던지는데, 그건 장애가
 * 아니라 "이 종목엔 옵션이 없다"는 뜻이다. 그런데도 catch 블록이 로그를 남기는 바람에
 * 프로덕션에서 **주 1,900줄**이 쌓였다(실측: `hasOptionsMarket` 1,409 + `fetchSnapshot`
 * 487, MIRO·IQAIF·PKANF 같은 OTC 심볼에 흩어져 심볼당 2~3건).
 *
 * 라이브러리 자체 로그는 이미 `validation.logErrors: false`로 껐다(위 주석). 남은 건
 * 우리 로그이고, 이 판정으로 그 부분만 조용히 만든다 — 네트워크 타임아웃 같은 **진짜**
 * 장애는 그대로 남는다.
 */
function isYahooValidationError(err: unknown): boolean {
    return err instanceof Error && err.name === 'FailedYahooValidationError';
}

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
            // 스키마 검증 실패는 "옵션 없음"이지 장애가 아니다 —
            // `isYahooValidationError` JSDoc 참고.
            if (!isYahooValidationError(err)) {
                console.error(
                    '[YahooOptionsAdapter] fetchSnapshot failed',
                    err
                );
            }
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
            if (!isYahooValidationError(err)) {
                console.warn(
                    '[YahooOptionsAdapter] hasOptionsMarket failed',
                    symbol,
                    err
                );
            }
            return false;
        }
    }
}
