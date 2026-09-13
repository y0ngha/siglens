import 'server-only';
import { hashClientIp } from '@y0ngha/siglens-core';

const GUEST_SUBJECT_PREFIX = 'guest:';

/**
 * Quota/lock subject for a visitor without a session — the hashed client IP,
 * so the raw address never reaches a Redis key. It is the `userId` core and
 * the tool executors see for a guest turn.
 */
export function guestSubject(clientIp: string): string {
    return `${GUEST_SUBJECT_PREFIX}${hashClientIp(clientIp)}`;
}

/** `true` when a turn's `userId` is a {@link guestSubject}, not a member id. */
export function isGuestSubject(userId: string): boolean {
    return userId.startsWith(GUEST_SUBJECT_PREFIX);
}
