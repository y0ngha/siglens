/**
 * 잠금 업셀 카드 본문의 종류. 번역은 호출부가 한다(이 함수는 순수 판정만).
 * 제목은 소진 여부만으로 갈리므로 호출부가 `isMeterExhausted`로 고른다.
 */
export type LockedCardBodyKind = 'meterExhausted' | 'skillUpsell' | 'default';

/**
 * 잠금 업셀 카드 본문 종류를 고른다. 미터 소진이 가장 우선이고(오늘 무료 공개가 끝났다는
 * 사실이 가입 이유로 가장 구체적이다), 그다음이 잠긴 스킬 수 업셀, 둘 다 아니면 기본 문구.
 */
export function selectLockedCardBodyKind(input: {
    readonly isMeterExhausted: boolean;
    readonly skillCount: number;
}): LockedCardBodyKind {
    if (input.isMeterExhausted) return 'meterExhausted';
    if (input.skillCount > 0) return 'skillUpsell';
    return 'default';
}
