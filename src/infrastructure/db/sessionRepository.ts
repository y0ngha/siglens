import { eq, lt } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/infrastructure/db/isNeonTransientError';
import { sessions } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import type {
    AuthSessionRecord,
    CreateSessionInput,
    SessionRepository,
} from '@/infrastructure/db/types';
import { withRetry } from '@/shared/lib/withRetry';

const sessionColumns = {
    id: sessions.id,
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
};

/** Drizzle ORM implementation of {@link SessionRepository} backed by Neon PostgreSQL. */
export class DrizzleSessionRepository implements SessionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
        // 로그인 직후 세션 생성은 사용자에게 직접 노출되는 critical path —
        // transient 실패가 그대로 노출되면 사용자가 다시 로그인해야 한다.
        const [session] = await withRetry(
            () =>
                this.db
                    .insert(sessions)
                    .values({
                        userId: input.userId,
                        expiresAt: input.expiresAt,
                    })
                    .returning(sessionColumns),
            NEON_TRANSIENT_RETRY
        );

        return session!;
    }

    async findSession(sessionToken: string): Promise<AuthSessionRecord | null> {
        const [session] = await this.db
            .select(sessionColumns)
            .from(sessions)
            .where(eq(sessions.id, sessionToken))
            .limit(1);

        return session ?? null;
    }

    async deleteSession(sessionToken: string): Promise<boolean> {
        // 로그아웃 동작 — transient 실패가 노출되면 사용자가 다시 시도해야 한다.
        const deletedSessions = await withRetry(
            () =>
                this.db
                    .delete(sessions)
                    .where(eq(sessions.id, sessionToken))
                    .returning({ id: sessions.id }),
            NEON_TRANSIENT_RETRY
        );

        return deletedSessions.length > 0;
    }

    async deleteExpiredSessions(now: Date = new Date()): Promise<number> {
        // 백그라운드 cleanup — transient 실패가 다음 tick에 재시도되긴 하지만,
        // 인라인 retry로 처리해 cleanup이 한 tick 동안 누락되지 않도록 한다.
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(sessions)
                    .where(lt(sessions.expiresAt, now))
                    .returning({ id: sessions.id }),
            NEON_TRANSIENT_RETRY
        );

        return deleted.length;
    }
}
