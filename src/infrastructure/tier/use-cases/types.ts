import type { Tier } from '@y0ngha/siglens-core';
import type { UserTierRepository } from '@/infrastructure/db/types';

/** Input for looking up a user's persisted tier. */
export interface GetUserTierInput {
    /** User UUID to look up. */
    userId: string;
}

/** Dependencies required by tier use-cases. */
export interface UserTierDependencies {
    /** Repository that persists user tier assignments. */
    users: UserTierRepository;
}

/** Input for building request-scoped tier context. */
export interface CreateUserTierContextInput {
    /** Authenticated user UUID, or null/undefined for anonymous requests. */
    userId?: string | null;
}

/** Input for an administrator changing a user's tier. */
export interface SetUserTierInput {
    /** User UUID to update. */
    userId: string;
    /** New tier to persist. */
    tier: Tier;
}

/** Error code returned when a tier update cannot find the target user. */
export type SetUserTierErrorCode = 'user_not_found';

/** Structured tier update error. */
export interface SetUserTierError {
    /** Machine-readable error code. */
    code: SetUserTierErrorCode;
    /** Human-readable message suitable for admin surfaces. */
    message: string;
}

/** Discriminated union result of a tier update. */
export type SetUserTierResult =
    | { ok: true; userId: string; tier: Tier }
    | { ok: false; error: SetUserTierError };
