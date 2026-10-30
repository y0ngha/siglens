import type { Locale } from '@/shared/i18n/locales';

/** 로케일별 폰트 원본의 이름과 다운로드 URL. */
export interface OgFontSource {
    name: string;
    url: string;
}

const PRETENDARD: OgFontSource = {
    name: 'Pretendard',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-bold.otf',
};

/**
 * 로케일별 OG 폰트 원본 — `server/loadOgFont.ts`가 이 URL에서 바이트를 받는다.
 *
 * next/og의 `ImageResponse`는 Latin 폴백만 내장한다 → 로케일 문자를 담은 폰트를
 * CDN에서 가져온다. Pretendard는 한글·영문만 있어 ja 라벨(`チャート分析`)·zh 라벨이
 * 빈 네모로 나왔다 — ja/zh는 Noto Sans 해당 문자 서브셋을 쓴다.
 *
 * WOFF인 이유: Satori는 WOFF2를 못 읽는다. TTF(일본어 2.3MB)보다 작은 WOFF(1.4·1.6MB)를 쓴다.
 * 버전을 고정한다 — `@latest`는 서브셋 파일명이 바뀌면 조용히 404가 난다.
 * URL이 버전 고정이라 내용이 바뀌지 않으므로, 프로세스 수명 동안 한 번만 받으면 된다.
 */
export const OG_FONT_BY_LOCALE: Record<Locale, OgFontSource> = {
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
