import { MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';
import { STATIC_PAGE_PATHS, isGuideEntryPath } from './staticPagePaths';

/**
 * IndexNow 제출을 **얼마나 미룰지**의 표 — URL 종류별 지연.
 *
 * 검색엔진이 알림을 받고 가져가는 순간 페이지가 아직 옛 ISR 렌더를 서빙하면 알림이 헛수고다.
 * 태그 무효화(`revalidateTag(..., 'max')`)는 stale-while-revalidate라 **다음 요청이 재생성**을
 * 일으킨다 — 그 요청이 크롤러 자신일 수도 있다. 그래서 지연은 그 페이지의 `revalidate` 주기
 * 이상이어야 한다: 최악의 경우 한 주기 안에 누군가의 방문이 재생성을 끝내 둔다.
 *
 * **각 값은 해당 `page.tsx`의 `export const revalidate` 리터럴 이상이어야 한다** —
 * `__tests__/indexNowDelays.test.ts`가 파일에서 리터럴을 읽어 강제한다. 페이지 주기를
 * 늘리면서 여기를 못 따라가면 알림이 옛 렌더를 가리키게 된다.
 */
export type IndexNowRouteKind =
    | 'symbolChart'
    | 'symbolNews'
    | 'marketHub'
    | 'fearGreedHub'
    | 'newsCategory'
    | 'newsIndex'
    | 'economy'
    | 'staticPage';

export const INDEXNOW_DELAY_HOURS: Readonly<Record<IndexNowRouteKind, number>> =
    {
        symbolChart: 6,
        symbolNews: 12,
        marketHub: 6,
        fearGreedHub: 6,
        newsCategory: 12,
        newsIndex: 24,
        economy: 24,
        staticPage: 24,
    };

/** 페이지가 재생성을 끝냈을 것이라고 보는 데 더하는 여유. */
const SAFETY_MARGIN_MS = 15 * MS_PER_MINUTE;

const STATIC_PAGE_PATH_SET: ReadonlySet<string> = new Set(STATIC_PAGE_PATHS);

/** 주기 제출 대상이 아닌 경로 — 홈·`/symbols`는 본문이 상수라 배포로만 바뀐다. */
const NEVER_SUBMIT_PATHS: ReadonlySet<string> = new Set(['/', '/symbols']);

/**
 * URL의 종류. 주기 제출 대상이 아니면 `null`.
 *
 * `/{T}/fear-greed`는 대상이 아니다 — 프리웜이 굽지 않고 점수는 봉에서 나와 24시간 ISR로
 * 충분하다(종목마다 매일 알리면 제출량만 는다). 항상 noindex인 탭(`/overall` 등)도 대상이 아니다.
 */
export function classifyIndexNowUrl(url: string): IndexNowRouteKind | null {
    if (!URL.canParse(url)) return null;
    const path = new URL(url).pathname.replace(/\/$/, '') || '/';
    if (NEVER_SUBMIT_PATHS.has(path)) return null;
    if (STATIC_PAGE_PATH_SET.has(path) || isGuideEntryPath(path)) {
        return 'staticPage';
    }
    if (path === '/market' || path.startsWith('/market/')) return 'marketHub';
    if (path === '/economy' || path.startsWith('/economy/')) return 'economy';
    if (path === '/fear-greed' || path.startsWith('/fear-greed/')) {
        return 'fearGreedHub';
    }
    if (path === '/news' || path === '/news/us') return 'newsIndex';
    if (path.startsWith('/news/')) return 'newsCategory';

    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length === 1) return 'symbolChart';
    if (segments.length === 2 && segments[1] === 'news') return 'symbolNews';
    return null;
}

export interface IndexNowDelayOptions {
    /**
     * 크론이 이 페이지의 태그를 **직접** 무효화했는가.
     *
     * 직접 무효화했으면 다음 요청이 곧장 재생성하므로 한 주기면 된다. 그렇지 않으면(정적
     * 페이지, 본문 스탬프만 바뀐 허브) 변경이 일어난 시점이 ISR 창의 어디쯤인지 모른다 —
     * 창 하나를 더 기다려야 변경이 반영된 렌더가 나온다(2배).
     */
    readonly invalidatedByCron: boolean;
}

/**
 * 이 URL을 제출해도 되는 가장 이른 시각(epoch ms). 주기 제출 대상이 아니면 `null`.
 */
export function indexNowNotBeforeMs(
    url: string,
    nowMs: number,
    { invalidatedByCron }: IndexNowDelayOptions
): number | null {
    const kind = classifyIndexNowUrl(url);
    if (kind === null) return null;
    const periods = invalidatedByCron ? 1 : 2;
    return (
        nowMs +
        INDEXNOW_DELAY_HOURS[kind] * MS_PER_HOUR * periods +
        SAFETY_MARGIN_MS
    );
}
