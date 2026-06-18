import { clampSeoDescription } from '@/shared/lib/seo';

/**
 * Single source for the category page title string.
 * Used by both `generateMetadata` and the JSON-LD WebPage block so that
 * metadata.title, og.title, and schema.org name are always identical.
 */
export function buildCategoryPageTitle(koLabel: string): string {
    return `${koLabel} 뉴스 — 최신 마켓 흐름과 AI 다이제스트`;
}

/**
 * Single source for the category page description.
 * `clampSeoDescription` is applied here so every consumer (metadata, JSON-LD)
 * receives the already-clamped form — no risk of differing truncation.
 */
export function buildCategoryPageDescription(koLabel: string): string {
    return clampSeoDescription(
        `${koLabel} 분야의 최신 뉴스를 한국어로 정리해 드려요. 각 기사의 호재·악재 분위기를 AI가 분석하고, 카테고리 전반의 흐름을 다이제스트로 요약해 드려요.`
    );
}
