/** SEO 분석 스냅샷이 커버하는 탭 — spec 2026-07-24 §5. */
export const SEO_SNAPSHOT_TABS = [
    'technical',
    'overall',
    'fundamental',
    'financials',
    'congress',
    'news',
    'options',
] as const;

export type SeoSnapshotTab = (typeof SEO_SNAPSHOT_TABS)[number];

/** 심볼×탭당 last-known-good 1행. content는 core 정규화 타입드 결과 — 탭별 스키마 상이. 렌더러가 좁혀서 사용. */
export interface SeoAnalysisSnapshot {
    symbol: string;
    tab: SeoSnapshotTab;
    content: unknown;
    model: string;
    generatedAt: Date;
    updatedAt: Date;
}

/** pre-warm cron이 upsert 시 전달하는 입력 — id/updatedAt은 저장소가 채움. */
export interface SeoSnapshotUpsertInput {
    symbol: string;
    tab: SeoSnapshotTab;
    content: unknown;
    model: string;
    generatedAt: Date;
}
