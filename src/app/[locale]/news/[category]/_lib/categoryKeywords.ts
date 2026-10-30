import type { CategoryConfig } from '@/entities/market-news/lib/categoryConfig';
import type { NavRegionId } from '@/shared/config/assetClassNav';

/**
 * 지역별 추가 SEO 키워드(ko 전용 데이터). `미국 마켓 뉴스`는 옛 표기라, 기존 유입 질의를
 * 잃지 않으려고 미국 카테고리에만 남긴다.
 */
const REGION_KEYWORDS: Record<NavRegionId, readonly string[]> = {
    us: ['미국 시장 뉴스', '미국 마켓 뉴스'],
    kr: ['한국 증시 뉴스', '코스피 뉴스', '코스닥 뉴스'],
    crypto: ['암호화폐 뉴스', '비트코인 뉴스'],
};

/**
 * 색인되는 카테고리 페이지의 `keywords`. 라벨은 `koLabel`(ko 전용 키워드라 로케일 무관)이고,
 * 지역 키워드는 그 카테고리가 실제로 속한 지역만 붙인다 — 한국 증시 페이지에
 * `미국 시장 뉴스`를 넣으면 무관한 질의로 유입돼 이탈만 만든다.
 */
export function buildCategoryKeywords(cfg: CategoryConfig): string[] {
    return [
        `${cfg.koLabel} 뉴스`,
        `${cfg.koLabel} 최신 뉴스`,
        `${cfg.koLabel} 뉴스 분석`,
        ...REGION_KEYWORDS[cfg.region],
        '시장 뉴스 한국어',
        'AI 뉴스 다이제스트',
    ];
}
