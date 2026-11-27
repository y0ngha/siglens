import 'server-only';

import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { isMissingTableError } from '../lib/dbErrorKind';

/**
 * 알림 메일 액션이 던지지 않게 감싼다(SA-1). 테이블이 아직 없는 환경(마이그레이션 미적용, `42P01`)은
 * 공개 스위치가 꺼져 있어 원래 도달하지 않는 경로라 조용히 `fallback`으로 답하고, 그 밖의 오류는
 * 질의 값이 새지 않게 가려서 한 줄 남긴다.
 */
export async function guardMailAlertAction<T>(
    tag: string,
    fallback: T,
    run: () => Promise<T>
): Promise<T> {
    try {
        return await run();
    } catch (error) {
        if (!isMissingTableError(error)) {
            console.error(tag, redactDbErrorForLog(error));
        }
        return fallback;
    }
}
