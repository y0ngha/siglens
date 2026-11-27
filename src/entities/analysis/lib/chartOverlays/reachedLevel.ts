/**
 * 현재가가 이미 지나간 목표 레벨인지 판정하는 유틸.
 */

import { OVERLAY_LEVEL_LABELS, type ChartOverlay } from '@y0ngha/siglens-core';
import {
    firstSegmentDirection,
    type SegmentDirection,
} from './chartOverlayUtils';
import { parseFibLevelLabel } from './fibLevelLabel';
import { elliottStructureOf } from './outcomeLevelLabel';

const TARGET_PREFIX = `${OVERLAY_LEVEL_LABELS.target} `;
/**
 * core 엘리어트 작도의 A파 선분 역할 — A–B–C의 C 목표와 삼각형 thrust 방향을 정한다.
 * core는 이 역할을 상수로 내보내지 않는다. 출처: `@y0ngha/siglens-core`
 * `domain/overlays/elliottCandidates.ts`·`elliottAbc.ts`·`elliottTriangle.ts`가
 * `legSegments`에 넘기는 `wave_${label}` 역할(A 다리 = `wave_A`).
 */
const WAVE_A_ROLE = 'wave_A';

const opposite = (d: SegmentDirection): SegmentDirection =>
    d === 'up' ? 'down' : 'up';

function waveADirection(
    overlay: Pick<ChartOverlay, 'segments'>
): SegmentDirection | null {
    const waveA = overlay.segments.find(s => s.role === WAVE_A_ROLE);
    return waveA === undefined ? null : firstSegmentDirection([waveA]);
}

/**
 * 목표처럼 "가격이 향해 가는" 레벨이면 그 방향, 아니면 `null`.
 *
 * - 엘리어트 비율 목표(`target 100%`, A–B–C의 C 투영): C는 A와 같은 방향으로 간다.
 * - 엘리어트 삼각형 목표(`target`): 삼각형을 빠져나가는 thrust는 A의 반대 방향이다.
 * - 피보나치 확장(`ext 127.2%`, `ABC 127.2%`): 다리(ABC는 A→B) 방향.
 *
 * 되돌림·무효화·돌파선은 목표가 아니라 `null`이다. 패턴 측정 목표는 core가 도달 즉시
 * 패턴을 빼므로(`isSpentPattern`) 화면에 지나간 채 남지 않아 다루지 않는다.
 */
export function targetDirectionOf(
    label: string,
    overlay: Pick<ChartOverlay, 'kind' | 'id' | 'segments'>
): SegmentDirection | null {
    if (overlay.kind === 'elliott') {
        const waveA = waveADirection(overlay);
        if (waveA === null) return null;
        if (label.startsWith(TARGET_PREFIX)) return waveA;
        if (
            label === OVERLAY_LEVEL_LABELS.target &&
            elliottStructureOf(overlay) === 'triangle'
        )
            return opposite(waveA);
        return null;
    }
    if (overlay.kind === 'fibonacci') {
        const fib = parseFibLevelLabel(label);
        return fib === null || fib.kind === 'retracement'
            ? null
            : firstSegmentDirection(overlay.segments);
    }
    return null;
}

/**
 * 현재가가 이미 지나간 목표선인가 — 상승 목표는 현재가가 그 위, 하락 목표는 그 아래.
 *
 * 지나간 목표를 "목표"라고 부르면 앞으로 갈 가격처럼 읽힌다. 지우면 "어디까지 왔는지"가
 * 사라지므로 차트는 이 선을 흐리게 그리고 라벨에 "도달"을 붙인다(2026-10-18 결정 —
 * 진행 중인 C가 100%를 넘은 뒤의 100% 선, 다리가 살아 있는 채 넘어선 피보 확장선).
 * 현재가를 모르면 `false`.
 */
export function isReachedTarget(
    level: { label: string; price: number },
    overlay: Pick<ChartOverlay, 'kind' | 'id' | 'segments'>,
    lastClose: number | null
): boolean {
    if (lastClose === null || !Number.isFinite(lastClose)) return false;
    const direction = targetDirectionOf(level.label, overlay);
    if (direction === null) return false;
    return direction === 'up'
        ? lastClose > level.price
        : lastClose < level.price;
}

/**
 * 위약 대비 우위가 확인되지 않은 패턴의 측정 목표선인가.
 *
 * 패턴 카드의 `baseRate`가 `beats_placebo`가 아니면(지금은 전부) 그 목표는 "닿을 가격"이
 * 아니라 측정된 거리일 뿐이다. 그래서 선은 지우지 않고 흐리게 그려 "참고 거리"로 읽히게
 * 한다(카드 본문이 같은 거리를 인용한다). 오버레이와 카드는 `sourceRef`로 이어지고, 판정
 * 자체(`isTargetReferenceOnly`)는 카드와 같은 함수를 쓰므로 호출부가 그 결과를 키 집합으로
 * 내려 준다. 엘리어트·피보나치의 `target` 선은 패턴 카드가 아니므로 대상이 아니다.
 */
export function isReferenceTarget(
    level: { label: string },
    overlay: Pick<ChartOverlay, 'kind' | 'sourceRef'>,
    referenceOnlyKeys: ReadonlySet<string>
): boolean {
    return (
        overlay.kind === 'pattern' &&
        level.label === OVERLAY_LEVEL_LABELS.target &&
        referenceOnlyKeys.has(overlay.sourceRef)
    );
}
