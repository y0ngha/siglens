import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import type { SignalEpisodeRow, SignalHistoryMarket } from '../types';
import { SIGNAL_HUB_WINDOW_DAYS } from './signalHubs';

/** 신호 페이지가 시장을 그리는 순서. 화면 섹션과 구조화데이터(ItemList) position이 함께 따른다. */
export const SIGNAL_HUB_MARKET_ORDER: readonly SignalHistoryMarket[] = [
    'us',
    'kr',
];

/**
 * 신호 페이지 기간의 시작 세션 날짜(포함). "최근 30일"은 오늘을 포함한 30일이라 29일 전부터다.
 * 기준 날짜는 KST다 — 서비스 독자의 "오늘"이고, 한국 세션 날짜와 같은 달력이다(미국 세션 날짜는
 * ET라 많아야 하루 어긋난다). 페이지·메타데이터·사이트맵이 같은 함수를 써서 경계가 갈리지 않는다.
 */
export function signalHubWindowStart(now: Date): string {
    return kstDateKeyDaysBefore(kstDateKey(now), SIGNAL_HUB_WINDOW_DAYS - 1);
}

/**
 * 종목마다 가장 최근 에피소드 하나만 남긴다(입력은 첫 포착 세션 최신순). 한 종목이 30일 안에 신호를
 * 두 번 잡으면 같은 이름·같은 링크가 두 줄이 되고, 색인 기준(행 수)도 부풀린다 — 화면·구조화데이터·
 * 색인 판정이 모두 이 결과를 쓴다. 시장이 다르면 다른 종목으로 본다.
 */
export function latestEpisodePerSymbol(
    rows: readonly SignalEpisodeRow[]
): SignalEpisodeRow[] {
    const seen = new Set<string>();
    return rows.filter(row => {
        const key = `${row.market}\u0000${row.symbol}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * 화면에 그리는 순서 — 미국 전부, 그다음 한국. 시장 안에서는 입력 순서(첫 포착 최신순)를 지킨다.
 * 구조화데이터(ItemList)의 position도 이 순서로 매겨 화면과 어긋나지 않게 한다.
 */
export function orderForDisplay(
    rows: readonly SignalEpisodeRow[]
): SignalEpisodeRow[] {
    return SIGNAL_HUB_MARKET_ORDER.flatMap(market =>
        rows.filter(row => row.market === market)
    );
}
