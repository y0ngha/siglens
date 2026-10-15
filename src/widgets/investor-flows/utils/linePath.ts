/** 선 그래프용 좌표 계산(순수). viewBox는 가로·세로 모두 0~100 단위다. */

export interface LinePoint {
    /** 0~100 (왼쪽 → 오른쪽). */
    x: number;
    /** 0~100 (위 → 아래, SVG 좌표). */
    y: number;
}

export interface LineGeometry {
    /** `null` 값에서 끊긴 구간별 점. */
    segments: LinePoint[][];
    /** 마지막 유효 점(없으면 `null`) — 끝점 표식용. */
    last: LinePoint | null;
    /** 평균선의 y(없으면 `null`). */
    averageY: number | null;
    min: number;
    max: number;
}

/** 위·아래 여백(단위): 선이 테두리에 붙어 잘리지 않게 한다. */
const PADDING = 8;

/**
 * 값 배열(오래된 → 최신)을 0~100 좌표로 바꾼다. 최솟값·최댓값은 `average`까지 포함해 정해 평균선이 영역 안에
 * 들어오게 한다. 값이 모두 같으면 한가운데 수평선이다. `null`은 선을 끊는다.
 */
export function buildLineGeometry(
    values: readonly (number | null)[],
    average: number | null
): LineGeometry | null {
    const finite = values.filter((v): v is number => v !== null);
    if (finite.length === 0) return null;
    const pool = average === null ? finite : [...finite, average];
    const min = Math.min(...pool);
    const max = Math.max(...pool);
    const span = max - min;
    const toY = (value: number): number =>
        span === 0
            ? 50
            : PADDING + (1 - (value - min) / span) * (100 - PADDING * 2);
    const lastIndex = Math.max(values.length - 1, 1);
    const points = values.map((value, index) =>
        value === null
            ? null
            : {
                  x: values.length === 1 ? 50 : (index / lastIndex) * 100,
                  y: toY(value),
              }
    );
    // `null`(결측)에서 선을 끊는다: 앞에 결측이 몇 개 있었는지가 같은 유효 점끼리 한 구간이다.
    const segmentIds = values.map(
        (_, index) => values.slice(0, index).filter(v => v === null).length
    );
    const segments = Array.from(new Set(segmentIds))
        .map(id =>
            points.filter(
                (point): point is LinePoint =>
                    point !== null && segmentIds[points.indexOf(point)] === id
            )
        )
        .filter(segment => segment.length > 0);
    const last = points.findLast(point => point !== null) ?? null;
    return {
        segments,
        last,
        averageY: average === null ? null : toY(average),
        min,
        max,
    };
}

/** 점 목록 → SVG path `d`. 한 점짜리 구간은 그리지 않는다(선이 아니라 점이라 끝점 표식이 맡는다). */
export function segmentToPath(points: readonly LinePoint[]): string {
    return points
        .map(
            (p, i) =>
                `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`
        )
        .join(' ');
}
