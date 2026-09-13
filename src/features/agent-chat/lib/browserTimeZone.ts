/** The browser's IANA zone, or '' when `Intl` cannot tell (core then uses the locale's zone). */
export function browserTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
        return '';
    }
}
