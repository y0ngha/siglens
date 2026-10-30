import type { UserTierRepository } from '@/shared/db/types';

/** `getUserTier` 입력. */
export interface GetUserTierInput {
    /** 조회할 회원 id(UUID) — 세션에서 확인된 값만 넘긴다. */
    userId: string;
}

/**
 * `getUserTier`가 쓰는 저장소. 주입받는 이유는 `lib/`를 I/O 없는 순수 함수로 두고
 * 테스트에서 저장소를 바꿔 끼우기 위해서다(EN-1).
 */
export interface UserTierDependencies {
    /** 회원 티어를 읽는 저장소. */
    users: UserTierRepository;
}
