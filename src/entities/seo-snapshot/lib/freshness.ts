import { US_EQUITY_SESSION, isRegularSessionOpen } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import type { SeoSnapshotTab } from '../model';
import { prewarmSessionSpecFor } from './applicability';

/** 30min — EOD 데이터 정착 대기 (spec §6). */
const SETTLE_BUFFER_MINUTES = 30;

/**
 * "가장 최근에 완료된 ET 정규장 마감" — 정착 버퍼 30분이 지난 것만 완료로 본다.
 *
 * 반장(13:00 ET)이면 그 날의 실제 마감을, NYSE 휴장일이면 직전 거래일 마감을 돌려준다.
 * 원래 spec §6은 휴장일 미보정을 "전 거래일과 동일 데이터로 1회 재생성이 일어날 뿐"이라며
 * 허용했지만, 실제로는 그 1회가 **전 코퍼스**(심볼×탭 ≈ 1,900유닛)의 LLM 재생성이다.
 * 주말은 경계가 금요일 마감에 고정돼 no-op인 반면, 휴장일은 평일이라 경계가 롤하면서
 * 전 심볼이 stale로 뒤집힌다. prewarm cron에는 요일 필터가 없어 연 9회 그대로 돈다.
 * 반장일에는 반대로 경계가 16:30 ET에야 롤해 prewarm 첫 세 시간이 헛돈다.
 */
export function lastCompletedEtCloseWithBuffer(now: Date): Date {
    return lastClosedSessionCloseUtc(
        US_EQUITY_SESSION,
        now,
        SETTLE_BUFFER_MINUTES
    );
}

/** "가장 최근에 완료된 KRX 정규장 마감(15:30 KST)" — 같은 정착 버퍼를 쓴다. */
export function lastCompletedKrCloseWithBuffer(now: Date): Date {
    return lastClosedSessionCloseUtc(
        KR_EQUITY_SESSION,
        now,
        SETTLE_BUFFER_MINUTES
    );
}

/**
 * 심볼이 속한 시장의 마감 경계를 고른다.
 *
 * 종전에는 전 심볼에 ET 경계 하나를 썼다. 국내 종목에는 두 방향으로 다 틀린다 —
 * KRX가 정상 개장한 미국 휴장일에는 경계가 롤하지 않아 하루 더 stale인 스냅샷이
 * fresh로 통과하고, 반대로 한국 공휴일에는 미국 마감을 따라 롤해서 바뀐 게 없는데도
 * 전 국내 종목을 다시 생성한다.
 *
 * 크립토는 ET 경계를 그대로 쓴다(spec §6 "크립토는 동일 일일 앵커 사용") — 24/7이라
 * 자기 마감이 없고, 하루 한 번 도는 앵커면 무엇이든 역할이 같다.
 */
export function snapshotCloseBoundaryFor(symbol: string, now: Date): Date {
    return isKrEquitySymbol(symbol)
        ? lastCompletedKrCloseWithBuffer(now)
        : lastCompletedEtCloseWithBuffer(now);
}

/**
 * 실적/의회거래처럼 분기 단위·불규칙 주기로만 바뀌는 탭 — 매일 재생성할 이유가 없다.
 *
 * (a) **왜 주 1회가 아니라 주 2회인가.** `SNAPSHOT_MAX_AGE_MS`(model.ts, 7일)는
 * 소비자가 둘이다 — 페이지 렌더 게이트(`getSnapshotStatic.ts`)와 **사이트맵 포함
 * 게이트**(`entities/sitemap-entry/server.ts`)다. `congress`는
 * `PROSE_GATED_SITEMAP_TABS`에 속해 있어서, 행이 7일을 넘기면 그 페이지가 noindex로
 * 빠지는 동시에 사이트맵에서도 URL이 빠진다. 주 1회(7일 주기)로 돌리면 행 나이가
 * 항상 그 절벽 바로 앞에 걸려, 배치 지연 한 번만으로도 수백 개 URL이 사이트맵을
 * 들락날락하게 된다 — 2026-09-17 운영 크롤 감사가 잡은 "사이트맵엔 있는데
 * noindex"(congress 108건, overall 49건) 결함과 정확히 같은 모양이다. 수/토 앵커는
 * 최대 간격을 4일로 묶어 여유를 남기고, `SNAPSHOT_MAX_AGE_MS`나 두 게이트 중
 * 어느 쪽도 건드릴 필요가 없다.
 *
 * (b) **알고 받아들인 한계.** `fundamental`/`financials`는 실적 발표 시점에
 * 바뀌므로, 이 주기에서는 발표 직후 최대 ~4일 묵은 수치를 낼 수 있다(기존엔
 * 최대 ~1일). 실적 발표를 트리거로 즉시 무효화하는 안을 검토했지만 보류했다 —
 * `earnings_reports` 테이블이 사용자가 그 심볼의 뉴스 탭을 방문할 때만 채워지는
 * on-demand 캐시라 커버리지가 불완전하고, 그 상태로 가드를 걸면 조용히 오작동한다.
 * 그 테이블이 전수 커버리지를 갖추면 재검토한다.
 *
 * 앵커 요일에 토요일을 넣은 것도 의도적이다 — 일별 마감 경계는 주말에 롤하지
 * 않아 prewarm cron이 어차피 그 시간대엔 한가하고, LLM 프로바이더가 주말 시간대를
 * 비피크 요금으로 매기기 때문에 그 창을 쓰는 편이 낫다.
 */
export const SLOW_REFRESH_TABS: ReadonlySet<SeoSnapshotTab> = new Set([
    'fundamental',
    'financials',
    'congress',
]);

/**
 * `now`(UTC) 시점에서 가장 최근에 지난(또는 지금인) 수요일 또는 토요일 00:00:00.000 UTC.
 *
 * 타임존 라이브러리 없이 `now.getUTCDay()`만으로 구한다 — 0=일 ~ 6=토.
 * 각 요일에서 가장 최근 수(3) 또는 토(6)까지 거슬러 올라갈 일수:
 * 일(0)→1(전날 토), 월(1)→2, 화(2)→3, 수(3)→0, 목(4)→1, 금(5)→2, 토(6)→0.
 */
function twiceWeeklyAnchorFor(now: Date): Date {
    const DAYS_BACK_TO_ANCHOR: readonly number[] = [1, 2, 3, 0, 1, 2, 0];
    const daysBack = DAYS_BACK_TO_ANCHOR[now.getUTCDay()];
    const anchor = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    anchor.setUTCDate(anchor.getUTCDate() - daysBack);
    return anchor;
}

/**
 * 탭별 신선도 경계. `SLOW_REFRESH_TABS`(fundamental/financials/congress)는 주 2회
 * 앵커를, 나머지는 기존 시장 마감 경계(`snapshotCloseBoundaryFor`)를 그대로 쓴다.
 *
 * ⚠️ **느린 탭은 시장과 무관하게 전 심볼이 같은 순간 한꺼번에 stale이 된다.**
 * 일별 경계는 심볼의 시장(US/KR)에 따라 어긋나 있어 stale 전환이 자연히 분산되지만,
 * 주 2회 앵커는 UTC 절대시각이라 수/토 00:00 UTC에 유니버스 전체가 동시에 넘어간다.
 * 이게 처리량 천장을 새로 만들지는 않는다 — technical/news/options/overall이 이미
 * 매일 밤 사실상 전 유니버스를 stale로 만들고 회전 커서가 그걸 커버하도록 설계돼
 * 있으므로, 느린 탭이 같은 밤에 합류해도 선별 대상 심볼 수는 그대로다(심볼당 탭
 * 수만 는다). 그래도 "수·토 밤 배치가 다른 밤보다 무겁다"는 건 사실이고, 배포 후
 * `[seo-prewarm] batch deadline reached`를 볼 때 요일을 함께 봐야 한다는 뜻이라
 * 여기 명시해 둔다.
 *
 * 다만 그 무거운 밤도 **이 변경 이전의 매일 밤과 같은 무게일 뿐** 더 무겁지는
 * 않다 — 세 탭이 원래 거래일마다 돌던 것이 주 2회로 줄어든 것이므로, 수·토는
 * 종전 수준이고 나머지 닷새가 가벼워진다. 수·토에 처리량 경보가 뜬다면 그건 이
 * 변경이 만든 새 천장이 아니라 원래 있던 천장이다.
 */
export function snapshotBoundaryFor(
    symbol: string,
    tab: SeoSnapshotTab,
    now: Date
): Date {
    return SLOW_REFRESH_TABS.has(tab)
        ? twiceWeeklyAnchorFor(now)
        : snapshotCloseBoundaryFor(symbol, now);
}

/**
 * 지금 그 심볼의 정규장이 열려 있으면 prewarm을 미룬다.
 *
 * prewarm 창은 **20:30~00:59 UTC + 04:05~05:55 UTC**(미국 마감 창) +
 * **10:05~12:55 UTC**(KR 마감 창, `kr-boundary`)로 나뉜다
 * (`docs/reference/CRON.md`. 2026-09 비용 감사로 DeepSeek peak 구간(평일
 * 01~04·06~10 UTC)을 비우기 전에는 20:30~03:59 + 07:00~09:55였다). 미국 마감 창의
 * **04:05~05:55 구간은 KRX 장중**이다(= 13:05~14:55 KST). 회전 오프셋은 Redis 영속
 * 커서에서 나온다(`runPrewarmBatch.ts`의 `advanceRotationCursor` 참고 — 2026-08
 * 감사 이전엔 epoch/tick 시각에서 파생했지만 지금은 그 시계와 무관하다). 그래도
 * 국내 종목이 미국 마감 창(위 두 시간이 KRX 장중과 겹침)의 어느 틱에 걸릴지는
 * 여전히 회전마다 달라질 수 있고, 장중에 걸린 틱에는 **형성 중인 일봉으로 만든
 * 서술**이 스냅샷에 굳어 다음 마감까지 봇에게 나간다 — 이 가드가 여전히 필요한 이유다.
 *
 * 미국 종목도 게이트에 걸리는 구간이 있다: cron이 UTC 고정이라 EST 기간(11~3월)에는
 * 창 시작 20:30 UTC가 NYSE 마감(21:00 UTC)보다 이르다. 그 30분은 실제로 장중이므로
 * 미루는 것이 맞다 — 그래서 `US_EQUITY_SESSION`을 예외 처리하지 않는다.
 *
 * **크립토는 절대 미루지 않는다.** `always-open`이라 한 번 걸리면 영영 처리되지 않는다.
 * 세션 스펙을 `prewarmSessionSpecFor`로 **3분기** 해석하는 이유가 이것이다 — KR/US
 * 2분기 ternary를 쓰면 크립토가 미국 주식으로 분류돼, 위 EST 30분 구간에서 매일 밤
 * 조용히 배치에서 빠진다.
 */
export function shouldDeferPrewarmWhileOpen(
    symbol: string,
    now: Date
): boolean {
    const spec = prewarmSessionSpecFor(symbol);
    return spec.kind === 'scheduled' && isRegularSessionOpen(spec, now);
}

/** 스냅샷 생성 시각이 최근 완료 마감 이후면 fresh. undefined(스냅샷 없음)면 stale. */
export function isSnapshotFresh(
    generatedAt: Date | undefined,
    closeBoundary: Date
): boolean {
    if (generatedAt === undefined) return false;
    return generatedAt.getTime() >= closeBoundary.getTime();
}
