import { FEEDBACK_DOWN_REASONS } from '../types';
import { DIGEST_MAX_DOWNS } from './constants';
import type { FeedbackDigestRow } from './types';

/** 표면·분석 종류별 👍/👎 집계 한 줄. */
export interface FeedbackDigestGroup {
    readonly surface: string;
    /** 분석 종류 또는 `agent_message`. 비어 있으면 `unknown`. */
    readonly target: string;
    readonly up: number;
    readonly down: number;
}

/** 👎 한 건의 요약. */
export interface FeedbackDigestDown {
    readonly surface: string;
    readonly target: string;
    readonly symbol: string | null;
    readonly reasons: readonly string[];
    readonly comment: string | null;
}

export interface FeedbackDigest {
    readonly total: number;
    readonly up: number;
    readonly down: number;
    readonly groups: readonly FeedbackDigestGroup[];
    /** 최신순 👎 목록, 최대 {@link DIGEST_MAX_DOWNS}건. */
    readonly downs: readonly FeedbackDigestDown[];
    /** 상한 때문에 목록에서 빠진 👎 수. */
    readonly omittedDowns: number;
}

/** 집계 중에만 쓰는 변경 가능한 그룹. 결과로 내보낼 때는 readonly로 노출된다. */
interface MutableGroup {
    surface: string;
    target: string;
    up: number;
    down: number;
}

const KNOWN_REASONS: readonly string[] = FEEDBACK_DOWN_REASONS;

/** 저장된 `reasons`(jsonb)에서 알려진 사유 코드만 꺼낸다. 형태가 어긋난 값은 버린다. */
function readReasons(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (item): item is string =>
            typeof item === 'string' && KNOWN_REASONS.includes(item)
    );
}

/**
 * 일일 요약용 집계. 입력은 최신순 👍/👎 행이다(`listAiFeedbackSince`). 투표 방향이
 * `up`/`down`이 아닌 행은 집계에서 뺀다. 그룹은 👎 많은 순 → 표면 → 종류 순으로 정렬한다.
 */
export function buildFeedbackDigest(
    rows: readonly FeedbackDigestRow[]
): FeedbackDigest {
    const groupMap = new Map<string, MutableGroup>();
    const allDowns: FeedbackDigestDown[] = [];
    let up = 0;
    let down = 0;

    for (const row of rows) {
        if (row.vote !== 'up' && row.vote !== 'down') continue;
        const target = row.targetType ?? 'unknown';
        const key = `${row.surface}\u0000${target}`;
        const group = groupMap.get(key) ?? {
            surface: row.surface,
            target,
            up: 0,
            down: 0,
        };
        if (row.vote === 'up') {
            group.up += 1;
            up += 1;
        } else {
            group.down += 1;
            down += 1;
            allDowns.push({
                surface: row.surface,
                target,
                symbol: row.symbol,
                reasons: readReasons(row.reasons),
                comment: row.comment,
            });
        }
        groupMap.set(key, group);
    }

    const groups = [...groupMap.values()].sort(
        (a, b) =>
            b.down - a.down ||
            a.surface.localeCompare(b.surface) ||
            a.target.localeCompare(b.target)
    );
    return {
        total: up + down,
        up,
        down,
        groups,
        downs: allDowns.slice(0, DIGEST_MAX_DOWNS),
        omittedDowns: Math.max(0, allDowns.length - DIGEST_MAX_DOWNS),
    };
}
