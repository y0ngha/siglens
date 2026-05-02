import { DEFAULT_TIER, type Tier } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/domain/types';
import { and, eq } from 'drizzle-orm';
import { oauthAccounts, users } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import {
    encryptToken,
    tryReadEncryptionKey,
} from '@/infrastructure/db/tokenEncryption';
import type {
    AuthUserRecord,
    CreateEmailUserInput,
    CreateOAuthUserInput,
    EmailAuthUserRecord,
    EmailAuthUserRepository,
    OAuthUserRepository,
    UserRepository,
    UserTierRepository,
} from '@/infrastructure/db/types';

class OAuthAccountConflictError extends Error {}

function encryptOptional(
    token: string | undefined,
    encryptionKey: string | null
): string | null {
    if (token === undefined || encryptionKey === null) {
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
        const deletedUsers = await this.db
            .delete(users)
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        return deletedUsers.length > 0;
    }

    async updatePassword(
        userId: string,
        passwordHash: string
    ): Promise<boolean> {
        const updatedUsers = await this.db
            .update(users)
            .set({ passwordHash })
            .where(eq(users.id, userId))
            .returning({ id: users.id });

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
        const [user] = await this.db
            .insert(users)
            .values({
                email: input.email,
                passwordHash: input.passwordHash,
                name: input.name ?? null,
                avatarUrl: input.avatarUrl ?? null,
                tier: DEFAULT_TIER,
                emailVerified: input.emailVerified ?? false,
            })
            .onConflictDoNothing({ target: users.email })
            .returning(authUserColumns);

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
        try {
            return await this.db.transaction(async tx => {
                const [user] = await tx
                    .insert(users)
                    .values({
                        email: input.email,
                        passwordHash: null,
                        name: input.name ?? null,
                        avatarUrl: input.avatarUrl ?? null,
                        tier: DEFAULT_TIER,
                        emailVerified: true,
                    })
                    .onConflictDoNothing({ target: users.email })
                    .returning(authUserColumns);

                if (user === undefined) {
                    return null;
                }

                const encryptionKey = tryReadEncryptionKey();

                const [account] = await tx
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
                    .returning({ id: oauthAccounts.id });

                if (account === undefined) {
                    throw new OAuthAccountConflictError();
                }

                return user;
            });
        } catch (error) {
            if (error instanceof OAuthAccountConflictError) {
                return null;
            }

            throw error;
        }
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
        const [user] = await this.db
            .update(users)
            .set({ tier })
            .where(eq(users.id, userId))
            .returning({ tier: users.tier });

        return user?.tier ?? null;
    }
}
