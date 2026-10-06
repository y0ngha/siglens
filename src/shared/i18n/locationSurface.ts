import { isAiHost } from '@/shared/config/aiHost';
import {
    DEFAULT_LOCALE,
    splitLocalePath,
    type Locale,
} from '@/shared/i18n/locales';

export interface LocationSurface {
    readonly locale: Locale;
    /** `ai.siglens.io`(SiglensAI) 호스트의 URL인가. 아니면 메인 사이트다. */
    readonly onAiHost: boolean;
}

/** 서버가 그리는 기본 표면 — 한국어 · 메인 호스트. 하이드레이션 전 클라이언트도 같은 값이다. */
export const DEFAULT_LOCATION_SURFACE: LocationSurface = {
    locale: DEFAULT_LOCALE,
    onAiHost: false,
};

/**
 * 브라우저 주소(`hostname`·`pathname`)에서 **로케일과 호스트**를 판정한다 — 루트
 * `not-found.tsx`의 클라이언트 섬용이다.
 *
 * 루트 404는 정적이어야 한다(요청 헤더를 읽으면 모든 ISR 페이지가 동적으로 바뀐다 —
 * `src/app/not-found.tsx` JSDoc). 그래서 서버는 한국어·메인 호스트 한 벌만 그리고,
 * 실제 로케일·호스트는 마운트 뒤에 주소로 알아낸다. 로케일은 첫 경로 세그먼트가 지원
 * 로케일일 때만 읽는다(`/en/foo/bar` → en). 접두사가 없거나 모르는 값이면 한국어다.
 */
export function resolveLocationSurface(
    hostname: string,
    pathname: string
): LocationSurface {
    return {
        locale: splitLocalePath(pathname).locale,
        onAiHost: isAiHost(hostname),
    };
}
