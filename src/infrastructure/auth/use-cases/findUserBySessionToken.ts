import type { AuthUserRecord } from '@/shared/db/types';
import type {
    FindUserBySessionTokenDependencies,
    FindUserBySessionTokenOptions,
} from '@/infrastructure/auth/use-cases/types';

/** Resolve a session cookie token to its owning user. */
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
