/**
 * 라우트 종류별 골격 설정.
 *
 * 바깥 컨테이너(`outer`·`inner`)는 실제 페이지 `<main>`과 같은 폭·여백·배경을 둬야
 * 도착할 때 좌우로 튀거나 바탕색이 바뀌지 않는다. 실제 페이지의 `<main>` 클래스를
 * 바꾸면 여기 짝도 같이 바꾼다.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { SkeletonLayout, SkeletonRouteKind } from '../types';

const TITLE = 'h-8 w-56 sm:h-9 sm:w-72';
const READING = 'mx-auto w-full max-w-5xl space-y-6 px-4 py-8';
/**
 * 회원 화면(로그인·계정·포트폴리오) `<main>`의 바탕. 본문 기본 바탕(`body`의
 * secondary-900)보다 한 단계 어둡다 — 골격이 이걸 빼먹으면 도착 순간 화면 전체의
 * 바탕색이 바뀐다.
 */
const MEMBER_PAGE_BG = 'bg-secondary-950';

/** 라우트 종류 → 골격. 종목 라우트는 `SymbolEntrySkeleton`이 맡아 여기 없다. */
export const ROUTE_SKELETON_LAYOUTS: Readonly<
    Record<SkeletonRouteKind, SkeletonLayout>
> = {
    home: {
        outer: 'page-container space-y-6 py-12 sm:py-16',
        blocks: [
            { type: 'title', className: 'h-10 w-4/5 max-w-xl sm:h-12' },
            { type: 'lines', count: 2 },
            { type: 'panel', className: 'h-12 max-w-xl' },
            {
                type: 'cards',
                count: 3,
                grid: 'grid-cols-1 sm:grid-cols-3',
                card: 'h-28',
            },
        ],
    },
    market: {
        outer: 'page-container space-y-6 pt-6 pb-8',
        blocks: [
            { type: 'panel', className: 'h-4 w-32' },
            { type: 'title', className: TITLE },
            {
                type: 'cards',
                count: 4,
                grid: 'grid-cols-2 lg:grid-cols-4',
                card: 'h-24',
            },
            { type: 'panel', className: 'h-72' },
        ],
    },
    fearGreed: {
        outer: 'page-container space-y-6 pt-6 pb-8',
        blocks: [
            { type: 'panel', className: 'h-4 w-32' },
            { type: 'title', className: TITLE },
            { type: 'lines', count: 3 },
            { type: 'panel', className: 'h-56' },
            { type: 'panel', className: 'h-40' },
        ],
    },
    economy: {
        outer: READING,
        blocks: [
            { type: 'title', className: TITLE },
            { type: 'lines', count: 3 },
            {
                type: 'cards',
                count: 6,
                grid: 'grid-cols-2 sm:grid-cols-3',
                card: 'h-24',
            },
            { type: 'panel', className: 'h-64' },
        ],
    },
    news: {
        outer: READING,
        blocks: [
            { type: 'title', className: TITLE },
            { type: 'lines', count: 2 },
            {
                type: 'cards',
                count: 6,
                grid: 'grid-cols-1 sm:grid-cols-2',
                card: 'h-36',
            },
        ],
    },
    symbols: {
        outer: 'mx-auto w-full max-w-5xl space-y-8 px-4 py-8',
        blocks: [
            { type: 'title', className: TITLE },
            { type: 'lines', count: 1 },
            {
                type: 'cards',
                count: 16,
                grid: 'grid-cols-2 sm:grid-cols-4',
                card: 'h-10',
            },
        ],
    },
    backtesting: {
        outer: 'page-container space-y-6 py-12',
        blocks: [
            { type: 'title', className: 'mx-auto h-9 w-64 sm:w-96' },
            { type: 'lines', count: 2 },
            {
                type: 'cards',
                count: 3,
                grid: 'grid-cols-1 sm:grid-cols-3',
                card: 'h-24',
            },
            {
                type: 'cards',
                count: 3,
                grid: 'grid-cols-1',
                card: 'h-40',
            },
        ],
    },
    article: {
        outer: 'mx-auto w-full max-w-4xl space-y-6 px-4 pt-6 pb-16 sm:pt-8',
        blocks: [
            { type: 'panel', className: 'h-4 w-24' },
            { type: 'title', className: 'h-9 w-4/5 max-w-xl sm:h-11' },
            { type: 'lines', count: 3 },
            {
                type: 'cards',
                count: 4,
                grid: 'grid-cols-1 sm:grid-cols-2',
                card: 'h-36',
            },
        ],
    },
    legal: {
        outer: 'page-container flex flex-col items-center py-12 sm:py-16',
        inner: 'w-full max-w-3xl space-y-6',
        blocks: [
            { type: 'panel', className: 'h-4 w-28' },
            { type: 'title', className: 'h-9 w-64 sm:h-10' },
            { type: 'lines', count: 4 },
            { type: 'lines', count: 4 },
            { type: 'lines', count: 4 },
        ],
    },
    // 로그인·가입·비밀번호 화면이 함께 쓰는 `AuthCardShell`의 `<main>`·카드와 같은 틀.
    auth: {
        outer: cn(
            'flex items-center justify-center px-4 py-12',
            MEMBER_PAGE_BG
        ),
        inner: cn(SURFACE_CARD, 'w-full max-w-md space-y-5 p-8'),
        blocks: [
            { type: 'title', className: 'h-7 w-40' },
            { type: 'lines', count: 1 },
            { type: 'panel', className: 'h-11' },
            { type: 'panel', className: 'h-11' },
            { type: 'panel', className: 'h-11' },
        ],
    },
    account: {
        outer: cn('px-4 py-12', MEMBER_PAGE_BG),
        inner: 'mx-auto w-full max-w-2xl space-y-6',
        blocks: [
            { type: 'title', className: 'h-7 w-40' },
            { type: 'panel', className: 'h-40' },
            { type: 'panel', className: 'h-32' },
        ],
    },
    portfolio: {
        outer: cn('px-4 py-12', MEMBER_PAGE_BG),
        inner: 'mx-auto w-full max-w-5xl space-y-6',
        blocks: [
            { type: 'title', className: 'h-7 w-48' },
            { type: 'lines', count: 1 },
            {
                type: 'cards',
                count: 6,
                grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                card: 'h-40',
            },
        ],
    },
    share: {
        outer: 'mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6',
        blocks: [
            { type: 'title', className: 'h-8 w-64' },
            { type: 'panel', className: 'h-72' },
            { type: 'lines', count: 4 },
        ],
    },
    generic: {
        outer: 'page-container space-y-6 py-8',
        blocks: [
            { type: 'title', className: TITLE },
            { type: 'lines', count: 4 },
            { type: 'panel', className: 'h-64' },
        ],
    },
};
