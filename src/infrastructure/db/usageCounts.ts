import type { UsageCounts, UsageRepository } from '@y0ngha/siglens-core';

/**
 * Siglens-side augmentation of {@link UsageCounts}.
 *
 * Upstream `UsageCounts` in `@y0ngha/siglens-core` (v0.7.1) only declares
 * `analysis` and `chatbot`, even though core's own `UsageActionType` enum and
 * the `usage_action_type` Postgres enum (drizzle migration `0002_*`) include
 * `'premium_model'`. Until core publishes a release that adds it to
 * `UsageCounts`, siglens consumers that need the premium-model bucket use
 * this widened type.
 *
 * Sync obligation: when core adds `premium_model` to `UsageCounts`, drop this
 * augmentation and import `UsageCounts` directly.
 */
export type SiglensUsageCounts = UsageCounts & {
    /** Number of premium-model requests recorded for the UTC day. */
    premium_model: number;
};

/**
 * Siglens-side augmentation of {@link UsageRepository} that exposes the wider
 * {@link SiglensUsageCounts} from `getUsageToday`. Siglens consumers (tier
 * limit checks, dashboards) should depend on this interface rather than
 * `UsageRepository` so that `premium_model` is not narrowed away by the
 * upstream type. Core consumers that only need `analysis`/`chatbot` continue
 * to work via structural sub-typing because `SiglensUsageCounts` is a
 * superset of `UsageCounts`.
 */
export interface SiglensUsageRepository extends UsageRepository {
    getUsageToday(ipHash: string, now?: Date): Promise<SiglensUsageCounts>;
}
