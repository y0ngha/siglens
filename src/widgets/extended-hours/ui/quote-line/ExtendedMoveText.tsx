/**
 * 확장 시세 캡션의 등락 덩어리(화살표·방향 단어·금액·%) leaf 컴포넌트.
 */
import type { ExtendedMoveDisplay } from '../../utils/extendedMove';

interface ExtendedMoveTextProps {
    move: ExtendedMoveDisplay;
    /** sr-only 방향 단어(상승·하락·보합). */
    moveLabel: string;
}

/**
 * 색만으로 방향을 전하지 않도록 화살표(장식)와 sr-only 방향 단어를 함께 둔다. 보합은
 * 화살표·방향색이 없다. sm 미만(터치)에서는 등락 금액을 빼고 %만 보인다 — 폭을 아낀다.
 */
export function ExtendedMoveText({ move, moveLabel }: ExtendedMoveTextProps) {
    return (
        <span
            data-testid="extended-hours-move"
            className={move.colorClass ?? undefined}
        >
            {move.arrow !== null && (
                <span aria-hidden="true">{move.arrow}</span>
            )}
            <span className="sr-only">{moveLabel}</span>
            <span className="hidden sm:inline">{move.amountText} </span>
            {move.percentText}
        </span>
    );
}
