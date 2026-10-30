import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';

import type { SymbolTabParams } from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { getSymbolFearGreedChipStatic } from '@/entities/bars/server/sessionBarsStaticCache';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import { marketProfileOf } from '@/shared/config/marketProfile/registry';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { resolveLocale } from '@/shared/i18n/locales';
import type { AssetInfo } from '@/shared/lib/types';
import { SymbolLayoutHeader } from '@/views/symbol/SymbolLayoutHeader';
import {
    SYMBOL_SUB_TAB_KEYS,
    type SymbolSubTabKey,
} from '@/views/symbol/utils/symbolTabsConfig';

interface SymbolLayoutChromeProps {
    /** `[locale]/[symbol]` 세그먼트 파라미터(레이아웃이 받은 그대로). */
    params: SymbolTabParams;
    /** 레이아웃 가드를 통과한 자산 정보 — null이면 그 전에 `notFound()`로 끊긴다. */
    assetInfo: AssetInfo;
    /** `getAssetInfoResilient`가 폴백으로 푼 값인가. 시드의 `updatedAt`을 가른다. */
    degraded?: boolean;
}

/**
 * 레이아웃 크롬 — 헤더(브레드크럼·공포·탐욕 칩·탭) + `assetInfo` 시드. `[symbol]/layout.tsx` 전용이다
 * (라우트 모듈은 프레임워크 필드만 export하므로 여기 둔다).
 *
 * - `assetInfo`는 레이아웃이 확정한 값을 prop으로 받는다 — 다시 조회하면 캐시 핸들러 읽기가 한 번 더
 *   일어나고(S3 외부화 시 실제 왕복), "두 번째 호출은 반드시 HIT"라는 암묵적 불변식에 기대게 된다.
 * - 시드 `updatedAt`은 고정값이다(AP-2). 정상 조회와 장애 폴백(degraded)이 다른 값이라 클라이언트가
 *   폴백 시드만 다시 받는다(`ASSET_INFO_SEED_UPDATED_AT`).
 * - **봉을 시드하지 않는다.** 헤더 칩은 서버가 계산한 스냅샷(수십 바이트)을 prop으로 받는다 — 레이아웃
 *   시드는 9개 탭 전부의 RSC 페이로드에 실리는데, 일봉 + 매수·매도 거래량을 실으면 탭마다 수십 KB를
 *   헤더 배지 하나 때문에 나른다. 차트 탭은 자기 `page.tsx`에서 봉을 시드한다. 서버 값은 SSR HTML에
 *   그대로 박히고 하이드레이션 후에도 같아 텍스트 mismatch가 없으며, JS 없는 크롤러도 칩 값을 본다.
 */
export async function SymbolLayoutChrome({
    assetInfo,
    degraded = false,
    params,
}: SymbolLayoutChromeProps) {
    const { locale: rawLocale, symbol } = await params;
    const locale = resolveLocale(rawLocale);

    // 서버 컴포넌트라 요청마다 한 번 렌더된다 — 요청 스코프 QueryClient는 dehydrate 시드 용도다
    // (클라 캐시가 아니다).
    // react-doctor-disable-next-line react-doctor/query-stable-query-client
    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: assetInfoSeedUpdatedAt(degraded),
    });

    // ## 왜 봉 캐시가 아니라 세션 키 칩 캐시를 읽는가 — 9탭 revalidate clamp
    //
    // Next 16.3은 렌더 중 읽힌 `unstable_cache` revalidate의 최솟값으로 라우트를 clamp한다. 레이아웃은
    // 9개 탭 전부가 읽으므로, 6h 봉 캐시를 여기서 읽으면 12h·24h를 선언한 탭이 전부 6h로 재생성된다.
    // `getSymbolFearGreedChipStatic`은 스냅샷만 담고 키에 시장의 마지막 마감 세션 날짜를 넣어
    // revalidate를 24h로 둔다 — 세션이 넘어가면 다음 재생성이 새 키를 읽어 칩이 묵지 않는다
    // (`sessionBarsStaticCache.ts` JSDoc). 값은 공포·탐욕 탭 본문과 같은 축소 봉·같은 세션 키에서
    // 계산한다. 탭들의 revalidate 관계는 `src/__tests__/guards/symbolTabRevalidateClamp.test.ts`가 고정한다.
    //
    // ## 신선도 — 장중에는 값이 덜 민감하다(의도된 트레이드오프)
    //
    // 마지막 마감 세션까지의 봉만 쓴다(ISR HTML 결정성). 공포·탐욕은 일봉 지표라 세션 중 갱신의 가치가
    // 작고, 같은 페이지의 다른 숫자도 같은 ISR 상한에 묶여 배지만 실시간이면 오히려 어긋나 보인다. 실시간
    // 값은 `/[symbol]/fear-greed`의 게이지(`useFearGreedFromSymbol`)가 맡고 배지는 그 입구다. 조회 실패나
    // 점수 부족이면 스냅샷이 null → 칩이 "데이터 부족" 문구로 폴백한다.
    //
    // 브레드크럼 라벨 번역은 칩 조회와 독립이라 같은 `Promise.all`에서 기다린다. 셋째 마디(탭) 라벨은 각
    // 탭 페이지의 `BreadcrumbList` JSON-LD와 같은 `shared.symbolTab` 키라 둘이 글자까지 같다.
    const [fearGreedSnapshot, tUi, tTab] = await Promise.all([
        getSymbolFearGreedChipStatic(
            symbol.toUpperCase(),
            marketProfileOf(assetInfo),
            assetInfo.fmpSymbol
        ).catch((e: unknown) => {
            console.error(
                '[SymbolLayout] getSymbolFearGreedChipStatic failed:',
                e
            );
            return null;
        }),
        getTranslations({ locale, namespace: 'shared.ui' }),
        getTranslations({ locale, namespace: 'shared.symbolTab' }),
    ]);
    // `Object.fromEntries`는 키 타입을 `string`으로 넓힌다 — 키가 `SYMBOL_SUB_TAB_KEYS` 전수라 레코드는
    // 빠짐없이 채워진다.
    const tabCrumbLabels = Object.fromEntries(
        SYMBOL_SUB_TAB_KEYS.map(key => [key, tTab(key)])
    ) as Record<SymbolSubTabKey, string>;

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SymbolLayoutHeader
                symbol={symbol}
                fearGreedSnapshot={fearGreedSnapshot}
                breadcrumbLabel={tUi('Breadcrumb.46c31f')}
                tabCrumbLabels={tabCrumbLabels}
            />
        </HydrationBoundary>
    );
}
