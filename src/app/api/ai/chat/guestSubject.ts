import 'server-only';

const GUEST_SUBJECT_PREFIX = 'guest:';

/**
 * Quota/lock subject for a visitor without a session — the first-party
 * `siglens_guest` cookie id (`shared/api/guestId.ts`), so a guest's daily
 * turn quota and per-subject turn lock follow the browser rather than the
 * client IP. It is the `userId` core and the tool executors see for a guest
 * turn.
 *
 * Clearing the cookie mints a fresh guest and therefore a fresh quota, but
 * that alone does not buy unlimited turns: the route also runs a per-IP
 * backstop (`GUEST_IP_TURNS_PER_DAY`, `stream/route.ts`) sized for many
 * guests behind one shared address before a guest turn is allowed to start.
 */
export function guestSubject(guestId: string): string {
    return `${GUEST_SUBJECT_PREFIX}${guestId}`;
}

/** `true` when a turn's `userId` is a {@link guestSubject}, not a member id. */
export function isGuestSubject(userId: string): boolean {
    return userId.startsWith(GUEST_SUBJECT_PREFIX);
}
