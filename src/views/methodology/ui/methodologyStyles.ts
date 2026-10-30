/**
 * `/methodology` 섹션들이 함께 쓰는 본문 클래스.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 본문 속 링크. `/about`의 링크와 같은 모양이되, 이 페이지는 긴 읽을거리라
 * 링크가 문단 사이에 서 있다 — 모바일 터치 영역 44px(`min-h-11`)을 준다.
 */
export const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 본문 문단. */
export const BODY_TEXT = 'max-w-2xl text-[15px] leading-7 text-secondary-300';

/** 글머리표 목록. */
export const BULLET_LIST =
    'flex max-w-2xl list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500';

/** 단계·시장·지수 카드 한 장의 면. */
export const CARD = cn(SURFACE_CARD, 'p-4 sm:p-5');
