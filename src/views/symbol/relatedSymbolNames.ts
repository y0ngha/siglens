/**
 * "관련 종목" 칩 이름 조회(서버 I/O). 순수 판정은 `utils/relatedSymbolChips.ts`에 두고, 여기서는
 * 종목 정보를 읽어 그 판정에 넘긴다.
 */
import type { RelatedSymbol } from '@/shared/config/relatedSymbols';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import type { Locale } from '@/shared/i18n/locales';
import { chipNameFor } from './utils/relatedSymbolChips';

/**
 * 칩 이름을 확정한다(심볼 → 이름, 이름이 없는 칩은 맵에 없다).
 *
 * `getAssetInfoResilient`는 각 종목 페이지가 자기 제목을 만드는 리졸버라, 칩 이름이 링크 대상
 * 페이지의 제목과 같은 소스이고 피어 자신의 페이지 렌더가 채운 캐시를 공유한다. 큐레이션
 * 상수만으로는 칩 대부분이 티커만 노출된다.
 *
 * 인프라 실패는 삼킨다 — 이름 하나 없다고 내부링크가 사라지면 안 된다. 그때는 큐레이션
 * 이름(있으면), 없으면 티커로 폴백한다. 단 `DYNAMIC_SERVER_USAGE`는 실패가 아니라 Next의
 * 제어 흐름 신호라 되던진다 — 삼키면 Next가 의도한 bail-out을 막아 잘못된 결과가 캐시에 굳는다.
 */
export async function resolveChipNames(
    items: readonly RelatedSymbol[],
    locale: Locale
): Promise<ReadonlyMap<string, string>> {
    const resolved = await Promise.all(
        items.map(async item => {
            const { symbol } = item;
            try {
                const { assetInfo } = await getAssetInfoResilient(symbol);
                return [
                    symbol,
                    chipNameFor(assetInfo ?? null, item, locale),
                ] as const;
            } catch (e: unknown) {
                if (isDynamicServerError(e)) throw e;
                console.error(
                    `[RelatedSymbols] name lookup failed for ${symbol}:`,
                    e
                );
                return [symbol, chipNameFor(null, item, locale)] as const;
            }
        })
    );
    return new Map(
        resolved.filter((entry): entry is readonly [string, string] =>
            Boolean(entry[1])
        )
    );
}
