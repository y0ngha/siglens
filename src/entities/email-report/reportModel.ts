import type { NewsSentiment, Trend } from '@y0ngha/siglens-core';

/**
 * 메일 한 통에 들어가는 종목 한 칸의 데이터. 회원과 무관하게 `(symbol, locale)`마다
 * 한 번 만들어 같은 종목을 가진 회원들이 나눠 쓴다.
 *
 * **매매 지시성 수치(진입가·손절가·목표가)는 담지 않는다.** 분석 소스가 무료 등급으로
 * 걸러진 스냅샷이라 애초에 없지만, 메일은 정보 제공에 그쳐야 하므로 이 타입에도 자리를
 * 만들지 않는다.
 */
export interface SymbolReport {
    symbol: string;
    /** 기술적 분석 요약(전문가 문체). 스냅샷이 없거나 오래됐으면 `null`. */
    technical: {
        summary: string;
        trend: Trend | null;
        /** 감지된 차트 패턴 설명(최대 {@link REPORT_MAX_PATTERNS}개). */
        patterns: string[];
    } | null;
    /** 쉽게보기 산문. 없으면 `null`. */
    plain: string | null;
    news: SymbolReportNews[];
    options: SymbolReportOptions | null;
    /** 분석 스냅샷이 만들어진 시각(ISO). 분석이 없으면 `null`. */
    analyzedAt: string | null;
}

export interface SymbolReportNews {
    title: string;
    /** AI 카드 요약. 분석 전 기사면 `null`. */
    summary: string | null;
    sentiment: NewsSentiment | null;
    url: string;
    source: string;
    publishedAt: string;
}

export interface SymbolReportOptions {
    expirationDate: string;
    /** 미결제약정 기준 풋/콜 비율. */
    putCallRatio: number | null;
    /** ATM 내재변동성(분수, 0.28 = 28%). */
    atmImpliedVolatility: number | null;
    /** 만기까지 시장이 내포한 변동폭(±%). */
    impliedMovePercent: number | null;
    /** 옵션 AI 분석 요약. 스냅샷이 없으면 `null`. */
    summary: string | null;
}

export const REPORT_MAX_PATTERNS = 2;
export const REPORT_MAX_NEWS = 3;
