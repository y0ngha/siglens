import { US_EQUITY_SESSION, isRegularSessionOpen } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
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
 * 지금 그 심볼의 정규장이 열려 있으면 prewarm을 미룬다.
 *
 * prewarm 창(20:30~03:59 UTC)의 뒤쪽 4시간은 **KRX 장중**이다(00:00~03:59 UTC =
 * 09:00~12:59 KST). 회전 오프셋이 epoch에서 나오므로 국내 종목이 어느 시간대 틱에
 * 걸릴지는 밤마다 달라지고, 장중에 걸린 밤에는 **형성 중인 일봉으로 만든 서술**이
 * 스냅샷에 굳어 다음 마감까지 봇에게 나간다.
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
