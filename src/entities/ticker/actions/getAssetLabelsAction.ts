'use server';

import { getAssetInfo } from '../lib/getAssetInfo';
import { MAX_RECENT_SEARCHES } from '../lib/recentSearches';

export interface AssetLabelsResult {
    /** 이름을 찾은 심볼만. 이름이 없는 심볼은 여기서 빠진다. */
    labels: Record<string, string>;
    /**
     * **조회 자체가 실패한** 심볼. "이름이 없다"와 구분해야 한다 — 호출부는 실패한
     * 것만 다시 시도하고, 이름이 없는 것은 다시 묻지 않아야 한다.
     */
    failed: string[];
}

/**
 * 심볼 여러 개의 **표시용 회사명**을 한 번에 돌려준다.
 *
 * 최근 검색은 `{ symbol, label }`로 저장하지만, 라벨이 심볼과 같은 항목이 남는다 —
 * v1(`string[]`) 저장값을 승격한 경우와, 검색 결과가 없어 친 티커로 직행한 경우다.
 * 그 항목은 재검색 전까지 영영 `005930.KS`로 보이므로 한 번 조회해 이름을 채운다.
 *
 * 배치인 이유: 서버 액션은 클라이언트에서 부르면 직렬화된다(라우트당 왕복 하나씩).
 * 심볼마다 `getAssetInfoAction`을 부르면 최대 7번 줄을 서지만, 여기서 묶으면
 * 왕복 한 번에 서버 안에서 병렬로 끝난다.
 *
 * ## `Promise.allSettled`인 이유 (`Promise.all` 금지)
 *
 * `getAssetInfo`는 캐시·DB·크립토·국내 어디에도 없는 심볼에서
 * `searchBySymbol(upper, { throwOnInfraFailure: true })`로 떨어지고, 이 옵션은 FMP
 * 인프라 장애를 **throw**한다(null→404 캐싱을 막기 위한 의도된 동작이다). `Promise.all`로
 * 묶으면 심볼 하나의 일시적 장애가 멀쩡히 resolve된 나머지 여섯 개까지 통째로
 * 버린다 — 호출부가 "요청함"을 미리 표시하므로 그 세션 내내 이름이 안 채워진다.
 *
 * ## MISTAKES §0.8 검토
 *
 * 이 레포에는 `FETCH_CONCURRENCY` 상수가 없고, 가장 가까운 동시성 정책은 peer
 * 호출부의 `Promise.all` 패턴이다(`marketFearGreedCache` 6, `economySnapshotCache` 11).
 * 여기는 최대 {@link MAX_RECENT_SEARCHES}(7)개이고, 그것도 **라벨이 아직 심볼인 항목만**
 * 대상이라 사실상 사용자당 1회성 백필이다(호출부가 심볼당 로드당 한 번으로 제한한다).
 * 게다가 대부분은 캐시·DB에서 끝나 외부 호출까지 가지도 않는다. `fetchInChunks`
 * 분할 이득이 없다.
 */
export async function getAssetLabelsAction(
    symbols: readonly string[]
): Promise<AssetLabelsResult> {
    const unique = [...new Set(symbols.map(s => s.trim().toUpperCase()))]
        .filter(Boolean)
        .slice(0, MAX_RECENT_SEARCHES);

    const settled = await Promise.allSettled(
        unique.map(symbol => getAssetInfo(symbol))
    );

    const labels = Object.fromEntries(
        unique.flatMap((symbol, index) => {
            const result = settled[index];
            if (result.status !== 'fulfilled' || !result.value) return [];
            // 한글명 우선 — 검색 결과 행(`resultDisplayNames`)과 같은 규칙이어야
            // 같은 종목이 검색 목록과 최근 검색 칩에서 다른 이름으로 뜨지 않는다.
            const label = (
                result.value.koreanName ??
                result.value.name ??
                ''
            ).trim();
            if (!label || label.toUpperCase() === symbol) return [];
            return [[symbol, label] as const];
        })
    );

    const failed = unique.filter(
        (_, index) => settled[index].status === 'rejected'
    );

    return { labels, failed };
}
