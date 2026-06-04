/** 클라 번들에서 E2E 모드 감지 — NEXT_PUBLIC_E2E_TEST는 빌드 타임 인라인된다. */
export function isE2EClient(): boolean {
    return process.env.NEXT_PUBLIC_E2E_TEST === '1';
}
