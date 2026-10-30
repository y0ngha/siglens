import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '../model';

/**
 * `getOrSetCache`의 저장 가능 판정. snapshot이 없는 뷰는 표본 부족이라 캐시에 굳히지 않는다
 * — 다음 요청이 다시 계산해 데이터가 차면 곧바로 반영한다.
 */
export function hasSnapshot<S extends MarketFearGreedViewSnapshot>(
    view: MarketFearGreedView<S>
): boolean {
    return view.snapshot !== null;
}
