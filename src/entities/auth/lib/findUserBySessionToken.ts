import type { AuthUserRecord } from '@/shared/lib/auth/types';
import type {
    FindUserBySessionTokenDependencies,
    FindUserBySessionTokenOptions,
} from './authUseCaseTypes';

/**
 * 세션 쿠키 토큰이 가리키는 사용자를 찾는다. 세션이 없거나 만료(`expiresAt <= now`)됐거나
 * 사용자가 없으면 null이다.
 */
export async function findUserBySessionToken(
    sessionToken: string,
    dependencies: FindUserBySessionTokenDependencies,
    options: FindUserBySessionTokenOptions = {}
): Promise<AuthUserRecord | null> {
    const session = await dependencies.sessions.findSession(sessionToken);

    if (session === null) {
        return null;
    }

    const now = options.now ?? new Date();

    if (session.expiresAt.getTime() <= now.getTime()) {
        return null;
    }

    return dependencies.users.findById(session.userId);
}
