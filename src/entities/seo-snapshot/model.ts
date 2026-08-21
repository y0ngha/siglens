import type { Locale } from '@/shared/i18n/locales';
import { MS_PER_DAY } from '@/shared/config/time';

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

/**
 * FIX D(감사) — 읽기 경로(`getSeoSnapshotsStatic`)의 max-age 상한. cron이
 * 죽거나 배치가 며칠간 실패해도, 이 값보다 오래된 행은 "전일 장마감 기준"이라는
 * 캡션과 함께 서빙되지 않도록 필터링한다(정확성/E-E-A-T 리스크 — 금융 사이트에서
 * 몇 주 전 분석을 "어제 기준"이라 보여주는 건 이 SEO 회복 작업이 막으려는 바로
 * 그 문제다). 7일 = pre-warm cron이 하룻밤 전체 유니버스를 커버하는 데 걸리는
 * 시간(steady state, docs/reference/CRON.md 참고)의 여유 배수 — 정상 운영에선
 * 절대 걸리지 않고, cron이 최소 하루 이상 완전히 죽었을 때만 발동하는 방어선이다.
 */
export const SNAPSHOT_MAX_AGE_MS = 7 * MS_PER_DAY; // 7d

/** 심볼×탭당 last-known-good 1행. content는 core 정규화 타입드 결과 — 탭별 스키마 상이. 렌더러가 좁혀서 사용. */
export interface SeoAnalysisSnapshot {
    symbol: string;
    tab: SeoSnapshotTab;
    /** 본문이 생성된 언어. 마이그레이션 전 행은 전부 한국어다. */
    locale: Locale;
    content: unknown;
    model: string;
    generatedAt: Date;
    updatedAt: Date;
}

/** pre-warm cron이 upsert 시 전달하는 입력 — id/updatedAt은 저장소가 채움. */
export interface SeoSnapshotUpsertInput {
    symbol: string;
    tab: SeoSnapshotTab;
    /** 프리웜이 어느 언어로 생성했는지. */
    locale: Locale;
    content: unknown;
    model: string;
    generatedAt: Date;
}
