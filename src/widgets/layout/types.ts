import type { Tier } from '@y0ngha/siglens-core';

/**
 * RSC 경계를 건너 헤더 사용자 메뉴로 전달되는 최소 직렬화 사용자 모양.
 *
 * `AuthUserRecord`와 분리해 메뉴가 읽지 않는 Date 필드까지 클라이언트로 싣지 않는다.
 */
export interface HeaderUserMenuUser {
    readonly email: string;
    readonly name: string | null;
    readonly tier: Tier;
    readonly avatarUrl: string | null;
}
