'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { getAssetLabelsAction } from '@/entities/ticker/actions/getAssetLabelsAction';
import { MAX_RECENT_SEARCHES } from '@/entities/ticker/lib/recentSearches';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/**
 * `getAssetLabelsAction` 한 번에 물을 수 있는 심볼 수. 액션이 이 수에서 잘라 버리므로
 * (최근 검색 백필용 상한) 그보다 많으면 나눠 묻는다.
 */
const LABELS_PER_CALL = MAX_RECENT_SEARCHES;

/** 이 훅 인스턴스가 이미 답을 받은 심볼 — 이름이 없다는 답(`null`)도 기억한다. */
type KnownLabels = Map<string, string | null>;

async function fetchMissingLabels(
    symbols: readonly string[],
    known: KnownLabels
): Promise<Record<string, string>> {
    const missing = symbols.filter(symbol => !known.has(symbol));
    // 서버 액션은 클라이언트에서 어차피 직렬화된다 — 순서대로 묻는다.
    for (let i = 0; i < missing.length; i += LABELS_PER_CALL) {
        const batch = missing.slice(i, i + LABELS_PER_CALL);
        const { labels, failed } = await getAssetLabelsAction(batch);
        const failedSet = new Set(failed);
        for (const symbol of batch) {
            // 조회 자체가 실패한 심볼은 기억하지 않는다 — 다음 갱신 때 다시 묻는다.
            if (failedSet.has(symbol)) continue;
            known.set(symbol, labels[symbol] ?? null);
        }
    }
    return Object.fromEntries(
        symbols.flatMap(symbol => {
            const label = known.get(symbol);
            return label ? [[symbol, label] as const] : [];
        })
    );
}

/**
 * Display names for the symbols under the answers (`005930.KS` → `삼성전자`),
 * with the same Korean-name-first rule as search results.
 *
 * **대화 전체에 한 번** 부른다(`MessageList`). 예전에는 답변마다 이 훅을 불러, 긴 대화를
 * 열면 답변 수만큼 서버 액션 POST가 줄을 섰다(서버 액션은 클라이언트에서 직렬화된다).
 * 이제는 대화에 나온 심볼을 모아 한 쿼리로 묻고, 새 답변이 심볼을 더하면 아직 모르는
 * 심볼만 더 묻는다. 갱신 중에는 이전 결과를 유지해 이름이 심볼로 깜빡이지 않는다.
 * 조회 중이거나 이름이 없는 심볼은 호출부가 심볼 그대로 보여 준다.
 */
export function useSymbolLabels(
    symbols: readonly string[]
): Readonly<Record<string, string>> {
    const knownRef = useRef<KnownLabels>(new Map());
    // 입력 배열이 그대로면(호출부가 memo한 경우) 정렬도 다시 하지 않는다. 키는 값으로
    // 비교되므로 프레임마다 새 배열이어도 쿼리는 다시 돌지 않는다.
    const unique = useMemo(() => [...new Set(symbols)].toSorted(), [symbols]);
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetLabels(unique),
        queryFn: () => fetchMissingLabels(unique, knownRef.current),
        enabled: unique.length > 0,
        staleTime: Infinity,
        gcTime: Infinity,
        placeholderData: keepPreviousData,
    });
    return data ?? {};
}
