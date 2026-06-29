/** expiresAt <= now 이면 만료. */
export function isExpired(expiresAt: Date, now: Date): boolean {
    return expiresAt.getTime() <= now.getTime();
}
