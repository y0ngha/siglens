import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import type { ChatChartBlock, ChatChartTimeframe } from '../types';

// 값 목록을 core에서 가져오지 않는다 — 클라이언트(채팅 화면)가 이 파일을 값으로 쓰므로, core를 값으로 import하면 core
// 번들 전체가 실린다. 두 목록이 core·레지스트리와 같은지는 테스트(`chartBlock.test.ts`)가 확인한다.

/** core `AGENT_BARS_TIMEFRAMES`와 같은 목록. */
export const CHAT_CHART_TIMEFRAMES: readonly ChatChartTimeframe[] = [
    '5Min',
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
    '1Day',
    '1Week',
    '1Month',
];

/** 시장 프로필 레지스트리의 id 목록. */
export const CHAT_CHART_MARKET_PROFILES: readonly MarketProfileId[] = [
    'us-equity',
    'crypto',
    'kr-equity',
];

const isOneOf = <T extends string>(
    list: readonly T[],
    value: unknown
): value is T => list.some(item => item === value);

/**
 * 저장된 행·SSE 프레임에서 읽은 값이 그릴 수 있는 차트 블록인지 — 모양과 함께 주기·시장이 아는 값인지도 본다(이름이
 * 바뀐 뒤 읽힌 옛 행이 모르는 값으로 차트에 가지 않게). 아니면 그리지 않는다.
 */
export function isChatChartBlock(value: unknown): value is ChatChartBlock {
    if (typeof value !== 'object' || value === null) return false;
    // 바로 위에서 null 아닌 객체임을 확인했다 — 필드를 하나씩 검사하려고 키로 읽을 수 있는 모양으로 본다.
    const v = value as Record<string, unknown>;
    return (
        v.version === 1 &&
        typeof v.symbol === 'string' &&
        isOneOf(CHAT_CHART_TIMEFRAMES, v.timeframe) &&
        isOneOf(CHAT_CHART_MARKET_PROFILES, v.marketProfile) &&
        Array.isArray(v.bars) &&
        v.bars.length > 0 &&
        Array.isArray(v.overlays) &&
        typeof v.overlayColors === 'object' &&
        v.overlayColors !== null &&
        typeof v.overlayLabels === 'object' &&
        v.overlayLabels !== null
    );
}
