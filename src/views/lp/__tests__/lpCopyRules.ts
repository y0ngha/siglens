/**
 * Copy rules for the ad-only landing pages, shared by the unit tests
 * (`landings.test.tsx`, `app/lp/__tests__/metadata.test.ts`) and the E2E spec
 * (`e2e/specs/ad-landing.spec.ts`) so the three can never drift.
 *
 * Google Ads (KR) limits any ad whose landing page mentions crypto, and these
 * pages exist only as ad final URLs, so one crypto word anywhere defeats their
 * purpose (spec `2026-09-26-ad-landing-pages-design.md` "Guard"). The rest are
 * house style for ad copy: no middle dot or em dash, "종목" or the company name
 * rather than the jargon "티커", and no "가입/로그인 없이" phrasing.
 */
export const CRYPTO_RE =
    /코인|비트코인|이더리움|암호화폐|가상자산|크립토|crypto|bitcoin/i;

const BANNED: readonly RegExp[] = [
    CRYPTO_RE,
    /·/,
    /—/,
    /티커/,
    /(가입|로그인)\s*없이/,
];

/** Every banned phrase found in `text`; `[]` when the copy is clean. */
export function lpCopyViolations(text: string): string[] {
    return BANNED.flatMap(re => text.match(re)?.[0] ?? []);
}
