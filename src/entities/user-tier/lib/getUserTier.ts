import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import type { GetUserTierInput, UserTierDependencies } from '../model';

/**
 * 저장된 회원 티어를 읽는다. `shared/lib/byokGate`가 분석 모델 게이팅에 쓴다.
 *
 * 행이 없으면(탈퇴·미가입) 가장 권한이 낮은 `DEFAULT_TIER`로 본다 — 모르는 사용자에게
 * 유료 기능을 열지 않는다. 저장소 오류는 free로 바꾸지 않고 그대로 던진다: DB 장애를
 * 무료 강등으로 숨기면 유료 회원이 조용히 기능을 잃는다.
 */
export async function getUserTier(
    input: GetUserTierInput,
    dependencies: UserTierDependencies
): Promise<Tier> {
    const tier = await dependencies.users.getUserTier(input.userId);

    return tier ?? DEFAULT_TIER;
}
