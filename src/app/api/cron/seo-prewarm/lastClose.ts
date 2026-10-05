import 'server-only';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { quantizeBarsDataToLastClosed } from '@/entities/bars/lib/quantizeBars';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

/**
 * 페이지 상단에 찍히는 종가 — `getQuantizedBarsStatic`이 쓰는 것과 **같은 로더·같은 양자화**.
 *
 * 글(AI 분석)의 "현재가"가 이 값과 다르면 방문자는 한 페이지에서 두 가격을 본다.
 * `loadBarsData`는 Redis 봉 캐시(`getOrSetCache`)를 거치지만, **캐시가 비어 있으면 실제 시세
 * 제공자 호출이다.** core의 `cached` 분석 경로는 봉을 읽지 않으므로(분석 결과 캐시만 읽는다)
 * 이 호출이 그 심볼·tick의 첫 봉 조회일 수 있다 — 호출부가 짧은 상한을 걸고 FMP 예산에 센다.
 * 정적 캐시(`getBarsStatic`)는 쓰지 않는다 — `unstable_cache`는 크론의 `after()` 컨텍스트에서
 * 쓸 이유가 없고 6시간 묵은 값을 줄 수 있다.
 *
 * **실패하면 `null`** — 가격 비교는 "가능하면" 하는 보조 검사라 봉을 못 읽는다고 배치를
 * 막지 않는다.
 */
export async function fetchPageLastClose(
    symbol: string,
    fmpSymbol: string | undefined
): Promise<number | null> {
    try {
        const ticker = symbol.toUpperCase();
        const [data, profile] = await Promise.all([
            loadBarsData(ticker, '1Day', fmpSymbol),
            resolveMarketProfile(ticker),
        ]);
        const quantized = quantizeBarsDataToLastClosed(
            data,
            new Date(),
            sessionSpecFor(profile)
        );
        const close = quantized.bars.at(-1)?.close;
        return typeof close === 'number' && Number.isFinite(close) && close > 0
            ? close
            : null;
    } catch (error) {
        console.warn(
            `[seo-prewarm] last-close lookup failed: ${symbol}`,
            error
        );
        return null;
    }
}
