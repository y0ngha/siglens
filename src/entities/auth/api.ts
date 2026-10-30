import type { Tier } from '@y0ngha/siglens-core';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { oauthAccounts, sessions, users } from '@/shared/db/schema';
import {
    encryptToken,
    requireOauthTokenEncryptionKey,
} from '@/shared/db/tokenEncryption';
import type {
    AuthSessionRecord,
    CreateEmailUserInput,
    CreateOAuthUserInput,
    CreateSessionInput,
    EmailAuthUserRecord,
    EmailAuthUserRepository,
    OAuthUserRepository,
    SessionRepository,
    SiglensDatabase,
    UserRepository,
    UserTierRepository,
} from '@/shared/db/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import type { OAuthProvider } from '@/shared/lib/types';
import { withRetry } from '@/shared/lib/withRetry';
import { isSessionToken } from './lib/isSessionToken';

const sessionColumns = {
    id: sessions.id,
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
};

/**
 * 가입(이메일/비밀번호·OAuth) 시 부여하는 tier. 가입한 사용자는 member이고, 사용자 행이 없는
 * 익명 방문자는 {@link DrizzleUserRepository.getUserTier}를 거쳐 core의 `DEFAULT_TIER`('free')로
 * 떨어진다 — 이 상수와 무관하다.
 */
const SIGNED_UP_USER_TIER: Tier = 'member';

/**
 * {@link DrizzleSessionRepository.pruneExpiredSessions} 한 번이 지우는 최대 행 수.
 *
 * Postgres DELETE에는 `LIMIT`이 없어 `id IN (SELECT … LIMIT N)`으로 캡을 건다
 * (`analysisHistoryRepository`의 `PRUNE_BATCH_SIZE`와 같은 이유 — 몇 달 치 누적을
 * 한 문장으로 지우면 오래 잠근다). 남은 몫은 다음 seo-prewarm tick이 이어서 지운다.
 */
export const EXPIRED_SESSION_PRUNE_BATCH_SIZE = 500;

/**
 * {@link SessionRepository}의 Drizzle/PostgreSQL 구현. 세션 id(uuid)가 곧 쿠키 토큰이므로
 * 토큰을 받는 메서드는 uuid 형식이 아닌 값을 쿼리에 바인딩하지 않고 "없는 세션"으로 처리한다
 * ({@link isSessionToken}).
 */
export class DrizzleSessionRepository implements SessionRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 세션 행을 만들고 DB가 생성한 id(=쿠키 토큰)를 담아 돌려준다. */
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
            DB_TRANSIENT_RETRY
        );

        if (session === undefined) {
            throw new Error('[createSession] insert returned no row');
        }
        return session;
    }

    /** 토큰의 세션 행을 읽는다. 만료 판정은 호출부(`findUserBySessionToken`)가 한다. 읽기라 재시도하지 않는다. */
    async findSession(sessionToken: string): Promise<AuthSessionRecord | null> {
        if (!isSessionToken(sessionToken)) return null;
        const [session] = await this.db
            .select(sessionColumns)
            .from(sessions)
            .where(eq(sessions.id, sessionToken))
            .limit(1);

        return session ?? null;
    }

    /** 세션 행을 지우고, 실제로 지웠으면 true(이미 없거나 형식이 틀린 토큰이면 false). */
    async deleteSession(sessionToken: string): Promise<boolean> {
        if (!isSessionToken(sessionToken)) return false;
        // 로그아웃 동작 — transient 실패가 노출되면 사용자가 다시 시도해야 한다.
        const deletedSessions = await withRetry(
            () =>
                this.db
                    .delete(sessions)
                    .where(eq(sessions.id, sessionToken))
                    .returning({ id: sessions.id }),
            DB_TRANSIENT_RETRY
        );

        return deletedSessions.length > 0;
    }

    /**
     * 만료된 세션 행을 최대 {@link EXPIRED_SESSION_PRUNE_BATCH_SIZE}개 지우고 지운 수를 반환한다.
     *
     * 만료 세션은 로그인 판정에 쓰이지 않지만(조회 측이 `expiresAt`을 본다) 지우는 곳이
     * 로그아웃(`deleteSession`)뿐이라, 로그아웃 없이 만료된 세션은 영원히 남았다.
     * `WHERE expires_at < now`는 `sessions_expires_at_idx`를 탄다.
     *
     * 세션은 만료 시각을 연장하는 경로가 없으므로(생성·삭제만 있다) 서브쿼리로 고른 id를
     * 그대로 지워도 경합이 없다. 실패는 호출부가 격리한다(seo-prewarm cron).
     */
    async pruneExpiredSessions(now: Date = new Date()): Promise<number> {
        const expiredIds = this.db
            .select({ id: sessions.id })
            .from(sessions)
            .where(lt(sessions.expiresAt, now))
            .limit(EXPIRED_SESSION_PRUNE_BATCH_SIZE);

        const deleted = await withRetry(
            () =>
                this.db
                    .delete(sessions)
                    .where(inArray(sessions.id, expiredIds))
                    .returning({ id: sessions.id }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }
}

/** 선택적 OAuth 토큰을 암호화한다. 값이 없으면 null을 그대로 저장한다. */
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
 * {@link UserRepository}·{@link EmailAuthUserRepository}·{@link OAuthUserRepository}·
 * {@link UserTierRepository}의 Drizzle/Neon PostgreSQL 구현. `passwordHash`는
 * `findEmailAuthUserByEmail`만 돌려주고 나머지 조회는 {@link AuthUserRecord} 컬럼만 고른다.
 */
export class DrizzleUserRepository
    implements
        UserRepository,
        EmailAuthUserRepository,
        OAuthUserRepository,
        UserTierRepository
{
    constructor(private readonly db: SiglensDatabase) {}

    /** 이메일로 사용자를 찾는다(비밀번호 해시 제외). */
    async findByEmail(email: string): Promise<AuthUserRecord | null> {
        const [user] = await this.db
            .select(authUserColumns)
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        return user ?? null;
    }

    /** id로 사용자를 찾는다(비밀번호 해시 제외). */
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
            DB_TRANSIENT_RETRY
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
            DB_TRANSIENT_RETRY
        );

        return updatedUsers.length > 0;
    }

    /** 로그인·비밀번호 재설정용으로 `passwordHash`를 포함해 이메일로 찾는다. 호출부가 해시를 밖으로 내보내면 안 된다. */
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

    /** 이메일 가입 사용자를 만든다. 이메일이 이미 있으면(동시 가입 포함) null. */
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
            DB_TRANSIENT_RETRY
        );

        return user ?? null;
    }

    /** 연결된 OAuth 계정(프로바이더 + 계정 id)의 사용자를 찾는다. */
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

    /**
     * OAuth 가입 사용자와 연결 계정을 만든다. 이메일이나 프로바이더 계정이 이미 있으면 null.
     * 두 INSERT는 한 트랜잭션이 아니므로, 계정 INSERT가 충돌하거나 실패하면 방금 만든
     * 사용자 행을 보상 삭제해 같은 이메일로 다시 가입할 수 있게 한다.
     */
    async createOAuthUser(
        input: CreateOAuthUserInput
    ): Promise<AuthUserRecord | null> {
        // DB 쓰기 전에 암호화 키를 확인한다 — OAUTH_TOKEN_ENCRYPTION_KEY가 없으면 신규
        // OAuth 가입이 토큰을 null로 조용히 저장하는 대신 작업 전체를 중단한다.
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
            DB_TRANSIENT_RETRY
        );

        if (user === undefined) {
            return null;
        }

        const account = await this.insertOAuthAccount(
            user.id,
            input,
            encryptionKey
        ).catch(async (error: unknown) => {
            // 계정 INSERT(또는 토큰 암호화)가 던져도 사용자 행만 남으면 같은 이메일로 다시
            // 가입할 수 없으므로 보상 삭제 뒤 원래 오류를 그대로 전파한다.
            await this.deleteOrphanedUser(user.id);
            throw error;
        });

        if (account === undefined) {
            await this.deleteOrphanedUser(user.id);
            return null;
        }

        return user;
    }

    /** 연결 계정 행을 넣는다. (provider, providerAccountId)가 이미 있으면 undefined. */
    private async insertOAuthAccount(
        userId: string,
        input: CreateOAuthUserInput,
        encryptionKey: string
    ): Promise<{ id: string } | undefined> {
        const [account] = await withRetry(
            () =>
                this.db
                    .insert(oauthAccounts)
                    .values({
                        userId,
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
            DB_TRANSIENT_RETRY
        );
        return account;
    }

    /**
     * 보상 삭제. 이것도 transient DB 실패에 노출되므로 `withRetry`로 감싸, 정리 중 한 번의
     * fetch 실패로 고아 사용자 행이 남아 같은 이메일로 재가입하지 못하는 일을 줄인다.
     * 그래도 실패하면 로그만 남긴다(호출부는 원래 결과/오류를 그대로 돌려줘야 한다).
     */
    private async deleteOrphanedUser(userId: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .delete(users)
                    .where(eq(users.id, userId))
                    .returning({ id: users.id }),
            DB_TRANSIENT_RETRY
        ).catch(deleteErr => {
            console.warn(
                '[createOAuthUser] compensating delete failed — user row may be orphaned',
                deleteErr
            );
        });
    }

    /** 사용자의 tier. 사용자 행이 없으면 null(호출부가 `DEFAULT_TIER`로 강등). */
    async getUserTier(userId: string): Promise<Tier | null> {
        const [user] = await this.db
            .select({ tier: users.tier })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return user?.tier ?? null;
    }
}
