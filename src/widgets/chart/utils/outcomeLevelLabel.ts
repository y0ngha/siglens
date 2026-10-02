import { OVERLAY_LEVEL_LABELS, type ChartOverlay } from '@y0ngha/siglens-core';

/** core 엘리어트 후보 id(`ew:<dir>:<time>:<구조>`)의 구조 — 무효화·목표선 이름에 붙인다. */
export type ElliottStructureName =
    | 'impulse'
    | 'triangle'
    | 'diagonal'
    | 'abc'
    | 'combination';

/**
 * 엘리어트 작도의 구조. core의 `ChartOverlay`는 구조 필드를 노출하지 않아 후보 id를 직접
 * 파싱한다 — id 꼴(`ew:<dir>:<time>:<구조>`)은 `@y0ngha/siglens-core` 엘리어트 후보가 정하며,
 * core가 꼴을 바꾸면 여기도 따라가야 한다. 모르는 꼴은 `null`이라 호출부가 종류만 쓴 문구로
 * 떨어진다. id 넷째 칸이 숫자(`:5`, `:6`, `:6:abc`)면 임펄스, 나머지는
 * core가 붙이는 접미사(`tri`·`diag`·`abc`·`combo`/`combo3`)로 가른다. 엘리어트가 아니거나
 * 모르는 꼴이면 `null`.
 */
export function elliottStructureOf(
    overlay: Pick<ChartOverlay, 'kind' | 'id'>
): ElliottStructureName | null {
    if (overlay.kind !== 'elliott') return null;
    const part = overlay.id.split(':')[3] ?? '';
    if (/^\d+$/.test(part)) return 'impulse';
    if (part === 'tri') return 'triangle';
    if (part === 'diag') return 'diagonal';
    if (part === 'abc') return 'abc';
    if (part.startsWith('combo')) return 'combination';
    return null;
}

/**
 * 무효화·목표·5파 상한 선의 화면 문구. `owner`는 어느 작도의 선인지(패턴 이름·엘리어트
 * 구조 이름) — 모르면 `undefined`로 받아 종류만 쓴다. 번역 함수는 호출부가 쥔다.
 */
export interface OutcomeLevelTexts {
    invalidation: (owner: string | undefined) => string;
    target: (owner: string | undefined) => string;
    wave5Cap: (owner: string | undefined) => string;
    elliottStructure: Readonly<Record<ElliottStructureName, string>>;
}

const TARGET_PREFIX = `${OVERLAY_LEVEL_LABELS.target} `;

/**
 * core 결과선 라벨(`invalidation`, `target`, `target 161.8%`, `wave5_cap`)이면 "이중천장
 * 무효화"·"삼각형 목표"처럼 주인 이름을 붙인 문구로, 아니면 `null`. 패턴은 카드 이름을,
 * 엘리어트는 구조 이름을 주인으로 쓴다 — 같은 카드 밑 주·대안 카운트가 서로 다른 구조일 수
 * 있어서다. 비율이 붙은 목표(A–B–C의 C 목표)는 A–B–C 이름에 비율을 그대로 뒤에 붙인다.
 */
export function formatOutcomeLevelLabel(
    label: string,
    overlay: Pick<ChartOverlay, 'kind' | 'id'>,
    cardName: string | undefined,
    texts: OutcomeLevelTexts
): string | null {
    const structure = elliottStructureOf(overlay);
    const owner =
        overlay.kind === 'elliott'
            ? structure === null
                ? undefined
                : texts.elliottStructure[structure]
            : cardName;
    if (label === OVERLAY_LEVEL_LABELS.invalidation)
        return texts.invalidation(owner);
    if (label === OVERLAY_LEVEL_LABELS.wave5Cap) return texts.wave5Cap(owner);
    if (label === OVERLAY_LEVEL_LABELS.target) return texts.target(owner);
    // 비율 목표는 늘 A–B–C의 C 투영이다 — 임펄스 뒤에 붙은 A–B–C여도 주인은 A–B–C.
    if (label.startsWith(TARGET_PREFIX))
        return `${texts.target(
            overlay.kind === 'elliott' ? texts.elliottStructure.abc : owner
        )} ${label.slice(TARGET_PREFIX.length)}`;
    return null;
}
