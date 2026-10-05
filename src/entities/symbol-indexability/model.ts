import type { Locale } from '@/shared/i18n/locales';
import type { AssetInfo } from '@/shared/lib/types';

/**
 * 이 탭의 AI 분석 산문이 **렌더 가능한 형태로 있는가**.
 *
 * - `present`: 이 탭의 스냅샷 행이 있고 `has*Prose`(렌더러와 같은 판정)를 통과한다.
 * - `absent`: 스냅샷을 정상적으로 읽었는데 이 탭에 렌더 가능한 산문이 없다(행 없음·
 *   내용이 렌더러 narrowing을 못 통과).
 * - `unknown`: 스냅샷 **읽기 자체가 실패했다**(`getSeoSnapshotsStatic`이 `null`). 모르는 것을
 *   "없음"으로 읽으면 DB가 한 번 흔들릴 때 산문이 멀쩡한 큐레이션 종목이 noindex로 굳는다 —
 *   색인 게이트는 fail-open이다.
 */
export type SnapshotProseState = 'present' | 'absent' | 'unknown';

export interface SymbolIndexabilityInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    hasSnapshot?: boolean;
    /**
     * 이 URL이 속한 로케일. **필수다** — 생략 가능하게 두면 호출부에서 빠져도
     * 컴파일이 통과하고, 그 순간 모든 로케일이 색인 대상이 된다(비-ko URL에
     * 한국어 본문이 담긴 채로). 실증: `overall/page.tsx`에서 `locale`만 빼도
     * 227개 테스트가 전부 통과했다.
     *
     * 본문(AI 분석 산문)이 아직 한국어로만 생성되므로, 준비되지 않은 로케일은
     * 다른 모든 조건을 만족해도 색인하지 않는다 — 영어 껍데기 안의 한국어 본문이
     * 색인되면 thin content로 취급된다.
     */
    locale: Locale;
    /**
     * 이 심볼에 가격 봉이 하나라도 있는가. **`false`면 화이트리스트 여부와
     * 무관하게 noindex**다.
     *
     * 화이트리스트 멤버십은 "색인할 가치가 있는 종목인가"만 답하고 "지금 이
     * 페이지에 콘텐츠가 있는가"는 답하지 않는다. 2026-08-24 프로덕션 전수
     * 조사에서 유니버스 431종 중 14종(ASSF·BSTG·CLAA·CTK·DIRV·DYFN·ENTF·
     * ESMT·GTS·HVBC·PSMC·SRYB·SWAR·TLIIX)이 봉이 전혀 없어 차트 페이지가
     * 제목 + sr-only 개요만 남은 **고유 330자짜리 껍데기**였는데, 전부
     * `index, follow`로 sitemap에 실려 있었다. 대부분 상장폐지·비상장 전환된
     * 티커다(`popular-tickers.ts`의 TODO가 예견한 케이스).
     *
     * 목록에서 곧바로 지우지 않고 런타임 신호로 판정하는 이유는 **양방향
     * 자가치유** 때문이다. 새로 상장폐지되는 종목은 자동으로 빠지고, 데이터
     * 공급이 일시 중단됐다 복구된 종목은 자동으로 돌아온다. 손으로 지우면
     * 후자가 영구히 사라진다.
     *
     * 단 이 게이트는 봉을 읽는 탭만 막는다 — `/fundamental`은 옛 프로필로 색인되고
     * sitemap과 프리웜은 목록을 따른다. 그래서 몇 주 지나도 돌아오지 않은 티커는
     * 목록에서 뺀다(2026-09-17, 위 14종 + SOI를 `popular-tickers.ts`에서 제거).
     *
     * 봉 유무를 볼 수 없는 라우트는 생략한다 — `undefined`면 기존 판정이
     * 그대로 유지된다(현재는 차트 라우트만 전달).
     */
    hasPriceData?: boolean;
    /**
     * 이 탭의 산문 보유 상태 — **차트(`technical`)·뉴스(`news`) 탭만** 넘긴다. 이 둘은
     * 종목 고유 텍스트가 AI 스냅샷 산문뿐이라(`SEO_RECOVERY_2026_09.md` §5 A3), 산문이 없으면
     * 남는 건 제목·크롬·수치 요약이라 thin 페이지다.
     *
     * `absent`면 화이트리스트와 무관하게 noindex(`no-prose`)다. 평가 순서는 degraded **다음**,
     * 화이트리스트 **앞**이다 — degraded는 스스로 스냅샷 유무를 보는 별도 규칙(
     * `degraded-with-snapshot`)을 갖고, 산문 게이트는 정상 렌더에서만 의미가 있다.
     * `unknown`은 게이트를 건너뛴다(fail-open). 생략하면(`undefined`) 그 탭은 산문 게이트가
     * 없다 — 기존 판정이 그대로 유지된다.
     *
     * sitemap(`PROSE_GATED_SITEMAP_TABS`)이 같은 판정(`hasProseForTab`)으로 URL을 싣거나
     * 빼므로, 페이지와 sitemap이 어긋나지 않는다(parity 테스트).
     */
    prose?: SnapshotProseState;
}

type SymbolIndexabilityReason =
    | 'popular'
    | 'curated-crypto'
    | 'approved-longtail'
    | 'invalid-symbol'
    | 'asset-missing'
    | 'no-price-data'
    | 'degraded'
    | 'degraded-with-snapshot'
    | 'no-prose'
    | 'longtail-default-blocked'
    | 'locale-not-ready';

export interface SymbolIndexabilityDecision {
    indexable: boolean;
    reason: SymbolIndexabilityReason;
}
