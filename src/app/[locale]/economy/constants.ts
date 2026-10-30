import { clampSeoDescription } from '@/shared/lib/seoClamp';
import { type SeoTranslator } from '@/shared/lib/seo';

/**
 * `/economy` 제목(브랜드 없음) — hero h1, metadata title, OG/Twitter title, JSON-LD `name`의 단일 소스.
 */
export function economyTitle(t: SeoTranslator): string {
    return t('economy.us.title');
}

/**
 * `/economy/kr` 제목(브랜드 없음) — hero h1, metadata title, OG/Twitter title, JSON-LD `name`의 단일 소스.
 */
export function economyKrTitle(t: SeoTranslator): string {
    return t('economy.kr.title');
}

/** `/economy` 설명 — metadata와 JSON-LD가 같은 길이 제한을 거친 문장을 쓰도록 한 곳에서 자른다. */
export function economyDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('economy.us.description'));
}

/** `/economy/kr` 설명 — metadata와 JSON-LD가 같은 길이 제한을 거친 문장을 쓰도록 한 곳에서 자른다. */
export function economyKrDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('economy.kr.description'));
}
