import type { Tier } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';
import { and, eq, lt, sql } from 'drizzle-orm';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { oauthAccounts, sessions, users } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    AuthSessionRecord,
    AuthUserRecord,
    CreateEmailUserInput,
    CreateOAuthUserInput,
    CreateSessionInput,
    EmailAuthUserRecord,
    EmailAuthUserRepository,
    OAuthUserRepository,
    SessionRepository,
    UserRepository,
    UserTierRepository,
} from '@/shared/db/types';
import {
    encryptToken,
    requireOauthTokenEncryptionKey,
} from '@/shared/db/tokenEncryption';
import { withRetry } from '@/shared/lib/withRetry';

const sessionColumns = {
    id: sessions.id,
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
};

/**
 * Tier assigned to a user at signup (email/password or OAuth). A signed-up
 * user is a member — anonymous visitors have no user row and fall back to
 * core's `DEFAULT_TIER` ('free') via {@link getUserTier}, which is unaffected
 * by this constant.
 */
const SIGNED_UP_USER_TIER: Tier = 'member';

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

function encryptOptional(
    token: string | undefined,
    encryptionKey: string
): string | null {
    if (token === undefined) {
        return null;
    }
    return encryptToken(token, encryptionKey);
}

const authUserColumns = {
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
    tier: users.tier,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
};

const emailAuthUserColumns = {
    ...authUserColumns,
    passwordHash: users.passwordHash,
};

/**
 * Drizzle ORM implementation of {@link UserRepository}, {@link EmailAuthUserRepository},
 * {@link OAuthUserRepository}, and {@link UserTierRepository} backed by a Neon
 * PostgreSQL database.
 */
export class DrizzleUserRepository
    implements
        UserRepository,
        EmailAuthUserRepository,
        OAuthUserRepository,
        UserTierRepository
{
    constructor(private readonly db: SiglensDatabase) {}

    async findByEmail(email: string): Promise<AuthUserRecord | null> {
        const [user] = await this.db
            .select(authUserColumns)
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        return user ?? null;
    }

    async findById(userId: string): Promise<AuthUserRecord | null> {
        const [user] = await this.db
            .select(authUserColumns)
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return user ?? null;
    }

    async deleteUser(userId: string): Promise<boolean> {
        // 회원 탈퇴는 사용자 명시적 액션 — transient 실패는 retry로 흡수해
        // 재시도 유도 없이 일관 동작.
        const deletedUsers = await withRetry(
            () =>
                this.db
                    .delete(users)
                    .where(eq(users.id, userId))
                    .returning({ id: users.id }),
            NEON_TRANSIENT_RETRY
        );

        return deletedUsers.length > 0;
    }

    async updatePassword(
        userId: string,
        passwordHash: string
    ): Promise<boolean> {
        // 비밀번호 변경 — 사용자가 폼 제출 직후 결과를 본다. transient retry로 흡수.
        const updatedUsers = await withRetry(
            () =>
                this.db
                    .update(users)
                    .set({ passwordHash, updatedAt: sql`now()` })
                    .where(eq(users.id, userId))
                    .returning({ id: users.id }),
            NEON_TRANSIENT_RETRY
        );

        return updatedUsers.length > 0;
    }

    async findEmailAuthUserByEmail(
        email: string
    ): Promise<EmailAuthUserRecord | null> {
        const [user] = await this.db
            .select(emailAuthUserColumns)
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        return user ?? null;
    }

    async createEmailUser(
        input: CreateEmailUserInput
    ): Promise<AuthUserRecord | null> {
        const [user] = await withRetry(
            () =>
                this.db
                    .insert(users)
                    .values({
                        email: input.email,
                        passwordHash: input.passwordHash,
                        name: input.name ?? null,
                        avatarUrl: input.avatarUrl ?? null,
                        tier: SIGNED_UP_USER_TIER,
                        emailVerified: input.emailVerified ?? false,
                    })
                    .onConflictDoNothing({ target: users.email })
                    .returning(authUserColumns),
            NEON_TRANSIENT_RETRY
        );

        return user ?? null;
    }

    async findByOAuthAccount(
        provider: OAuthProvider,
        providerAccountId: string
    ): Promise<AuthUserRecord | null> {
        const [user] = await this.db
            .select(authUserColumns)
            .from(oauthAccounts)
            .innerJoin(users, eq(oauthAccounts.userId, users.id))
            .where(
                and(
                    eq(oauthAccounts.provider, provider),
                    eq(oauthAccounts.providerAccountId, providerAccountId)
                )
            )
            .limit(1);

        return user ?? null;
    }

    async createOAuthUser(
        input: CreateOAuthUserInput
    ): Promise<AuthUserRecord | null> {
        // Resolve encryption key BEFORE any DB write so that a missing
        // OAUTH_TOKEN_ENCRYPTION_KEY aborts the entire operation instead of
        // silently persisting null tokens for fresh OAuth signups.
        const encryptionKey = requireOauthTokenEncryptionKey();

        const [user] = await withRetry(
            () =>
                this.db
                    .insert(users)
                    .values({
                        email: input.email,
                        passwordHash: null,
                        name: input.name ?? null,
                        avatarUrl: input.avatarUrl ?? null,
                        tier: SIGNED_UP_USER_TIER,
                        emailVerified: true,
                    })
                    .onConflictDoNothing({ target: users.email })
                    .returning(authUserColumns),
            NEON_TRANSIENT_RETRY
        );

        if (user === undefined) {
            return null;
        }

        const [account] = await withRetry(
            () =>
                this.db
                    .insert(oauthAccounts)
                    .values({
                        userId: user.id,
                        provider: input.provider,
                        providerAccountId: input.providerAccountId,
                        accessToken: encryptOptional(
                            input.accessToken,
                            encryptionKey
                        ),
                        refreshToken: encryptOptional(
                            input.refreshToken,
                            encryptionKey
                        ),
                        tokenExpiresAt: input.tokenExpiresAt ?? null,
                    })
                    .onConflictDoNothing({
                        target: [
                            oauthAccounts.provider,
                            oauthAccounts.providerAccountId,
                        ],
                    })
                    .returning({ id: oauthAccounts.id }),
            NEON_TRANSIENT_RETRY
        );

        if (account === undefined) {
            // Compensating delete is also exposed to Neon transient failures —
            // wrap it in withRetry so a single fetch hiccup on cleanup doesn't
            // leave an orphaned user row that prevents the user from ever
            // re-signing up under the same email.
            await withRetry(
                () =>
                    this.db
                        .delete(users)
                        .where(eq(users.id, user.id))
                        .returning({ id: users.id }),
                NEON_TRANSIENT_RETRY
            ).catch(deleteErr => {
                console.warn(
                    '[createOAuthUser] compensating delete failed — user row may be orphaned',
                    deleteErr
                );
            });
            return null;
        }

        return user;
    }

    async getUserTier(userId: string): Promise<Tier | null> {
        const [user] = await this.db
            .select({ tier: users.tier })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return user?.tier ?? null;
    }

    async updateUserTier(userId: string, tier: Tier): Promise<Tier | null> {
        // 결제/티어 상승 직후 호출 — transient 실패가 노출되면 결제는 됐는데
        // 티어가 안 올라간 것처럼 보인다. retry로 흡수.
        const [user] = await withRetry(
            () =>
                this.db
                    .update(users)
                    .set({ tier, updatedAt: sql`now()` })
                    .where(eq(users.id, userId))
                    .returning({ tier: users.tier }),
            NEON_TRANSIENT_RETRY
        );

        return user?.tier ?? null;
    }
}
