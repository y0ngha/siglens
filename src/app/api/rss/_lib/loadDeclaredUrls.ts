import { loadStaticChildEntries } from '@/app/api/sitemap/_shared/childEntries';

/**
 * 정적 sitemap이 선언한 URL 집합 — RSS는 여기 실린 허브만 항목으로 낸다. 못 읽으면 `null`이고
 * 로그는 여기서 남긴다(호출부가 503으로 답한다).
 */
export async function loadDeclaredUrls(
    now: Date
): Promise<ReadonlySet<string> | null> {
    try {
        const entries = await loadStaticChildEntries(now);
        return new Set(entries.map(entry => entry.url));
    } catch (error) {
        console.error('[rss] static sitemap entries failed:', error);
        return null;
    }
}
