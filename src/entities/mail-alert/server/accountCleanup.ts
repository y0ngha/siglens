import 'server-only';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleMailAlertSubscriberRepository } from '../api';
import { isMissingTableError } from '../lib/dbErrorKind';

/**
 * 회원 탈퇴가 알림 메일 신청을 함께 파기하는 포트. 테이블이 아직 없는 환경(`42P01`, 마이그레이션 미적용)은
 * 지울 것이 없는 것이라 조용히 0을 돌려주고, 그 밖의 오류는 호출자(`deleteAccount`)가 로그만 남기고 삭제를
 * 이어 가도록 그대로 던진다.
 */
export function createMailAlertAccountCleanup(db: SiglensDatabase): {
    deleteForAccount(userId: string): Promise<number>;
} {
    const subscribers = new DrizzleMailAlertSubscriberRepository(db);
    return {
        async deleteForAccount(userId) {
            try {
                return await subscribers.deleteForAccount(userId);
            } catch (error) {
                if (isMissingTableError(error)) return 0;
                throw error;
            }
        },
    };
}
