import { describe, expect, it } from 'vitest';
import { AGENT_BARS_TIMEFRAMES } from '@y0ngha/siglens-core';
import {
    CHAT_CHART_MARKET_PROFILES,
    CHAT_CHART_TIMEFRAMES,
    isChatChartBlock,
} from '@/entities/chat-conversation/lib/chartBlock';
import { getDescriptor } from '@/shared/config/marketProfile/registry';

const block = {
    version: 1,
    symbol: 'QQQ',
    timeframe: '1Day',
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
    analyzedAt: null,
};

describe('isChatChartBlock', () => {
    it('모양·주기·시장이 맞는 블록을 받는다', () => {
        expect(isChatChartBlock(block)).toBe(true);
    });

    it.each([
        ['다른 버전', { ...block, version: 2 }],
        ['모르는 주기', { ...block, timeframe: '2Day' }],
        ['모르는 시장', { ...block, marketProfile: 'jp-equity' }],
        ['빈 봉', { ...block, bars: [] }],
        ['작도 목록 없음', { ...block, overlays: undefined }],
        ['색 맵 없음', { ...block, overlayColors: null }],
        ['null', null],
    ])('%s은 받지 않는다', (_label, value) => {
        expect(isChatChartBlock(value)).toBe(false);
    });
});

describe('차트 블록 값 목록', () => {
    // 클라이언트가 core를 값으로 싣지 않으려고 목록을 옮겨 적었다 — 원본과 같아야 한다.
    it('주기 목록은 core AGENT_BARS_TIMEFRAMES와 같다', () => {
        expect([...CHAT_CHART_TIMEFRAMES]).toEqual([...AGENT_BARS_TIMEFRAMES]);
    });

    it('시장 목록은 모두 레지스트리에 있는 프로필이다', () => {
        for (const id of CHAT_CHART_MARKET_PROFILES)
            expect(getDescriptor(id)).toBeDefined();
        expect(CHAT_CHART_MARKET_PROFILES).toHaveLength(3);
    });
});
