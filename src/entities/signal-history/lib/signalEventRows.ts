import type {
    MarketSessionSpec,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import {
    lastClosedSessionDate,
    previousSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import type {
    SignalEpisodeInsert,
    SignalEpisodeKey,
    SignalEpisodePlan,
    SignalHistoryMarket,
} from '../types';

/**
 * 지금이 `market` 세션을 기록할 때인가 — 그렇다면 그 세션 날짜, 아니면 `null`.
 *
 * 조건: 지금 시각이 **그 시장의 마지막 세션이 마감 + `settleMinutes` 지난 뒤이고, 같은 현지 날짜**일 것.
 * - 장중·마감 직후(정착 전): 마지막 봉이 아직 움직인다 → `null`.
 * - 현지 자정을 넘긴 뒤: 그 세션은 앞 실행이 남겼고, 다음 세션의 장전 값과 섞이지 않게 → `null`.
 * - 24시간 시장(`always-open`): 마감이 없다 → `null`.
 *
 * 판정을 스캐너 결과의 계산 시각이 아니라 **지금 시각**으로 한다. 기록기는 이 판정이 통과한 뒤
 * 스캐너를 직접 계산하므로 계산 시각이 곧 지금이고, 캐시에 남은 옛 결과(마감 직후·지난 세션)를
 * 그날 세션으로 잘못 남길 길이 없다.
 */
export function recordableSessionDate(
    spec: MarketSessionSpec,
    now: Date,
    settleMinutes: number
): string | null {
    if (spec.kind === 'always-open') return null;
    const session = lastClosedSessionDate(spec, now, settleMinutes);
    return zonedDate(now, spec.timeZone) === session ? session : null;
}

/** 직전 거래 세션 — 에피소드가 "이어졌다"고 볼 마지막 포착 세션의 하한. */
export function continuationFloor(
    spec: MarketSessionSpec,
    sessionDate: string
): string {
    return previousSessionDate(spec, sessionDate);
}

function keyOf(key: SignalEpisodeKey): string {
    return `${key.symbol}\u0000${key.signalType}`;
}

/**
 * 스캐너 결과 → 이번 세션 기록 계획.
 *
 * **확정** 신호만 본다(예상 신호는 오지 않을 수도 있는 사건이다). (종목, 신호)마다 한 번만 센다 —
 * 스캐너가 같은 종목을 두 섹터에 실어도 한 번이다. `openKeys`(직전 세션 이후로 이어진 에피소드)에
 * 있으면 마지막 포착일만 늘리고(`extends`), 없으면 새 에피소드를 연다(`inserts`).
 */
export function planSignalEpisodes(input: {
    readonly result: SectorSignalsResult;
    readonly market: SignalHistoryMarket;
    readonly sessionDate: string;
    readonly openKeys: readonly SignalEpisodeKey[];
}): SignalEpisodePlan {
    const open = new Set(input.openKeys.map(keyOf));
    const confirmed = input.result.stocks.flatMap(stock =>
        stock.signals
            .filter(signal => signal.phase === 'confirmed')
            .map((signal): SignalEpisodeInsert => ({
                market: input.market,
                sessionDate: input.sessionDate,
                symbol: stock.symbol,
                signalType: signal.type,
                direction: signal.direction,
                changePercent: stock.changePercent,
                priceAtDetection:
                    Number.isFinite(stock.price) && stock.price > 0
                        ? stock.price
                        : null,
                koreanName: stock.koreanName === '' ? null : stock.koreanName,
                computedAt: input.result.computedAt,
            }))
    );
    // 키별 한 행으로 접는다. 같은 종목이 두 섹터에 실린 경우라 두 행의 값은 같다 — 어느 쪽을
    // 남겨도 되고, Map은 처음 넣은 키의 순서를 지킨다.
    const unique = [
        ...new Map(confirmed.map(row => [keyOf(row), row])).values(),
    ];
    return {
        inserts: unique.filter(row => !open.has(keyOf(row))),
        extends: unique
            .filter(row => open.has(keyOf(row)))
            .map(({ symbol, signalType }) => ({ symbol, signalType })),
    };
}
