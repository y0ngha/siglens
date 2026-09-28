/**
 * `onSelect`로 나가는 라벨의 단일 정규화 지점. 즉시 이동(`navigate`)과 결착 후
 * 이동(effect) 두 경로가 각자 정규화를 따로 하면 한쪽만 고쳤을 때 최근 검색에
 * 남는 라벨이 갈린다 — 빈 문자열·앞뒤 공백은 심볼로 대체한다.
 */
export function normalizeLabel(
    label: string | undefined,
    symbol: string
): string {
    return label?.trim() || symbol;
}
