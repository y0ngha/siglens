/**
 * 데모 차트 보조 패널(`GuideDemoPane`)의 배치 계산 — 값 범위, 눈금, 레벨·범례 글자 자리.
 */
import type { DemoPane } from '@/views/guide/demos/types';
import {
    estimateLabelWidth,
    formatCompact,
    formatTick,
    niceStep,
    niceTicks,
    type LinearScale,
} from '@/views/guide/lib/chartLayout';
import { isFiniteValue } from '@/views/guide/lib/demoChartLayout';

/** 범위가 정해지지 않은 패널의 값 범위를 위아래로 띄우는 비율(값 범위 대비). */
export const PANE_PAD_RATIO = 0.12;
/** 범례 글자 사이, 그리고 패널 이름과 첫 범례 사이 가로 간격. */
export const LEGEND_GAP = 10;
/** 눈금이 레벨 선에 이만큼(viewBox 단위) 가까우면 레벨 라벨과 겹치므로 뺀다. */
const TICK_LEVEL_CLEARANCE = 9;
/** 패널 눈금 목표 개수. */
const PANE_TICK_TARGET = 3;

/** 절댓값이 이 값 이상이면 눈금·레벨 라벨을 K/M 단위 축약형으로 줄여 좁은 축 영역에 맞춘다. */
const COMPACT_ABS_THRESHOLD = 1e4;

/**
 * 눈금 간격이 이 값 이상이면 값 크기와 무관하게 축약 포맷터(`formatCompact`)로 보낸다. 천 단위 간격의
 * 축(거래량·OBV류)은 소수 자릿수를 따질 일이 없는 큰 정수 눈금이라, 0 근처 눈금까지 같은 포맷터를 거치게 한다.
 */
const COMPACT_STEP_THRESHOLD = 1000;

/**
 * 패널 이름을 패널 왼쪽 테두리에서 들이는 거리. `GuideDemoPane`이 이름을 그리는 x와 범례 시작점
 * (`legendPositions`)이 같은 값을 읽어야 범례가 이름과 겹치지 않는다.
 */
export const PANE_LABEL_INSET = 4;
/** 패널 안쪽 위·아래 여백. 값이 범위 끝이어도 선·막대가 테두리 선에 붙지 않게 한다. */
export const PANE_INNER_PAD = 4;

/** 레벨 라벨 소수 자릿수 상한 — 0.0001 단위 지표값까지 구분하고 그 아래 꼬리 자릿수는 버린다. */
const LEVEL_MAX_DECIMALS = 4;

/**
 * 패널 값 범위. `range`가 있으면 그대로, 없으면 선·막대·레벨 값(막대가 있으면 0 포함)에 `PANE_PAD_RATIO`만큼 띄운다.
 * 값이 하나도 없으면 [0, 1]이다.
 */
export function paneDomain(pane: DemoPane): [number, number] {
    if (pane.range !== undefined) return [pane.range[0], pane.range[1]];
    const values = [
        ...(pane.lines ?? []).flatMap(line => line.values),
        ...(pane.histogram ?? []),
    ].filter(isFiniteValue);
    const levelValues = (pane.levels ?? []).map(level => level.value);
    const baseline = pane.histogram === undefined ? [] : [0];
    const all = [...values, ...levelValues, ...baseline];
    if (all.length === 0) return [0, 1];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min || Math.abs(max) || 1) * PANE_PAD_RATIO;
    return [min - pad, max + pad];
}

/** 눈금 글자. 간격(`COMPACT_STEP_THRESHOLD`)이나 값(`COMPACT_ABS_THRESHOLD`)이 크면 축약형이다. */
export function paneTickText(value: number, step: number): string {
    return step >= COMPACT_STEP_THRESHOLD ||
        Math.abs(value) >= COMPACT_ABS_THRESHOLD
        ? formatCompact(value)
        : formatTick(value, step);
}

/** 레벨 라벨은 눈금 간격이 아니라 자기 값을 그대로(최대 4자리) 보여 준다. */
export function paneLevelText(value: number): string {
    return Math.abs(value) >= COMPACT_ABS_THRESHOLD
        ? formatCompact(value)
        : String(Number(value.toFixed(LEVEL_MAX_DECIMALS)));
}

/** 패널 눈금과 그 간격. 레벨 선 바로 옆 눈금은 레벨 라벨과 겹치므로 뺀다(간격은 빼기 전 기준). */
export interface PaneTicks {
    readonly ticks: readonly number[];
    readonly step: number;
}

/** [min, max] 패널의 눈금을 고른다. 레벨 선과 겹칠 눈금을 빼야 해서 화면 좌표(`yOf`)까지 받는다. */
export function paneTicks(
    min: number,
    max: number,
    levelValues: readonly number[],
    yOf: LinearScale
): PaneTicks {
    const all = niceTicks(min, max, PANE_TICK_TARGET);
    return {
        ticks: all.filter(
            tick =>
                !levelValues.some(
                    value =>
                        Math.abs(yOf(value) - yOf(tick)) < TICK_LEVEL_CLEARANCE
                )
        ),
        step:
            all.length > 1
                ? all[1] - all[0]
                : niceStep((max - min) / PANE_TICK_TARGET),
    };
}

/**
 * 범례 글자들의 x 좌표. 패널 이름 오른쪽에서 시작해 앞 글자 폭 + 간격만큼씩 이어 놓는다.
 * 폭은 글자 수로 어림한다(`estimateLabelWidth`).
 */
export function legendPositions(
    paneLabel: string,
    legendLabels: readonly string[],
    left: number,
    fontSize: number
): number[] {
    const start =
        left +
        PANE_LABEL_INSET +
        estimateLabelWidth(paneLabel, fontSize) +
        LEGEND_GAP;
    return legendLabels.reduce<number[]>(
        (xs, _label, index) =>
            index === 0
                ? [start]
                : [
                      ...xs,
                      xs[index - 1] +
                          estimateLabelWidth(
                              legendLabels[index - 1],
                              fontSize
                          ) +
                          LEGEND_GAP,
                  ],
        []
    );
}
