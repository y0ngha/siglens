/** 잠금 업셀 카드가 보일 문구 종류. 번역은 호출부가 한다(이 함수는 순수 판정만). */
export interface LockedCardCopy {
    readonly title: 'meterExhausted' | 'default';
    readonly body:
        | { readonly kind: 'meterExhausted'; readonly count: number }
        | { readonly kind: 'skillUpsell'; readonly count: number }
        | { readonly kind: 'default' };
}

/**
 * 잠금 업셀 카드 문구를 고른다. 미터 소진이 가장 우선이고(오늘 무료 공개가 끝났다는
 * 사실이 가입 이유로 가장 구체적이다), 그다음이 잠긴 스킬 수 업셀, 둘 다 아니면 기본 문구.
 */
export function selectLockedCardCopy(input: {
    readonly isMeterExhausted: boolean;
    readonly skillCount: number;
    readonly meterDailySymbols: number;
}): LockedCardCopy {
    if (input.isMeterExhausted)
        return {
            title: 'meterExhausted',
            body: { kind: 'meterExhausted', count: input.meterDailySymbols },
        };
    if (input.skillCount > 0)
        return {
            title: 'default',
            body: { kind: 'skillUpsell', count: input.skillCount },
        };
    return { title: 'default', body: { kind: 'default' } };
}
