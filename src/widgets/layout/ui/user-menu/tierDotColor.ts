import type { Tier } from '@y0ngha/siglens-core';

/** 티어별 점 색 — 아바타 모서리 배지와 메뉴 안 티어 표시가 같은 색을 쓴다. */
export const TIER_DOT_COLOR: Record<Tier, string> = {
    free: 'bg-secondary-500',
    member: 'bg-primary-500',
    pro: 'bg-ui-warning',
};
