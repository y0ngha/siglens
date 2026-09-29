import { isAdmissibleSymbolShape } from './ticker';
import { LOCALES } from '@/shared/i18n/locales';

/**
 * 첫 segment가 여기 있으면 ticker 케이스 정규화를 건너뛴다.
 *
 * **`src/app/`의 모든 정적 최상위 라우트 디렉터리가 빠짐없이 들어 있어야 한다.**
 * `isAdmissibleSymbolShape`은 하이픈 ticker(`PBR-A`)를 허용하므로 `fear-greed`
 * 같은 라우트명도 심볼 형상 검사를 통과해 `/FEAR-GREED`로 301되어 버린다 —
 * 라우트는 정적 세그먼트 우선이라 빌드에서는 정상으로 보이고, 프록시가 라우팅보다
 * 먼저 도는 런타임에서만 깨진다. 새 최상위 라우트를 추가하면 여기도 추가한다
 * (`src/app/__tests__/proxy.test.ts`가 디렉터리 목록과 대조해 강제한다).
 */
export const RESERVED_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
    // 로케일 접두사. `isAdmissibleSymbolShape('en')`은 참이라 여기 없으면
    // `/en`이 `/EN` 티커로 301된다. `ko`도 반드시 포함해야 한다 — `/ko`는 실존
    // 티커 `KO`(코카콜라)로 정규화되어 조용히 엉뚱한 페이지가 뜬다.
    ...LOCALES,
    'fear-greed',
    'login',
    'signup',
    'forgot-password',
    'reset-password',
    'account',
    'economy',
    'market',
    'news',
    // 종목 디렉터리. `isAdmissibleSymbolShape('symbols')`가 참이라 여기 없으면
    // `/SYMBOLS` 티커로 301된다 — 푸터가 전 라우트에서 그 링크를 내보내므로
    // 사이트 전체가 깨진 링크를 갖게 된다.
    'symbols',
    // 페이지 디렉터리는 삭제됐지만 위 레거시 리다이렉트의 대상 경로라 여전히
    // 예약해야 한다 — 없으면 `/onboarding`이 `/ONBOARDING`으로 대문자
    // 정규화되고, 그 경로는 [symbol] fallback을 타 404가 된다.
    'onboarding',
    'portfolio',
    'share',
    'backtesting',
    'terms',
    'privacy',
    'about',
    // 광고 랜딩(`src/app/lp/`, `[locale]` 밖의 별도 루트라 스캐너 테스트가 못 본다).
    // 여기 없으면 `/ko/lp/stock-analysis`가 `/LP/stock-analysis`로 301된다.
    'lp',
    'api',
    '_next',
]);

/**
 * 앱 경로(로케일 접두사 없음)가 가리키는 종목 — 종목 라우트가 아니면 null.
 * 프록시의 티커 판정과 같은 기준(예약 세그먼트 제외 + 심볼 형상)이다.
 */
export function symbolOfAppPath(path: string): string | null {
    const first = path.split(/[?#]/)[0]?.split('/')[1] ?? '';
    if (first === '' || RESERVED_FIRST_SEGMENTS.has(first.toLowerCase())) {
        return null;
    }
    return isAdmissibleSymbolShape(first) ? first.toUpperCase() : null;
}
