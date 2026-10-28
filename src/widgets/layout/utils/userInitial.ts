import type { HeaderUserMenuUser } from '../types';

/** 아바타에 쓸 이니셜 — 표시 이름이 있으면 그 첫 글자, 없으면 이메일의 첫 글자(대문자). */
export function getUserInitial(user: HeaderUserMenuUser): string {
    const source = user.name && user.name.length > 0 ? user.name : user.email;
    return source.charAt(0).toUpperCase();
}
