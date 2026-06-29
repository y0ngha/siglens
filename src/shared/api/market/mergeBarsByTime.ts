import type { Bar } from '@y0ngha/siglens-core';

/**
 * 두 Bar 배열을 time 기준 오름차순으로 병합·중복제거한다. 같은 time이 양쪽에 있으면
 * `recent` 값을 우선한다(live 갱신분이 long-cache된 과거 값을 덮어쓰도록). EOD 캐시
 * 분리에서 과거(long-cache) 윈도우와 최근(live) 윈도우를 합쳐 단일 연속 시리즈를
 * 복원하는 데 쓴다 — 결과는 단일 `getBars(from=now-730d)`와 동일 집합이어야 한다.
 */
export function mergeBarsByTime(historical: Bar[], recent: Bar[]): Bar[] {
    const byTime = new Map<number, Bar>();
    for (const b of historical) byTime.set(b.time, b);
    for (const b of recent) byTime.set(b.time, b); // recent wins on overlap
    return [...byTime.values()].sort((a, b) => a.time - b.time);
}
