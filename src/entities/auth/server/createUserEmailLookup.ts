import 'server-only';

import type { SiglensDatabase } from '@/shared/db/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { DrizzleUserRepository } from '../api';

/**
 * 이메일로 회원을 찾는 조회 하나만 내미는 좁은 입구. 다른 엔티티(알림 메일)가 계정 저장소 전체
 * (`api.ts`)를 import하지 않고 "이 주소의 회원이 있는가"만 묻게 한다.
 */
export function createUserEmailLookup(db: SiglensDatabase): {
    findByEmail(email: string): Promise<AuthUserRecord | null>;
} {
    const users = new DrizzleUserRepository(db);
    return { findByEmail: email => users.findByEmail(email) };
}
