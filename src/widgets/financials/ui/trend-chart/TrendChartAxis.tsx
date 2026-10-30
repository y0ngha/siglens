/**
 * 추세 차트 x축의 기간 라벨 행.
 */
import {
    SVG_PADDING_LEFT,
    SVG_PADDING_RIGHT,
} from '../../utils/trendChartGeometry';

interface TrendChartAxisProps {
    periods: string[];
}

/**
 * 라벨을 SVG와 같은 좌우 패딩 안에서 n등분해 각 열 중앙에 놓는다. 막대는 `SVG_PADDING_LEFT`부터
 * `barGroupWidth` 간격으로 놓이므로, 라벨을 0~100%에 가장자리 정렬하면 양 끝 라벨이 자기 열
 * 밖으로 나간다.
 */
export function TrendChartAxis({ periods }: TrendChartAxisProps) {
    return (
        <div
            className="mt-1 grid"
            style={{
                gridTemplateColumns: `repeat(${periods.length}, 1fr)`,
                paddingLeft: `${SVG_PADDING_LEFT}%`,
                paddingRight: `${SVG_PADDING_RIGHT}%`,
            }}
        >
            {periods.map(period => (
                <span
                    key={period}
                    className="text-center text-xs text-secondary-400"
                >
                    {period}
                </span>
            ))}
        </div>
    );
}
