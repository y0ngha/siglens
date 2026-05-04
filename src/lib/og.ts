/**
 * Shared helpers for dynamic OG image routes (`opengraph-image.tsx`).
 *
 * `ImageResponse` (next/og) ships with Latin-only fallback fonts. To render
 * Korean labels (e.g. "차트 분석") we fetch a Korean-capable font and pass it
 * through the `fonts` option. Pretendard is a free, well-distributed Korean
 * font with strong Latin metrics — a single weight covers ticker + label.
 *
 * Network failures are swallowed (returns `null`) so OG generation degrades
 * gracefully to Latin-only rendering rather than throwing during build.
 */
const PRETENDARD_BOLD_URL =
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-bold.otf';

export async function loadKoreanFont(): Promise<ArrayBuffer | null> {
    try {
        const res = await fetch(PRETENDARD_BOLD_URL, {
            // OG generation runs at request time; cache the font aggressively.
            next: { revalidate: 60 * 60 * 24 * 7 },
        });
        if (!res.ok) return null;
        return await res.arrayBuffer();
    } catch {
        return null;
    }
}

export const OG_BG = '#0f172a';
export const OG_FG = '#ffffff';
export const OG_ACCENT = '#3b82f6';
export const OG_MUTED = '#94a3b8';
