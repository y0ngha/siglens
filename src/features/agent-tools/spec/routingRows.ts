import type { AgentRoutingRow } from '@y0ngha/siglens-core';
import {
    SWING_THRESHOLD_GUIDE,
    SWING_TRIGGER_EXAMPLES,
} from './getSwingHistory';
import { WATCHLIST_ALERT_ROUTING_ROWS } from './watchlistAlertTools';

/** 전망 줄이 가리키는 도구: 둘 다 있으면 함께, 하나만 있으면 그것, 없으면 빈 문자열(줄이 빠진다). */
function outlookTools(hasAnalysis: boolean, hasBars: boolean): string {
    if (hasAnalysis && hasBars)
        return 'get_cached_analysis and get_bars_indicators (timeframe 1Day unless the user names another) together';
    if (hasBars)
        return 'get_bars_indicators (timeframe 1Day unless the user names another)';
    if (hasAnalysis) return 'get_cached_analysis';
    return '';
}

/** 범위 밖 요청은 도구를 부르지 않는다. 표의 마지막 줄이라 새 줄은 모두 이 앞에 들어간다. */
const OUT_OF_SCOPE_ROW: AgentRoutingRow = {
    requires: [],
    text: 'Out-of-scope requests (code, homework, unrelated topics) → no tools.',
};

/**
 * 시스템 프롬프트의 도구 선택 표(질문 유형 → 도구). 줄은 이 순서로 렌더되고, `requires`의 도구가 이 턴에 모두
 * 있을 때만 나온다(core `buildAgentSystemPrompt`가 거른다). 도구별 세부(무엇을 돌려주는지, 인자)는 도구 설명에
 * 있고, 이 표는 어떤 질문에 어떤 도구(조합·제외 포함)가 필요한지만 정한다.
 *
 * 줄 하나를 고치는 것도 모델이 보는 프롬프트 변경이다: `AGENT_TOOLSET_VERSION`을 올리고
 * `__tests__/toolSetParity.test.ts`의 고정 해시를 다시 만든다.
 */
export const AGENT_ROUTING_ROWS: readonly AgentRoutingRow[] = [
    {
        requires: ['search_ticker'],
        text: 'The user names a company instead of a symbol (삼성전자, 엔비디아, Apple) → search_ticker first, even when you believe you know the ticker, then the rows below for the resolved symbol.',
    },
    {
        // Outlook questions want both tools, but either one alone still answers
        // them — so the row adapts instead of vanishing when only one is
        // available (a row that required both left those questions unrouted).
        requires: [],
        text: available => {
            const tools = outlookTools(
                available.has('get_cached_analysis'),
                available.has('get_bars_indicators')
            );
            // Buy/sell/hold-decision questions also need the flows tool
            // (measured: 0/4 called it from this row alone, while broad
            // "종합" asks did 12/12), so the pointer sits on the row the
            // model matches those questions to. Gated on the tool so the
            // row never names a tool the model cannot call.
            const flows = available.has('get_investor_flows')
                ? ' For a buy, sell or hold decision about a US or Korean stock (지금 사도 될까?, 매수해도 돼?, 팔아야 해?, 들고 가도 돼?, entry timing), also call get_investor_flows in the same step.'
                : '';
            return tools === ''
                ? ''
                : `Outlook, "how is it doing", "should I buy / is it a good time", rebound, top/bottom, trading-setup or "analyze it" questions about a symbol (Korean: 전망, 앞으로 어때, 어떻게 될까, 오를까, 떨어질까, 반등할까, 분석해줘, 사도 될까) → ${tools}.${flows}`;
        },
    },
    {
        requires: ['get_bars_indicators'],
        text: available =>
            `Chart, trend, price-flow, momentum or indicator-value questions (차트, 추세, 지표; RSI, MACD, Bollinger, moving averages, overbought) about a symbol → get_bars_indicators; for weekly or monthly charts (주봉, 월봉, 장기 추세) pass timeframe 1Week or 1Month, and 1Month for 연봉/년봉; a question only about earnings, financials, news or congressional trades does not need it. A Korean outlook question (전망, 오를까, 떨어질까, 반등할까) matches the outlook row above, not only this chart row.${available.has('get_price_stats') ? ' A return, a closing high or low, or a drawdown over a stated calendar window, a calendar year or since a date matches the price statistics row; the 52-week high or low (52주 최고가) and 20- or 60-session highs and lows stay with this row.' : ''}`,
    },
    {
        requires: ['get_price_stats'],
        // The tails name the swings and index rows, so they render only when
        // those rows do.
        text: available =>
            `A symbol's or a stock index's price performance over a stated period, a calendar year or since a date (올해 수익률, 연초 대비, 작년 수익률, 2022년 수익률, 최근 3년 동안 몇 % 올랐어, 10년 연평균 수익률, 3월 초에 샀으면 지금 몇 %), its highest or lowest close or deepest drop in such a period (올해 최고 종가, 올해 최대 낙폭, MDD), its close on a past date (작년 마지막 거래일 종가, 그날 종가 얼마였어) or how closely two or three of them moved (상관관계, 같이 움직여?) → get_price_stats with every subject of the question in one call (index for the S&P 500, Nasdaq Composite, KOSPI or KOSDAQ themselves). More than three subjects go in parallel calls of up to three in the same step; a correlation comes only for two subjects in the same call. A question relative to this time last year or N months ago (작년 이맘때 대비, N개월 전 대비, 1년 전보다) passes period (1m, 3m, 6m or 1y), never from. Quote each return with its base and end dates and say once that it is a closing-price change (without dividends for a stock, ETF or index; for a coin just a closing-price change); today's move and the current price stay with the quote row. Never compute a period return, an annual rate, a drawdown or a correlation from bars yourself while this tool is available.${available.has('get_swing_history') ? ' How often, how deep on average or how long declines or rallies run is the swings row; the single deepest drop in one window is this row.' : ''}${available.has('get_index_history_stats') ? " An index's year-by-year, monthly or election-cycle history is the index statistics row." : ''}`,
    },
    {
        requires: ['get_cached_analysis'],
        text: 'Named chart patterns (head and shoulders, wedge, double top) or "what does SIGLENS think / show SIGLENS analysis" → get_cached_analysis.',
    },
    {
        // In 5 of 8 synthetic two-session "what changed since" turns the
        // model called get_bars_indicators instead of an analysis tool, so it
        // never saw `sinceEarlier`, which only an analysis result carries.
        // The row sends those turns to the analysis tool even though the
        // earlier result is already in the history, and names no other tool
        // so it renders unchanged whatever else is available.
        requires: ['get_cached_analysis'],
        text: 'What changed for a symbol since an analysis shown earlier in this conversation (그 뒤로 바뀐 거 있어?, 그때 분석이랑 지금 차이, 그때 말한 지지선 깨졌어?, since last time) → get_cached_analysis for that symbol with tab technical and timeframe 1Day, even though the earlier result is already in the conversation: only a new result carries `sinceEarlier`, the computed list of what changed, so answer from it, not from the earlier answer or the bars alone. If the result has no `sinceEarlier`, compare the new result with the earlier one yourself and say the comparison is yours.',
    },
    {
        requires: ['get_guide'],
        text: 'What a pattern, candlestick, indicator or strategy is, or how to read or check it on a chart, with no symbol in question ("RSI가 뭐야", "RSI 어떻게 봐", "what is a double bottom") → get_guide, and link the guide url it returns. When a symbol is also named, add the per-symbol rows for that symbol.',
    },
    {
        requires: ['get_quote'],
        text: "Current price or today's move of a symbol → get_quote.",
    },
    {
        requires: ['get_fundamentals'],
        // Price-target questions move to get_analyst_views when it exists (two
        // aggregators, analyst count, dated firm actions); without it this
        // row keeps them so they are never left unrouted.
        text: available =>
            available.has('get_analyst_views')
                ? 'Earnings results or dates, valuation (P/E, "is it expensive", market cap), margins, growth or financial health of a stock → get_fundamentals. It carries a consensus price target for valuation context only; a question about price targets or analyst ratings themselves matches the analyst row below.'
                : 'Earnings results or dates, valuation (P/E, "is it expensive", market cap), margins, growth, financial health or analyst price targets of a stock → get_fundamentals.',
    },
    {
        requires: ['get_analyst_views'],
        text: 'What analysts think of a stock, its price target, changes to price targets or ratings, upgrades or downgrades, which firm raised or cut its target, or how earnings estimates have moved (목표가, 목표가 얼마야, 목표가 상향/하향, 투자의견, 투자의견 변경, 증권사 리포트, 애널리스트들이 뭐래, 실적 추정치 올라가?, EPS 전망 바뀌었어?, 이익 추정치 상향·하향, 컨센서스 변화) → get_analyst_views. Firm-by-firm changes exist for US stocks only; for a Korean stock it returns the targets, the rating distribution and the estimate trend.',
    },
    {
        requires: ['get_news'],
        // The analyst pairing is gated on the tool so the row never names a
        // tool the model cannot call.
        text: available =>
            `News, events, lawsuits, rulings, or "why did it move / what happened" about a symbol or market → get_news.${available.has('get_analyst_views') ? ' For "why did it move" about a US company stock — not an ETF, an index or a coin — (왜 떨어졌어, 왜 올랐어, 급락 이유, 급등 이유), also call get_analyst_views in the same step: rating and target changes published around the move belong in the answer, each with its date and firm.' : ''} Pass since as the start of the period the question names.${available.has('get_bars_indicators') ? ' For a move over a period (최근 한 달 흐름, 이번 주 왜 빠졌어) also call get_bars_indicators in the same step.' : ''}`,
    },
    {
        // A second call that waits for the first result (the earnings-timing
        // carve-out below is the other such row): the model cannot know which
        // filing to read before it has seen the list. US-only is stated first
        // because the Korean triggers (공시, 임원 변경) also fit Korean stocks,
        // which have no SEC filings — a caveat at the end of the row came too
        // late and cost a wasted call.
        requires: ['get_company_filings'],
        text: available => {
            const elsewhere = available.has('get_news')
                ? 'use the news row for those'
                : 'answer those from the other matching rows';
            const beforeSearch = available.has('web_search')
                ? " For a company's own announcement never call web_search in the first step: list and read the filing first, and search only in a later step if the filings do not cover it."
                : '';
            return `For a US-listed company only (a Korean stock or a coin files nothing with the SEC — ${elsewhere}): the details of something the company itself announced — the figures, guidance or the reason behind a number in its earnings release, the terms of a contract, acquisition, share offering or financing, an executive appointment or departure, or "what did it file / announce" (공시 뭐 나왔어, 8-K, 보도자료 원문, 실적 발표 내용, 가이던스, 계약 조건, 인수 조건, 임원 변경, 매출로 잡혀?, 왜 순이익이 늘었어?) → get_company_filings without \`accession\` first; then, in the next step, call it again with the \`accession\` of the filing whose items and headline match, and answer from its text. A follow-up that digs into an announcement an earlier answer mentioned matches this row too.${beforeSearch}`;
        },
    },
    {
        requires: ['get_options_summary'],
        text: 'Options, implied volatility, put/call ratio, max pain, expirations or expected move → get_options_summary.',
    },
    {
        requires: ['get_congress_trades'],
        // The pointer to get_investor_flows is added only when that tool is available, so the
        // table never names a tool the model cannot call.
        text: available =>
            `Congressional or politicians' trades (Pelosi, lawmakers) → get_congress_trades.${available.has('get_investor_flows') ? ' Executives and other corporate insiders are not Congress — use get_investor_flows for those.' : ''}`,
    },
    {
        requires: ['get_investor_flows'],
        text: available => {
            const broad = available.has('get_cached_analysis')
                ? ' For a broad "how is it overall / 종합적으로 어때" question, or a buy, sell or hold decision (지금 사도 될까?, 매수해도 돼?, 팔아야 해?, 들고 가도 돼?), about a US or Korean stock, call get_investor_flows alongside the outlook tools and weigh it with the source notes that end this row.'
                : '';
            return `Who is buying or selling a US stock — institutional buying/selling or holdings (기관 매수/매도, 13F), insider trades (내부자), 5% holders or activists (13D/13G), short selling or short squeeze (공매도, 숏스퀴즈) → get_investor_flows.${broad} Its 13F part is quarterly and ~45 days late (structural, not today's positioning); insider clusters and new 13D filings are event-level; squeeze risk and short-volume z-scores are short-term. Always give the as-of dates it returns, and report an axis marked insufficient as no data, never as neutral. For one named institution's stake in a US stock (블랙록은 몇 주 갖고 있어?, 그 펀드가 몇 주 갖고 있어?, 그 기관 지분 얼마야?), pass holder in the first call.`;
        },
    },
    // One row per question type rather than one long row: the model routes by
    // matching the user's words, so each type keeps its own trigger keywords
    // and the reading note that belongs to it (tool-selection accuracy over
    // prompt length — never merge these to save tokens).
    {
        requires: ['get_investor_flows'],
        text: 'Share dilution or offerings of a US stock — 유상증자, 증자, 희석, 공모, ATM 발행, 선반 등록, shelf registration, S-3, 424B5, private placement or Form D → get_investor_flows. Give each filing date it returns, and say that an at-the-market program or a priced offering sells new shares while a shelf or registration only makes a sale possible.',
    },
    {
        requires: ['get_investor_flows'],
        text: 'Planned insider sales of a US stock — Form 144, 매도 예정, 내부자 매도 계획, 10b5-1 계획 매도 → get_investor_flows. A Form 144 is a notice of intent to sell, so the sale may not happen; the executed sale later shows as a Form 4, so never count the two as separate selling.',
    },
    {
        requires: ['get_investor_flows'],
        text: 'Fails to deliver of a US stock, or suspected naked short selling — 결제 불이행, FTD, 무차입 공매도 의혹 → get_investor_flows. Fails are published about two weeks after each half-month, and every answer that mentions them says they are not evidence of naked short selling (SEC).',
    },
    {
        requires: ['get_investor_flows'],
        text: 'Whether a US stock is on the Reg SHO threshold list — 공매도 과열 종목, threshold list → get_investor_flows. The list is daily; give the list date and the consecutive days it returns.',
    },
    {
        requires: ['get_investor_flows'],
        text: "Institutions' put or call option positions in a US stock — 기관 풋·콜 포지션, 13F options → get_investor_flows. They are quarterly 13F notional values (~45 days late), often hedges against long stock, so call a put/call tilt a weak signal.",
    },
    {
        requires: ['get_investor_flows'],
        text: 'Short-squeeze score or likelihood of a US stock — 숏스퀴즈 점수, 숏스퀴즈 가능성, squeeze risk → get_investor_flows. Quote the score and level with the top components it lists; a partial score was reweighted over the inputs that were present, and a capped level means no short-positioning input was available.',
    },
    {
        requires: ['get_investor_flows'],
        text: 'Investor flows (수급), major-holder or insider stake changes of a Korean stock — 삼성전자 수급 어때?, 대주주 지분 변동, 최대주주 지분, 5% 공시, 대량보유, 임원이 주식 샀어?, 임원·주요주주 소유보고 → get_investor_flows (DART disclosures: 대량보유 상황보고, 임원·주요주주 소유보고, 거래계획보고서). Give the receipt dates it returns; its 13F, short-selling and dilution axes are insufficient for Korean stocks, which is no data, not neutral.',
    },
    {
        requires: ['get_investor_flows'],
        // krInvestorTrend is the primary source; only the fallback sentence
        // switches on web_search, the head and tail are shared.
        text: available =>
            `Korean institutional or foreign net buying asked for specifically — 기관·외국인 순매수, 외국인이 사고 있어?, 기관 매매 동향 → call get_investor_flows and answer from its \`krInvestorTrend\` when present (shares; cite 네이버 금융 and its asOf; for a last-N-trading-days total use sum5d/sum20d or sum the rows). When \`krInvestorTrend\` is null or absent, ${
                available.has('web_search')
                    ? 'use web_search (e.g. Naver Finance or KRX pages), cite the publisher and the date of the figure, and never estimate it; if the search finds nothing or web_search is refused (quota), say the figure could not be confirmed. Search only when krInvestorTrend is null or absent and the user asks for these figures specifically, never for a general 수급 or outlook/buy question.'
                    : 'say SIGLENS does not carry it and the figure could not be confirmed; never estimate it, never offer it as a follow-up question.'
            } Never suggest that any other SIGLENS tool holds it. A general 수급 question about a Korean stock is not this row: follow the Korean stake-changes row above (call get_investor_flows) and, unless \`krInvestorTrend\` is present, add that institutional/foreign net buying could not be confirmed, without searching.`,
    },
    {
        requires: ['get_market_overview'],
        text: 'Overall market mood, fear & greed, index levels (S&P 500, Nasdaq, KOSPI) or a sector → get_market_overview.',
    },
    {
        // A second row with the same `requires` as the market-mood row above —
        // not a duplicate: the two ask for the same tool on different
        // questions, and only this one carries the screening rules.
        // Discovery names no symbol, so none of the per-symbol rows above can
        // match it. The signal scan inside get_market_overview is the only
        // screen SIGLENS has, and the cap here is a budget rule, not a
        // reluctance: a fresh analysis per candidate costs minutes each and
        // eats the turn the answer still has to fit in.
        requires: ['get_market_overview'],
        text: available => {
            const thenBars = available.has('get_bars_indicators')
                ? ', then get_bars_indicators for at most three of the flagged symbols'
                : '';
            return `Which sectors, stocks or coins are worth looking at now, or candidates to watch, with no symbol named → get_market_overview for the market the question is about ('kr' for Korean stocks, 'crypto' for coins, 'us' otherwise)${thenBars}. Read the scan for the market asked about only, and never run a fresh analysis to screen candidates.`;
        },
    },
    {
        requires: ['get_theme_snapshot'],
        text: available =>
            `The mood, rally or sell-off of an investment theme rather than one stock or a GICS sector (양자 테마 분위기, 네오클라우드 매도세, AI 반도체 관련주, 원전주, 우주항공주, 코인 관련주, 2차전지, 방산주, 조선주) → get_theme_snapshot with the matching theme${available.has('get_news') ? '; when the user asks why it moved, call get_theme_snapshot first and then, in the next step, get_news for the best and worst names its summary lists' : ''}. When no theme on its list matches (로봇, 바이오, 게임 …), do not call get_theme_snapshot at all — not even with a neighbouring theme as a stand-in: say SIGLENS has no basket for that theme and answer from the market overview or the news.`,
    },
    {
        requires: ['get_index_history_stats'],
        // The carve-out names the swings row, so it renders only when that row does.
        text: available =>
            `Historical or seasonal statistics of the S&P 500, Nasdaq Composite, KOSPI or KOSDAQ — returns by year, by calendar month or by presidential-cycle year, the year after a midterm election, the worst years (중간선거 뒤 상승장, 9월은 원래 약해?, 1월 효과, 연말 랠리, 역대 최악의 해, 평균 연간 수익률) → get_index_history_stats with that index (sp500 when the question names no index and is about the US market, kospi for the Korean market). Quote its sample counts and period, and never turn the past into a forecast.${available.has('get_swing_history') ? ' How long declines or rallies of an index last is not this row: that is the swings row.' : ''}${available.has('get_price_stats') ? ' A named recent window or one calendar year of an index (올해, 작년 한 해, 최근 10년), its close on a date and its deepest daily drop in such a window are the price statistics row.' : ''}`,
    },
    {
        requires: ['get_swing_history'],
        text: `How long or how far declines or rallies of one symbol usually go, how long it takes to get back to the high, or how the current decline or rally compares or how much longer a decline or rally of this age usually ran (${SWING_TRIGGER_EXAMPLES}) → get_swing_history with that symbol (${SWING_THRESHOLD_GUIDE}); for a whole index pass its tracking ETF. Never count past swings from bars yourself while this tool is available. Quote its medians with the sample count and the period, and never turn the past into a forecast of when the current leg ends: for 언제 끝날까?, 바닥은 언제쯤?, 며칠 더 갈까? quote afterThisAge as a past distribution, never as a date.`,
    },
    {
        // Every call is billed per post read, so the row names its two triggers
        // and its exclusions: an explicit X question, or "what is new with this
        // one company" (explicit-only routing skipped X for those questions and
        // answered "no specific news" while the company had posted). Price,
        // outlook, "why did it move", multi-stock and market-wide questions stay
        // out — those are the high-volume questions that would drain the budget.
        // "Posted" rather than "said": what a company said in a filing or press
        // release belongs to the filings row.
        requires: ['get_x_posts'],
        text: available =>
            `What a company or its chief executive posted on X or Twitter (일론 머스크 최근 트윗, CEO가 X에 뭐라고 올렸어, 공식 X 계정에 뭐 올라왔어, 트위터에서 뭐래), or what is new with one specific company lately — its recent news, updates or what it has posted itself (테슬라 요즘 무슨 소식 있어?, 근황 알려줘, 최근에 별일 없어?, 회사가 직접 올린 거 있어?) → get_x_posts.${available.has('get_news') ? ' For the recent-news case call it in the same step as get_news; its posts are one source next to the news, never the only basis of the answer.' : ''} It is not called for a stock's price, chart, valuation, outlook or "why did it move" question, for several stocks at once or for the market as a whole, and what an executive said on an earnings call, in an interview or in a filing matches the other rows, not this one.`,
    },
    {
        requires: ['get_macro_quotes'],
        // The off-list sentence switches on web_search so the row never
        // points at a tool the model cannot call, and so an off-list quote
        // is not forced through the "never search for prices" row below.
        text: available =>
            `Oil, gold, silver, copper, natural gas, index futures, the dollar index or an exchange rate (유가, WTI, 브렌트유, 금값, 은값, 구리, 천연가스, 나스닥 선물, S&P 선물, 다우 선물, 달러 인덱스, 원달러 환율, 엔화 환율, 유로 환율, 위안화 환율) → get_macro_quotes with the matching instruments from its list. Never answer one of these with an ETF price or a web search while the instrument is on its list. For an instrument that is not on its list (another currency pair, another futures contract, e.g. wheat) do not call get_macro_quotes with other instruments in its place: ${
                available.has('web_search')
                    ? 'use web_search instead, cite the publisher and the time of the quote, and never estimate it'
                    : 'say SIGLENS does not carry that quote; never estimate it'
            }.`,
    },
    {
        requires: ['get_economy'],
        text: "Interest rates, Fed/FOMC, inflation (CPI), jobs, GDP, Treasury yields or the economic calendar → get_economy. For South Korea (Bank of Korea / 한국은행, Korean rates, inflation, jobs, exports, Korean government bonds / 국고채 or the Korean economic calendar) pass country 'kr'; when the question names no country, use the US. For a date outside its calendar's `coverage`, call get_economy again with `from`/`to` and the same country before saying SIGLENS has no such date.",
    },
    {
        requires: ['get_my_portfolio'],
        text: 'The user\'s own holdings, positions or profit/loss ("my stocks", "내 포트폴리오") → get_my_portfolio.',
    },
    {
        requires: ['web_search'],
        // The exception list names every row that sends a price-like topic
        // to web_search; a row that did so without being listed here read as
        // a contradiction and the model declined the search.
        text: available =>
            `Market, company or economic facts none of the SIGLENS tools above hold (regulation, corporate events ${available.has('get_company_filings') ? 'neither the news tool nor a company filing covers' : 'the news tool lacks'}) → web_search. Never for prices, indicators or anything a SIGLENS tool returns a value for, except the routing rows that explicitly send a topic to web_search (Korean investor-type net buying when krInvestorTrend is null or absent; the null-value fallback row${available.has('get_macro_quotes') ? '; a commodity, futures or exchange-rate quote that is not on the get_macro_quotes list' : ''}).`,
    },
    {
        requires: ['web_search'],
        // Earnings timing is searched only after get_fundamentals came back
        // without `earningsSession`: the routing table is matched before any
        // result exists, so without the sequencing sentence the model fired
        // the search in parallel and spent quota on a figure the tool had.
        text: available => {
            const hasFundamentals = available.has('get_fundamentals');
            const timing = hasFundamentals
                ? 'earnings before/after-market timing that a get_fundamentals result in this conversation left without `earningsSession`'
                : 'earnings before/after-market timing, which no SIGLENS tool provides';
            const sequencing = hasFundamentals
                ? ' Earnings timing is never searched in the first step: call get_fundamentals first and answer from its `earningsSession` when it is present. Do not search it either when that result carries `earningsDateAlt` or `earningsDateConfirmed` false: the date itself is still unsettled, so say the timing has not been announced yet.'
                : '';
            return `Carve-out to the row above: dividends (yield, DPS, ex-date) that a SIGLENS tool returned as null or absent (a confirmed non-payer is not null: say it pays no dividend, and never derive a trailing yield from a single payment); index membership (S&P 500, Nasdaq-100, Dow) that a SIGLENS tool returned as null or absent; ${timing} → web_search, cite the publisher and date, never estimate; if the search finds nothing or web_search is refused (quota), say the figure could not be confirmed.${sequencing}`;
        },
    },
    {
        requires: [],
        text: 'Comparing several symbols → apply the matching rows to each symbol.',
    },
    {
        requires: ['show_chart'],
        text: available =>
            `A comparison over time, a trend across quarters or years, an options distribution, investor flows, ${available.has('get_my_portfolio') ? 'portfolio weights, ' : ''}a market or theme board, or dividend history — when a picture reads better than a list of numbers (엔비디아랑 AMD 6개월 수익률 비교, 애플 실적 추이, 옵션 어디에 몰려 있어, 외국인 수급 추이, 오늘 섹터 한눈에, 배당 추이) → show_chart with the matching kind in the same step as the data tools the answer needs. Not for a single figure, a definition or a yes/no question. A comparison of a few current values with no time axis (today's P/E, market cap or change of a few symbols, the latest quarter's EPS) is not a chart either: answer it with a markdown table. At most two charts per answer.${available.has('get_theme_snapshot') ? ' A theme board only for a theme on the get_theme_snapshot list — never a neighbouring theme as a stand-in.' : ''}`,
    },
    ...WATCHLIST_ALERT_ROUTING_ROWS,
    OUT_OF_SCOPE_ROW,
];
