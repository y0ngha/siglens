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
