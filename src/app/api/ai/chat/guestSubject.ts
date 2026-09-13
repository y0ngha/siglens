import 'server-only';
import { hashClientIp } from '@y0ngha/siglens-core';

const GUEST_SUBJECT_PREFIX = 'guest:';

/**
 * Quota/lock subject for a visitor without a session — the hashed client IP,
 * so the raw address never reaches a Redis key. It is the `userId` core and
 * the tool executors see for a guest turn.
 *
 * Trade-off: visitors behind one shared IP (office NAT, mobile carrier CGNAT)
 * share one guest subject, so they share the daily guest turn quota and the
 * per-subject turn lock — a second concurrent guest turn from that IP gets a
 * `server_busy` 409. Acceptable for the pilot; signing in removes it.
 */
export function guestSubject(clientIp: string): string {
    return `${GUEST_SUBJECT_PREFIX}${hashClientIp(clientIp)}`;
}

/** `true` when a turn's `userId` is a {@link guestSubject}, not a member id. */
export function isGuestSubject(userId: string): boolean {
    return userId.startsWith(GUEST_SUBJECT_PREFIX);
}
