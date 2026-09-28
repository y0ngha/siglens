import type { UserTierRepository } from '@/shared/db/types';

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
