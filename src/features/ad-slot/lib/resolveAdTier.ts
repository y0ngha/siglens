/**
 * 광고를 보여 줄 등급인지 판정한다. Pro만 뺀다 — 무료 회원도 광고 대상이다(사용자 결정).
 *
 * `pending`은 로그인 정보를 아직 모르는 상태다. 이때 광고를 붙이면 Pro에게 광고가 먼저
 * 요청되고, 나중에 숨기면 정책상 금지인 "붙인 광고 숨기기"가 된다. 그래서 기다린다.
 * 조회 실패(`user`가 `undefined`)는 비로그인과 같게 본다.
 */
export type AdTierDecision = 'pending' | 'show' | 'hide';

export interface AdTierQuery {
    readonly isPending: boolean;
    readonly user: { readonly tier: string } | null | undefined;
}

export function resolveAdTier({
    isPending,
    user,
}: AdTierQuery): AdTierDecision {
    if (isPending) return 'pending';
    return user?.tier === 'pro' ? 'hide' : 'show';
}
