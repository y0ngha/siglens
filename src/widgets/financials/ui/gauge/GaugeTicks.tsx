/**
 * 게이지 호 바깥의 눈금 숫자.
 */
import { TICK_VALUES, tickLabelPlacement } from '../../utils/gaugeGeometry';

/** 0·25·50·75·100 눈금 라벨. */
export function GaugeTicks() {
    return (
        <>
            {TICK_VALUES.map(value => {
                const { x, y, anchor } = tickLabelPlacement(value);
                return (
                    <text
                        key={value}
                        x={x}
                        y={y}
                        textAnchor={anchor}
                        dominantBaseline="middle"
                        className="fill-current text-[10px] font-medium text-secondary-400 tabular-nums"
                    >
                        {value}
                    </text>
                );
            })}
        </>
    );
}
