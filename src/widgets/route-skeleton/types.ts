/**
 * 라우트 골격의 설정 타입. 골격은 컴포넌트가 아니라 이 타입의 배열 설정으로만 그린다.
 */
import type { RouteKind } from '@/shared/config/routeKind';

/** 이 위젯이 그리는 라우트 종류 — 종목 라우트는 `SymbolEntrySkeleton` 몫이라 뺀다. */
export type SkeletonRouteKind = Exclude<RouteKind, 'symbol'>;

/** 골격을 이루는 블록 한 개. `type`마다 그리는 leaf 컴포넌트가 하나씩 있다. */
export type SkeletonBlock =
    /** 페이지 제목(h1) 자리. */
    | { readonly type: 'title'; readonly className: string }
    /** 본문 문단 자리 — 줄 수만큼. */
    | { readonly type: 'lines'; readonly count: number }
    /** 카드 격자. */
    | {
          readonly type: 'cards';
          readonly count: number;
          readonly grid: string;
          readonly card: string;
      }
    /** 큰 덩어리(차트·표·패널). */
    | { readonly type: 'panel'; readonly className: string };

/** 라우트 종류 하나의 골격 — 바깥 컨테이너 클래스와 블록 목록. */
export interface SkeletonLayout {
    /** 실제 페이지 `<main>`의 폭·여백·배경 클래스. */
    readonly outer: string;
    /** `<main>` 안에서 한 번 더 폭을 좁히는 페이지용. */
    readonly inner?: string;
    readonly blocks: readonly SkeletonBlock[];
}
