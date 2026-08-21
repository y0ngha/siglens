import type { SeoTranslator } from '@/shared/lib/seo';

/**
 * economyTitle — page.tsx hero h1, metadata title, OG/Twitter title의 단일 source.
 */
export function economyTitle(t: SeoTranslator): string {
    return t('economy.us.title');
}

/**
 * economyKrTitle — `/economy/kr`의 hero h1, metadata title, OG/Twitter title의 단일 source.
 */
export function economyKrTitle(t: SeoTranslator): string {
    return t('economy.kr.title');
}
