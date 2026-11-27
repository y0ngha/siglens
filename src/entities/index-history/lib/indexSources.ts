import type { AgentHistoryIndex } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

/** 에이전트가 읽는 주가 지수 하나의 출처. 월말 이력(`loadIndexMonthEnds`)과 일봉 종가(`loadPriceStatsCloses`)가 같은 값을 쓴다. */
export interface IndexSource {
    provider: 'fmp' | 'yahoo';
    symbol: string;
    /** 결과에 찍는 지수 이름. */
    name: string;
    /** 이력의 실제 첫 달(실측 2026-11-16). 받은 이력이 여기서 시작하지 않으면 잘린 응답으로 본다. */
    firstMonth: string;
    /** 거래소 시간대 — 월 경계와 "진행 중인 달"을 이 시간대 달력으로 정한다. */
    timeZone: string;
    /** 이 지수가 거래되는 시장의 프로필. 세션(마감 시각·휴장일)을 이것으로 고른다. */
    profile: MarketProfileId;
    /** 미국 대통령 임기 주기 통계를 낼 지수인가. */
    usCycle: boolean;
}

export const INDEX_SOURCES: Readonly<Record<AgentHistoryIndex, IndexSource>> = {
    sp500: {
        provider: 'fmp',
        symbol: '^GSPC',
        name: 'S&P 500',
        firstMonth: '1950-01',
        timeZone: 'America/New_York',
        profile: 'us-equity',
        usCycle: true,
    },
    nasdaq: {
        provider: 'fmp',
        symbol: '^IXIC',
        name: 'Nasdaq Composite',
        firstMonth: '1971-02',
        timeZone: 'America/New_York',
        profile: 'us-equity',
        usCycle: true,
    },
    // FMP는 KOSPI·KOSDAQ에 402·빈 응답이다. Yahoo.
    kospi: {
        provider: 'yahoo',
        symbol: '^KS11',
        name: 'KOSPI',
        firstMonth: '1996-12',
        timeZone: 'Asia/Seoul',
        profile: 'kr-equity',
        usCycle: false,
    },
    kosdaq: {
        provider: 'yahoo',
        symbol: '^KQ11',
        name: 'KOSDAQ',
        firstMonth: '2000-10',
        timeZone: 'Asia/Seoul',
        profile: 'kr-equity',
        usCycle: false,
    },
};
