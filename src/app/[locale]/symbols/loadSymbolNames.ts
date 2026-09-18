import { unstable_cache } from 'next/cache';
import { getTickerDisplayNames } from '@/entities/ticker/lib/koreanNameStore';
import { getCryptoAsset } from '@/entities/ticker/lib/cryptoAssetStore';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const NAMES_CACHE_KEY = 'symbols-directory-names';
/**
 * 목록도 이름도 하루 단위로만 움직인다. 페이지의 `revalidate`와 같은 값이어야 하고,
 * 그 일치는 `__tests__/revalidateParity.test.ts`가 소스를 읽어 고정한다 — Next는
 * `revalidate`가 정적으로 분석 가능한 리터럴이어야 해서 이 상수를 import할 수 없다.
 */
export const SYMBOL_NAMES_TTL_SECONDS = SECONDS_PER_DAY;

/**
 * `/symbols` 디렉터리의 표기 이름을 한 번에 읽는다.
 *
 * 주식·ETF는 `korean_tickers`(정본 한글명 오버라이드 포함), 암호화폐는
 * `crypto_assets`에 있다. 두 테이블이 나뉜 것은 이력이고, 이 페이지는 둘을 함께
 * 보여줘야 하므로 여기서 합친다.
 *
 * **실패하면 빈 맵을 돌려준다.** 이름을 못 읽었다고 페이지가 죽으면 이 페이지의
 * 존재 이유(모든 종목으로 가는 내부 링크)가 함께 사라진다. 이름이 없으면 티커만
 * 찍히고 링크는 그대로 남는다.
 */
async function readSymbolNames(
    symbols: readonly string[],
    locale: Locale
): Promise<Record<string, string>> {
    const wantsKorean = locale === DEFAULT_LOCALE;
    try {
        const [displayNames, cryptoRows] = await Promise.all([
            getTickerDisplayNames(symbols),
            Promise.all(
                POPULAR_CRYPTOS.map(async symbol => ({
                    symbol,
                    record: await getCryptoAsset(symbol),
                }))
            ),
        ]);

        const pairs: [string, string][] = [];
        for (const symbol of symbols) {
            const entry = displayNames[symbol];
            const name = wantsKorean
                ? (entry?.koreanName ?? entry?.name)
                : (entry?.name ?? entry?.koreanName);
            if (name) pairs.push([symbol, name]);
        }
        for (const { symbol, record } of cryptoRows) {
            if (record === null) continue;
            const name = wantsKorean
                ? (record.koreanName ?? record.name)
                : record.name;
            if (name) pairs.push([symbol, name]);
        }
        // **빈 결과는 던진다 — 캐시에 넣지 않기 위해서다.**
        // 하위 리더(`getTickerDisplayNames`·`getCryptoAsset`)는 DB 실패를 자체적으로
        // 삼키고 빈 값을 돌려준다. 그 빈 값을 그대로 반환하면 `unstable_cache`가
        // 24시간 동안 "이름 없음"을 캐시하고, stale-while-revalidate라 만료 후 첫
        // 요청도 그 옛 빈 값을 받는다 — 순간적인 DB 딸꾹질 한 번이 하루짜리 품질
        // 저하가 된다. `unstable_cache`는 **거부된 promise를 캐시하지 않으므로**
        // 던지면 다음 요청이 곧바로 다시 시도한다.
        if (pairs.length === 0) {
            throw new Error('[symbols] 이름을 하나도 읽지 못했다');
        }
        return Object.fromEntries(pairs);
    } catch (error) {
        console.warn('[symbols] 이름 조회 실패 — 티커만 표시한다', error);
        throw error instanceof Error ? error : new Error(String(error));
    }
}

/**
 * 캐시된 이름 맵. 로케일이 캐시 키에 들어간다 — 안 넣으면 먼저 렌더된 로케일의
 * 이름이 다른 로케일 화면에 그대로 굳는다.
 */
export async function loadSymbolNames(
    symbols: readonly string[],
    locale: Locale
): Promise<ReadonlyMap<string, string>> {
    try {
        // `symbols`를 **인자로** 넘긴다. 클로저로만 잡으면 캐시 키에 안 들어가서,
        // 다른 목록을 넘기는 호출부가 생기는 순간 먼저 캐시를 채운 목록의 결과를
        // 받는다(`unstable_cache`는 인자를 키에 포함한다).
        const cached = await unstable_cache(
            (list: readonly string[], loc: Locale) =>
                readSymbolNames(list, loc),
            [NAMES_CACHE_KEY],
            { revalidate: SYMBOL_NAMES_TTL_SECONDS }
        )(symbols, locale);
        return new Map(Object.entries(cached));
    } catch {
        // 여기서 흡수한다 — 이름이 없으면 티커만 찍히고, 이 페이지의 존재 이유인
        // 내부 링크는 그대로 남는다.
        return new Map();
    }
}
