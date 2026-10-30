import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';

import {
    isProseGatedSitemapTab,
    snapshotKey,
    type BuildPopularEntriesOptions,
} from './proseGate';

/**
 * `unstable_cache`가 반환값을 JSON으로 직렬화하므로 `Date`는 캐시를 거치면 ISO
 * 문자열로 돌아온다. `Map`도 JSON에서 `{}`로 깨지므로 `[키, ISO]` 쌍 배열로 넘긴다.
 */
export interface SerializedPopularSitemapInputs {
    readonly snapshotGeneratedAt: ReadonlyArray<readonly [string, string]>;
}

/** `listFreshSymbolTabs`가 돌려주는 행 중 이 모듈이 읽는 필드. */
export interface FreshSnapshotRow {
    readonly symbol: string;
    readonly tab: SeoSnapshotTab;
    readonly generatedAt: Date;
    readonly hasProse: boolean;
}

/**
 * 신선한 스냅샷 행을 캐시 가능한 쌍 배열로 만든다. 렌더 가능한 산문이 없는 행은
 * 넣지 않는다 — 키가 곧 "페이지가 색인 대상"이다(산문 게이트와 같은 판정).
 */
export function serializePopularSitemapInputs(
    rows: readonly FreshSnapshotRow[]
): SerializedPopularSitemapInputs {
    return {
        snapshotGeneratedAt: rows.flatMap(row =>
            row.hasProse && isProseGatedSitemapTab(row.tab)
                ? [
                      [
                          snapshotKey(row.symbol, row.tab),
                          row.generatedAt.toISOString(),
                      ] as const,
                  ]
                : []
        ),
    };
}

/**
 * 캐시 경계 너머에서 쌍 배열을 `Map<string, Date>`로 복원한다. 복원하지 않으면 빌더가
 * 문자열에 `.getTime()`을 불러 죽는다.
 */
export function deserializePopularSitemapInputs(
    serialized: SerializedPopularSitemapInputs
): BuildPopularEntriesOptions {
    return {
        snapshotGeneratedAt: new Map(
            serialized.snapshotGeneratedAt.map(
                ([key, iso]) => [key, new Date(iso)] as const
            )
        ),
    };
}
