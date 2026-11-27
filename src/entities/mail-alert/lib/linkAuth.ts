import type { MailAlertLinkAuth } from '../model';

/** 액션 인자는 믿을 수 없는 값이다 — 두 문자열 필드를 가진 객체만 설정 링크 값으로 받는다. */
export function readLinkAuth(link: unknown): MailAlertLinkAuth | undefined {
    if (typeof link !== 'object' || link === null) return undefined;
    const { s, sig } = Object.fromEntries(Object.entries(link));
    return typeof s === 'string' && typeof sig === 'string'
        ? { s, sig }
        : undefined;
}
