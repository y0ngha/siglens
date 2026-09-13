/**
 * Mirrors core `AGENT_LIMITS.turnsPerDay.free` — a plain literal, not read
 * from core at module load. Importing a core runtime value into a client
 * widget breaks partial `@y0ngha/siglens-core` mocks other tests rely on
 * (a bare re-export forces the whole module to evaluate on import).
 * `guestTurnLimit.test.ts` asserts this stays equal to core's value, so
 * drift fails CI instead of silently showing the wrong number in the banner.
 */
export const GUEST_TURNS_PER_DAY = 10;

/** Mirrors core `AGENT_LIMITS.turnsPerDay.member`, same reasons and drift test as above. */
export const MEMBER_TURNS_PER_DAY = 60;
