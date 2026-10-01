import type { Locale } from '@/shared/i18n/locales';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/** `ImageResponse`의 `fonts` 항목 하나. */
export interface OgFont {
    name: string;
    data: ArrayBuffer;
    style: 'normal';
    weight: 700;
}

interface OgFontSource {
    name: string;
    url: string;
}

const PRETENDARD: OgFontSource = {
    name: 'Pretendard',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-bold.otf',
};

/**
 * next/og의 `ImageResponse`는 Latin 폴백만 내장한다 → 로케일 문자를 담은 폰트를
 * CDN에서 가져온다. Pretendard는 한글·영문만 있어 ja 라벨(`チャート分析`)·zh 라벨이
 * 빈 네모로 나왔다 — ja/zh는 Noto Sans 해당 문자 서브셋을 쓴다.
 *
 * WOFF인 이유: Satori는 WOFF2를 못 읽고, TTF(일본어 2.3MB)는 Next 데이터 캐시의
 * 항목당 2MB 한도를 넘어 매 요청 다시 받는다. WOFF는 1.4·1.6MB.
 * 버전을 고정한다 — `@latest`는 서브셋 파일명이 바뀌면 조용히 404가 난다.
 */
const OG_FONT_BY_LOCALE: Record<Locale, OgFontSource> = {
    ko: PRETENDARD,
    en: PRETENDARD,
    ja: {
        name: 'Noto Sans JP',
        url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.3.0/files/noto-sans-jp-japanese-700-normal.woff',
    },
    zh: {
        name: 'Noto Sans SC',
        url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.0/files/noto-sans-sc-chinese-simplified-700-normal.woff',
    },
};

const FONT_REVALIDATE_SECONDS = 7 * SECONDS_PER_DAY;

/** 로케일 OG 폰트. 네트워크 실패는 `null` — 이미지는 Latin 폴백으로 그려진다. */
export async function loadOgFont(locale: Locale): Promise<OgFont | null> {
    const { name, url } = OG_FONT_BY_LOCALE[locale];
    try {
        const res = await fetch(url, {
            next: { revalidate: FONT_REVALIDATE_SECONDS },
        });
        if (!res.ok) return null;
        return {
            name,
            data: await res.arrayBuffer(),
            style: 'normal',
            weight: 700,
        };
    } catch {
        return null;
    }
}
