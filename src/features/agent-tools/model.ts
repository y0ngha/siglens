import type { ModelId, ToolExecutionContext } from '@y0ngha/siglens-core';
import type { ConversationAnalysis } from '@/entities/chat-conversation/server/conversationAnalyses';
import type { ChatBlock } from '@/entities/chat-conversation/types';

export interface ToolRuntime {
    /** Analysis model for cache keys/fresh runs — pilot: fixed to the agent model. */
    analysisModel: ModelId;
    /**
     * 심볼의 외부 데이터를 최신화한다(현재는 뉴스 적재).
     *
     * **툴이 직접 부른다** — 실행부가 일괄로 걸지 않는다. 기준은 "수급을 돌리면
     * **이번 호출의 답**이 달라지는가"인데, 그 판단은 툴 안에서만 가능하다.
     *
     * 현재 호출자는 `get_news`의 심볼 질의 하나뿐이다. `listCardsBySymbol`이
     * 미보강 행도 돌려주므로 방금 적재한 기사의 제목·발행일·링크가 그 턴에 바로
     * 보인다. 반대로 `run_fresh_analysis`는 부르지 않는다 — 분석 축은
     * `isEnrichedRow`가 미보강 행을 걸러내 방금 넣은 행이 한 건도 안 들어간다.
     * `get_cached_analysis`는 이미 생성된 결과를 peek할 뿐이라 아예 해당 없다.
     *
     * 호출 위치도 툴이 정한다. 값싼 거절(잘못된 인자, 슬롯 포화) **뒤에** 불러야
     * 그 거절이 FMP·DB 왕복을 지불하지 않는다.
     *
     * 턴당 심볼별 1회로 접히고, **절대 reject하지 않는다** — 수급 실패가 질문
     * 자체를 죽이면 안 된다.
     */
    ensureSymbolData: (symbol: string) => Promise<void>;
    /**
     * `false`면 도구는 비공식 외부 소스(공식 API·약관이 없는 엔드포인트, 현재는 네이버 증권 모바일 JSON)를 읽지 않는다.
     * 생략하면 허용(에이전트). 공개 API는 제3자 개발자에게 재배포하는 경로라 `false`다(`createToolExecutor` 옵션이 채운다).
     */
    allowUnofficialSources?: boolean;
    /**
     * `get_cached_analysis(tab: 'overall')`이 새 생성으로 이어질 결과(found:false·stale:true)일 때 같은 타임프레임의
     * 신선한 technical 분석으로 대체할지. 생략하면 대체한다(에이전트). 공개 API는 `tab`을 계약으로 받는 제3자 클라이언트라
     * 요청과 다른 탭을 돌려주면 안 되므로 `false`다(`createToolExecutor` 옵션이 채운다).
     */
    substituteFreshTechnicalForOverall?: boolean;
    /**
     * 이 호출의 결과와 함께 보여 줄 차트 블록을 넘긴다(기술 분석·봉 지표 도구). 블록은 모델에 가지 않는다 — 실행부가
     * `ToolExecutorOptions.onChart`로 스트림·저장에 넘긴다. 생략하면(공개 API·차트 없는 실행) 아무것도 하지 않는다.
     * 넘기는 promise는 절대 reject하지 않아야 한다(`loadAnalysisChartBlock`처럼 실패를 `null`로 접는다).
     */
    emitChart?: (pending: Promise<ChatBlock | null>) => void;
    /**
     * `get_bars_indicators`가 봉 수를 맞출 문자 수 상한. 실행기(`createToolExecutor`)가 자기 `resultCaps.bars`에서
     * `annotate`가 앞에 붙이는 몫(`BARS_ANNOTATE_HEADROOM_CHARS`)을 뺀 값으로 채운다 — 에이전트와 공개 API가 각자의 상한에
     * 맞춰 오래된 봉을 줄이고, 결과 전체가 `{ truncated, preview }`로 무너지지 않게 한다. 도구를 실행기 없이 직접 부르면
     * (테스트) 비어 있고, 그때는 에이전트 상한 `BARS_RESULT_MAX_CHARS`를 쓴다.
     */
    barsResultMaxChars?: number;
    /**
     * 이 대화의 **이전 턴**에 회원이 본 일봉 기술적 분석(종목마다 가장 나중 것, 최근에 본 순).
     * `get_cached_analysis`·`run_fresh_analysis`의 technical 1Day 결과가 이것과 비교해 `sinceEarlier` 블록을 싣는다.
     * 8턴 창이 오래된 도구 결과를 `omitted`로 보내므로 모델이 직접 볼 수 없는 숫자를 코드가 대신
     * 계산해 주는 길이다. 저장된 대화가 없으면(게스트·공개 API) 생략한다.
     */
    earlierAnalyses?: readonly ConversationAnalysis[];
}

/** 차트 블록을 낸 도구 호출 — core가 `tool_start`에 싣는 것과 같은 이름·인자(교정 전). */
export interface ChartToolCall {
    name: string;
    args: Record<string, unknown>;
}

/** Result-size ceilings (chars) the executor applies per tool class. */
export interface ToolResultCaps {
    /** Default for tools without a class of their own. */
    standard: number;
    /** `get_bars_indicators` (the tool fits its bar count to this cap minus `BARS_ANNOTATE_HEADROOM_CHARS`, via `ToolRuntime.barsResultMaxChars`). */
    bars: number;
    /** `get_market_overview`. */
    aggregate: number;
    /** `get_economy` (indicators + an up-to-80-event calendar). */
    economy: number;
    /** `get_investor_flows` (scorecard + capped holder, insider, Form 144 and offering lists). */
    investorFlows: number;
    guide: number;
    /** `get_macro_quotes` (up to 8 instruments, each with changes and a 52-week range). */
    macroQuotes: number;
    /** `get_company_filings` (a 10-filing list, or one filing's text up to `AGENT_FILING_TEXT_MAX_CHARS`). */
    companyFilings: number;
    /** `get_x_posts` (up to 12 posts of up to 600 characters, plus the account rows). */
    xPosts: number;
    /** `get_index_history_stats` (a year-by-year table since 1951 for the S&P 500). */
    indexHistory: number;
    /** `get_swing_history` (decline and rally summaries, size bands and up to 20 episodes each). */
    swingHistory: number;
    /** `get_price_stats` (up to 3 subjects × 5 date lookups, every note, 3 correlation pairs). */
    priceStats: number;
    /** `get_analyst_views` (up to 15 actions plus four estimate periods). */
    analystViews: number;
    /** `get_fundamentals` (every section filled plus the earnings tally). */
    fundamentals: number;
    /** `get_news` (up to 20 items with summaries plus the symbol price-move block; the tool fits itself under this). */
    news: number;
    /** `web_search` (five results plus up to two page excerpts of 1,800 characters). */
    webSearch: number;
    /** `get_my_watchlist` (up to 50 saved symbols with quotes, plus the active price alerts). */
    watchlist: number;
    /** One stored analysis (`get_cached_analysis` / `run_fresh_analysis`). */
    cachedAnalysis: number;
    /** Total analysis chars one executor instance may spend above `standard`. */
    cachedAnalysisBudget: number;
}

export type ToolExecutor = (
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    runtime: ToolRuntime
) => Promise<unknown>;
