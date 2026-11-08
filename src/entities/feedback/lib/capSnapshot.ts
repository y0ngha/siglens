import { SNAPSHOT_MAX_BYTES } from './constants';

/**
 * `feedback.snapshot` 컬럼에 저장되는 모양. 크기 상한을 넘겨 문자열을 잘랐는지
 * 읽는 쪽이 알 수 있도록 **항상** 이 래퍼로 저장한다(잘리지 않았어도).
 *
 * - `truncated: false` — `value`는 클라이언트가 보낸 원본(JSON 왕복을 거친 값)
 * - `truncated: true` — `value`의 긴 문자열이 `…`로 잘렸거나, 문자열을 잘라도
 *   상한에 못 맞추는 구조(숫자 배열 등)라 `value`가 `null`이다
 */
export interface CappedSnapshot {
    readonly truncated: boolean;
    readonly value: unknown;
}

/** 절단 후에도 남기는 문자열 최소 길이. 이보다 짧은 문자열은 더 줄이지 않는다. */
const MIN_KEEP_CHARS = 32;
const ELLIPSIS = '…';
/** 절단-재측정 반복 상한. 다바이트 문자는 한 번에 덜 줄어 몇 번 더 돌 수 있다. */
const MAX_ROUNDS = 64;

const encoder = new TextEncoder();

function byteLength(json: string): number {
    return encoder.encode(json).byteLength;
}

interface StringSlot {
    readonly container: Record<string, unknown> | unknown[];
    readonly key: string | number;
    length: number;
}

/** 값 트리의 문자열 잎(객체 값·배열 원소)을 수집한다. 키 이름은 건드리지 않는다. */
function collectStringSlots(root: unknown): StringSlot[] {
    // CP-6 예외: 수백 KB 트리를 재귀로 훑으며 단계마다 배열을 펼쳐 합치면 잎 수만큼 복사가 겹친다(O(N²)). 지역 누산기 하나로 O(N)을 유지한다.
    const slots: StringSlot[] = [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach((child, index) => {
                if (typeof child === 'string') {
                    slots.push({
                        container: node,
                        key: index,
                        length: child.length,
                    });
                } else walk(child);
            });
        } else if (node !== null && typeof node === 'object') {
            const record = node as Record<string, unknown>;
            for (const key of Object.keys(record)) {
                const child = record[key];
                if (typeof child === 'string') {
                    slots.push({
                        container: record,
                        key,
                        length: child.length,
                    });
                } else walk(child);
            }
        }
    };
    walk(root);
    return slots;
}

/** 서로게이트 쌍 중간에서 끊기지 않게 `limit` 글자로 자르고 말줄임표를 붙인다. */
function truncateString(value: string, limit: number): string {
    let end = Math.max(0, limit - ELLIPSIS.length);
    const last = value.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    return value.slice(0, end) + ELLIPSIS;
}

/**
 * 가장 긴 문자열부터 같은 길이 상한(L)으로 깎아 `excess` 바이트 이상을 줄일 상한 L을 구한다.
 * 모든 문자열이 1바이트라고 가정한 글자 수 기준이라 다바이트 문자에서는 덜 줄 수 있고,
 * 호출부가 다시 측정해 반복한다.
 */
function findCharLimit(lengths: readonly number[], excess: number): number {
    const sorted = [...lengths].sort((a, b) => b - a);
    let cut = 0;
    for (let i = 0; i < sorted.length; i += 1) {
        const next = sorted[i + 1] ?? MIN_KEEP_CHARS;
        const floor = Math.max(next, MIN_KEEP_CHARS);
        const gain = (sorted[i]! - floor) * (i + 1);
        if (cut + gain >= excess) {
            return sorted[i]! - Math.ceil((excess - cut) / (i + 1));
        }
        cut += gain;
    }
    return MIN_KEEP_CHARS;
}

/**
 * 스냅샷을 JSON으로 직렬화했을 때 UTF-8 `maxBytes`를 넘으면 긴 문자열부터 줄여 상한에 맞춘다.
 *
 * 가장 긴 문자열을 먼저, 같은 길이 상한으로 깎는다(짧은 문자열은 그대로). 한 필드가 전부
 * 흡수하지 않아 결과 원문·대화 기록의 앞부분이 골고루 남는다. 직렬화가 불가능하면
 * (`undefined`, 순환 등) `null`로 저장하고 `truncated: true`를 표시한다.
 */
export function capSnapshot(
    input: unknown,
    maxBytes: number = SNAPSHOT_MAX_BYTES
): CappedSnapshot {
    let json: string | undefined;
    try {
        json = JSON.stringify(input);
    } catch {
        return { truncated: true, value: null };
    }
    if (json === undefined) return { truncated: true, value: null };
    if (byteLength(json) <= maxBytes) {
        return { truncated: false, value: JSON.parse(json) as unknown };
    }

    const tree = JSON.parse(json) as unknown;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const size = byteLength(JSON.stringify(tree));
        if (size <= maxBytes) return { truncated: true, value: tree };

        const slots = collectStringSlots(tree).filter(
            slot => slot.length > MIN_KEEP_CHARS
        );
        if (slots.length === 0) break;
        const limit = findCharLimit(
            slots.map(slot => slot.length),
            size - maxBytes
        );
        // CP-6 예외: `tree`는 위에서 JSON.parse로 만든 이 함수 전용 사본이다. 최대 64회 반복마다
        // 수백 KB 트리를 불변으로 다시 짓는 대신 잎을 제자리에서 줄인다(호출자 입력은 건드리지 않는다).
        for (const slot of slots) {
            if (slot.length <= limit) continue;
            const current = (
                slot.container as Record<string | number, unknown>
            )[slot.key] as string;
            const next = truncateString(current, limit);
            (slot.container as Record<string | number, unknown>)[slot.key] =
                next;
            slot.length = next.length;
        }
    }
    return { truncated: true, value: null };
}
