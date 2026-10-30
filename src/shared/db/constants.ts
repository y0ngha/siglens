import type { Tier } from '@y0ngha/siglens-core';
import type { OAuthProvider } from '@/shared/lib/types';

/** user `tier` 컬럼의 enum 값. `satisfies`로 core의 `Tier` 유니온과 어긋나면 컴파일이 실패하게 묶는다. */
export const USER_TIER_VALUES = [
    'free',
    'member',
    'pro',
] as const satisfies readonly Tier[];

/** `oauth_provider` Postgres enum values. `kakao`는 레거시 값이다 — `OAuthProvider` 주석 참고. */
export const OAUTH_PROVIDER_VALUES = [
    'google',
    'kakao',
    'apple',
] as const satisfies readonly OAuthProvider[];

/** `terms` 테이블이 구분하는 약관 문서 종류. */
export const TERMS_KIND_VALUES = ['privacy', 'tos'] as const;
export type TermsKind = (typeof TERMS_KIND_VALUES)[number];

/** 공유 가능한 분석 종류 — Postgres enum이자 UI 판별자로 함께 쓴다. */
export const SHAREABLE_KIND_VALUES = [
    'chart',
    'overall',
    'news',
    'fundamental',
    'financials',
    'congress',
    'options',
    'fear-greed',
] as const;
export type ShareableKind = (typeof SHAREABLE_KIND_VALUES)[number];
