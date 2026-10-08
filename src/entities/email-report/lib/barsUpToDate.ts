import type { Bar } from '@y0ngha/siglens-core';

const MS_PER_SECOND = 1000;

/**
 * `date`(UTC `YYYY-MM-DD`) 이하인 봉만 남긴다. `count`는 남은 앞쪽 봉 수 — 지표 배열을
 * 같은 길이로 자르는 데 쓴다.
 *
 * 차트 URL은 발송일이 키다. 몇 주 뒤 메일을 다시 열어 캐시가 비었을 때 그 사이의 봉까지
 * 그리면 "10월 8일" 이미지에 11월 봉이 섞인다. 봉은 시간순이라 앞에서부터 센다.
 */
export function barsUpToDate(
    bars: readonly Bar[],
    date: string
): { bars: Bar[]; count: number } {
    const index = bars.findIndex(
        bar =>
            new Date(bar.time * MS_PER_SECOND).toISOString().slice(0, 10) > date
    );
    const count = index === -1 ? bars.length : index;
    return { bars: bars.slice(0, count), count };
}
