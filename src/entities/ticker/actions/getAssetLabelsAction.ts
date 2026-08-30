'use server';

import { getAssetInfo } from '../lib/getAssetInfo';
import { MAX_RECENT_SEARCHES } from '../lib/recentSearches';

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
 * 이름을 찾지 못한 심볼은 **결과에서 빠진다** — 호출부가 "못 찾았다"를 알아야
 * 심볼을 라벨로 다시 덮어쓰지 않는다.
 */
export async function getAssetLabelsAction(
    symbols: readonly string[]
): Promise<Record<string, string>> {
    const unique = [...new Set(symbols.map(s => s.trim().toUpperCase()))]
        .filter(Boolean)
        .slice(0, MAX_RECENT_SEARCHES);

    const infos = await Promise.all(unique.map(symbol => getAssetInfo(symbol)));

    const labels: Record<string, string> = {};
    unique.forEach((symbol, index) => {
        const info = infos[index];
        if (!info) return;
        // 한글명 우선 — 검색 결과 행(`resultDisplayNames`)과 같은 규칙이어야
        // 같은 종목이 검색 목록과 최근 검색 칩에서 다른 이름으로 뜨지 않는다.
        const label = (info.koreanName ?? info.name ?? '').trim();
        if (!label || label.toUpperCase() === symbol) return;
        labels[symbol] = label;
    });

    return labels;
}
