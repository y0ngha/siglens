import {
    mapExpirationsToSlots,
    sanitizeOptionsChain,
    type OptionsChain,
} from '@y0ngha/siglens-core';
import { getYahooClient } from '@/shared/api/yahoo/createYahooClient';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { toYahooSymbol } from '@/shared/lib/yahooSymbol';
import {
    isSlotMapping,
    type SlottedOptionsDataProvider,
    type SlottedOptionsSnapshot,
} from '../lib/optionsSlots';
import {
    normalizeYahooSnapshot,
    type YahooOption,
    type YahooOptionsResult,
} from '../lib/yahooNormalize';

// `yahooSurvey` 공지는 yahoo-finance2가 첫 호출 시 한 번 출력하는 마케팅 배너로,
// 운영 로그에 노이즈만 남기므로 명시적으로 억제한다.
// ref: https://github.com/gadicc/yahoo-finance2/issues/764#issuecomment-2056623851
//
// `validation.logErrors: false` — 옵션이 없거나 비정형 데이터를 가진 심볼을 probe할 때
// yahoo-finance2가 schema 불일치 시 다중 행의 "Failed Yahoo Schema validation …
// This may happen intermittently…" 메시지를 logger.error로 출력한다.
// 이 에러는 adapter의 catch 블록에서 null 반환으로 이미 처리되므로 로그 자체는 노이즈다.
// validation: { logErrors: false }를 설정하면 FailedYahooValidationError throw는
// 그대로 유지한 채 로그 출력만 비활성화된다 — 4.0.5 기준 기본값 `lib/options/defaults.js:19`,
// 로그는 `logErrors === true`일 때만 찍고 throw는 무조건(`lib/validateAndCoerceTypes.js:188·220`).
const yahooFinance = getYahooClient();

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

/**
 * 첫 호출에 없던 슬롯 만기의 체인을 `{ date }` 인자로 병렬 추가 호출해 모은다. 한 만기의
 * 호출이 실패해도 그 만기만 빠질 뿐 전체는 실패하지 않는다.
 *
 * `options` 응답은 yahoo-finance2의 `OptionsResult.options`가 `[key: string]: unknown`
 * index signature를 달고 있어 로컬 `YahooOption`과의 구조적 호환을 TS가 증명하지 못한다.
 * 런타임 형태(`expirationDate / calls / puts`)는 같아 `unknown`을 거쳐 단언한다.
 */
async function fetchMissingChains(
    symbol: string,
    yahooSymbol: string,
    missingIsos: readonly string[]
): Promise<YahooOption[]> {
    const fetched = await Promise.all(
        missingIsos.map(iso =>
            yahooFinance
                .options(yahooSymbol, {
                    date: new Date(`${iso}T00:00:00.000Z`),
                })
                .then(r => (r.options as unknown as YahooOption[]) ?? [])
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
    return fetched.flat();
}

/**
 * yahoo-finance2 기반 `SlottedOptionsDataProvider`. 프로덕션에서 `getOptionsProvider`가 돌려준다.
 *
 * 오류 정책: 모든 오류를 잡아 `null`/`false`로 돌려준다 — 호출부는 null을 "데이터 없음"으로
 * 다루며 데이터 계층의 예외를 받지 않는다. 진짜 장애는 로그를 남기고, Yahoo 스키마 검증
 * 실패는 "이 종목엔 옵션 시장이 없다"는 뜻이라 로그하지 않는다(`isYahooValidationError`).
 */
export class YahooOptionsAdapter implements SlottedOptionsDataProvider {
    /**
     * 종목의 옵션 스냅샷을 정규 만기 슬롯(1W / 2W / 1M / 2M / 3M / 6M)과 가장 가까운 만기
     * 체인까지 모아 돌려준다. 정규화한 체인은 `sanitizeOptionsChain`을 통과해야 남고, 남은
     * 체인이 없으면 `null`이다.
     *
     * yahoo-finance2의 `options(symbol)`은 `expirationDates`에 19개 안팎의 만기 리스트를
     * 주지만 `options[]` 체인 데이터는 첫 만기 1개만 담는다. 종목에 따라 첫 만기가 오늘과
     * 같은 날이면 1W 슬롯 매칭 조건(≥7일)을 충족하지 못해 ExpirationSelector에 '종합'만
     * 노출되는 문제가 있다(예: PLTR weekly).
     *
     * 따라서 첫 호출의 expirationDates를 `mapExpirationsToSlots`로 슬롯 후보로 좁힌 뒤,
     * 누락된 만기는 `fetchMissingChains`로 추가 호출해 합친다.
     */
    async fetchSnapshot(
        symbol: string
    ): Promise<SlottedOptionsSnapshot | null> {
        try {
            const yahooSymbol = toYahooSymbol(symbol);
            const initial = await yahooFinance.options(yahooSymbol);

            if (!initial.options || initial.options.length === 0) {
                return null;
            }

            const now = new Date();

            const allExpirationIsos = (initial.expirationDates ?? []).map(
                toUtcIsoDate
            );
            const slotMappings = mapExpirationsToSlots(allExpirationIsos, now);
            const targetIsos = new Set<string>(
                slotMappings.filter(isSlotMapping).map(m => m.expirationDate)
            );

            // `unknown`을 거치는 단언의 근거는 `fetchMissingChains` JSDoc 참고.
            const initialOptions = initial.options as unknown as YahooOption[];
            const initialIsos = new Set(
                initialOptions.map(o => toUtcIsoDate(o.expirationDate))
            );
            const missingIsos = [...targetIsos].filter(
                iso => !initialIsos.has(iso)
            );

            const additional = await fetchMissingChains(
                symbol,
                yahooSymbol,
                missingIsos
            );

            const mergedByIso = new Map(
                [...initialOptions, ...additional].map(
                    opt => [toUtcIsoDate(opt.expirationDate), opt] as const
                )
            );

            // `OptionsResult.quote`가 큰 union이라 로컬 `YahooOptionsResult`와의 구조적
            // 호환을 TS가 증명하지 못한다. `regularMarketPrice`는 모든 Quote 멤버에 런타임으로
            // 존재하므로 `unknown`을 거쳐 단언한다.
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

            // 수집 시점의 슬롯 매핑을 함께 싣는다 — 전체 Yahoo 만기 목록으로 만든 값이라
            // 렌더가 묵은 스냅샷을 `new Date()`로 다시 매핑할 때 생기는 어긋남이 없다
            // (`SlottedOptionsSnapshot` JSDoc).
            return {
                ...raw,
                chains: sanitizedChains,
                slots: slotMappings.filter(isSlotMapping),
            };
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
     * 빠른 존재 확인 — 상장 만기가 하나라도 있으면 true. 오류이거나 만기가 없으면 false다.
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
