import { describe, expect, it } from 'vitest';
import {
    SWING_THRESHOLD_GUIDE,
    SWING_TRIGGER_EXAMPLES,
} from '@/features/agent-tools/spec/getSwingHistory';
import {
    AGENT_TOOL_SPECS,
    buildAgentSystemPrompt,
    findToolSpec,
} from './toolSetHarness';

/*
 * core `buildAgentSystemPrompt.test.ts`에서 **도구 문구**(라우팅 줄·도구별 규칙 줄·게스트 안내 조각·계산값 예시
 * 필드 목록)를 단언하는 테스트만 옮긴 것이다. 본문은 그대로이고, 프롬프트는 siglens 모음으로 만든다
 * (`toolSetHarness.ts`). 도구와 무관한 프레임 문장(답변 깊이·문체·시각·브랜드·후속 질문 등)만 단언하던 테스트는
 * core에 남는다. 한 테스트가 둘을 섞어 단언하던 곳(표 제목, 계산값 규칙의 머리말)은 프레임 쪽 단언만 뺐다 —
 * core가 프레임 문장을 고쳐도 이 파일이 깨지지 않게 하려는 것이다. 표를 자르는 기준인 절 제목
 * (`### Which tools to call`·`### Rules`)은 예외로 남는다.
 */

const NEW_TOOLS: readonly string[] = [
    'get_fundamentals',
    'get_market_overview',
    'get_economy',
    'get_congress_trades',
];
const NOW = new Date('2026-09-12T15:00:00Z'); // 11:00 ET (open), 2026-09-13 00:00 KST

describe('buildAgentSystemPrompt', () => {
    const prompt = buildAgentSystemPrompt({
        locale: 'ko',
        tools: AGENT_TOOL_SPECS,
        now: NOW,
        etSessionStatus: 'open',
    });

    const promptFor = (locale: 'ko' | 'en' | 'ja' | 'zh') =>
        buildAgentSystemPrompt({
            locale,
            tools: AGENT_TOOL_SPECS,
            now: NOW,
            etSessionStatus: 'open',
        });

    it('한국어 전망 질문 트리거를 분석 라우팅 행에 싣는다', () => {
        const row = prompt
            .split('\n')
            .find(line => line.includes('Outlook, "how is it doing"'));
        expect(row).toBeDefined();
        for (const trigger of [
            '전망',
            '앞으로 어때',
            '어떻게 될까',
            '오를까',
            '떨어질까',
            '반등할까',
            '분석해줘',
            '사도 될까',
        ]) {
            expect(row).toContain(trigger);
        }
        expect(row).toContain('get_cached_analysis');
        expect(prompt).toContain('matches the outlook row above');
    });

    it('눌림 기저율을 보유 승률로 말하지 않게 하고 caveat를 전한다', () => {
        expect(prompt).toContain('never a win rate or a holding-period result');
        expect(prompt).toContain('never call it a win rate (승률)');
        expect(prompt).toContain('수익으로 끝난 비율');
        expect(prompt).toContain('pullback.caveat is a string');
    });

    it('종목 공포·탐욕 이력을 없다고 말하지 않고, 라벨·이력 필드는 있을 때만 쓴다', () => {
        expect(prompt).toContain(
            'never say its history is unavailable. When fearGreed.history is present'
        );
        expect(prompt).toContain('When fearGreed.groups[].label is present');
    });

    it('종목 공포·탐욕에는 측정된 선행 기록이 없다고 못 박고 백테스트 귀속을 금지한다', () => {
        for (const locale of ['ko', 'en'] as const) {
            const p = promptFor(locale);
            expect(p).toContain(
                'Symbol fear & greed has no measured forward record'
            );
            expect(p).toContain('never attribute a backtest to it');
        }
        expect(
            AGENT_TOOL_SPECS.find(t => t.name === 'get_bars_indicators')
                ?.description
        ).toContain('no measured forward edge');
    });

    it('옵션 답변 규칙(맥스 페인 끌림 해석 금지·IV 이력 없는 평가 금지·센트 표기)은 get_options_summary가 있을 때만 넣는다', () => {
        expect(prompt).toContain(
            'never mention the pinning or gravitation idea that price drifts toward it'
        );
        expect(prompt).toContain(
            'Never call implied volatility high, low or normal for this stock'
        );
        expect(prompt).toContain("not '9.5 cents', not 'half a cent'");
        expect(prompt).toContain(
            'beyond daysToExpiration and the expiration date'
        );
        const noOptions = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_options_summary'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noOptions).not.toContain('pinning or gravitation');
    });

    it('도구 선택은 질문 유형 표로, 가용한 도구를 가리키는 행만 넣는다', () => {
        expect(prompt).toContain('→ search_ticker first');
        expect(prompt).toContain('→ get_my_portfolio.');
        // 기본 창 밖의 날짜(다음다음 FOMC)를 "데이터에 없다"로 답하지 않게 한다.
        expect(prompt).toContain(
            'call get_economy again with `from`/`to` and the same country before saying SIGLENS has no such date'
        );
        // 한국은행·한국 지표 질문이 미국 데이터로 답해지지 않게 국가를 넘긴다.
        expect(prompt).toContain(
            "For South Korea (Bank of Korea / 한국은행, Korean rates, inflation, jobs, exports, Korean government bonds / 국고채 or the Korean economic calendar) pass country 'kr'; when the question names no country, use the US"
        );
        const noSearch = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_options_summary'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noSearch).not.toContain('get_options_summary');
        // 표의 각 행은 한 줄 — 여러 규칙을 한 불릿에 이어 붙이지 않는다.
        const table = prompt.slice(
            prompt.indexOf('### Which tools to call'),
            prompt.indexOf('### Rules')
        );
        // 예외 하나: 관심종목 줄(siglens, WP-23 전부터)은 보유 종목 질문을 get_my_portfolio로 돌리는 두 번째 화살표를
        // 갖는다. 옮기면서 바이트를 지켰고, 줄을 나누는 것은 따로 할 도구 문구 변경이다.
        const twoArrowRows = ['- The user asks about their watchlist'];
        for (const line of table
            .split('\n')
            .filter(l => l.startsWith('- '))
            .filter(l => !twoArrowRows.some(start => l.startsWith(start))))
            expect(line.match(/→/g)?.length ?? 0).toBeLessThanOrEqual(1);
        expect(
            table
                .split('\n')
                .filter(l => twoArrowRows.some(start => l.startsWith(start)))
        ).toHaveLength(twoArrowRows.length);
    });

    it('전망 질문 행은 두 툴 중 하나만 가용해도 남은 툴로 안내한다', () => {
        // Captures only the tool list: the row may go on with a second
        // sentence (the buy/sell-decision pointer to get_investor_flows).
        const outlook = /Outlook, "how is it doing".*?→ ([^\n]+?)\.(?: |$)/m;
        expect(prompt.match(outlook)?.[1]).toBe(
            'get_cached_analysis and get_bars_indicators (timeframe 1Day unless the user names another) together'
        );
        const only = (drop: string): string | undefined =>
            buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(t => t.name !== drop),
                now: NOW,
                etSessionStatus: 'open',
            }).match(outlook)?.[1];
        expect(only('get_cached_analysis')).toBe(
            'get_bars_indicators (timeframe 1Day unless the user names another)'
        );
        expect(only('get_bars_indicators')).toBe('get_cached_analysis');
        // 둘 다 없으면 행 자체가 사라진다(남은 안내가 가리킬 툴이 없다).
        const neither = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t =>
                    ![
                        'get_cached_analysis',
                        'get_bars_indicators',
                        'run_fresh_analysis',
                    ].includes(t.name)
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(neither).not.toMatch(outlook);
        expect(neither).not.toContain('get_bars_indicators');
    });

    it('개념 설명 질문은 get_guide로 보내고, 툴이 없으면 그 줄을 뺀다', () => {
        expect(prompt).toContain('→ get_guide, and link the guide url');
        expect(prompt).toContain('"RSI 어떻게 봐"');
        expect(prompt).toContain('When a symbol is also named');
        const withoutGuide = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(s => s.name !== 'get_guide'),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(withoutGuide).not.toContain('→ get_guide');
    });

    it('주봉·월봉 질문을 1Week·1Month로 보내고 그 기간의 시야를 정한다', () => {
        expect(prompt).toContain(
            '1Month bars → months to years; 1Week → weeks to a few months'
        );
        expect(prompt).toContain(
            'for weekly or monthly charts (주봉, 월봉, 장기 추세) pass timeframe 1Week or 1Month'
        );
    });

    it('종목 분석 질문에는 get_bars_indicators 컨플루언스를 부르고 답에 밝히게 한다', () => {
        expect(prompt).toContain(
            ') → get_cached_analysis and get_bars_indicators (timeframe 1Day unless the user names another) together'
        );
        expect(prompt).toContain('reflect how many indicator groups agree');
        // 컨플루언스는 예측이 아니라 서술용 집계다 — 측정된 우위가 없다(2026-09-25 재측정).
        expect(prompt).toContain(
            'not a forecast (it has no measured forward edge)'
        );
        // 방향을 묻지 않는 질문(실적·재무·뉴스·의회 거래만)에는 붙이지 않는다.
        expect(prompt).toContain(
            'a question only about earnings, financials, news or congressional trades does not need it'
        );
    });

    it('pullback 판독을 컨플루언스 옆에 전하되 매수 지시가 아니라 기저율로 다루게 한다', () => {
        expect(prompt).toContain(
            'a historical base rate, never a buy instruction'
        );
        expect(prompt).toContain(
            'When the reading is washoutInUptrend and the tally leans bearish, say that this combination is normal for such pullbacks'
        );
        expect(prompt).toContain(
            'which has been the riskier case (washoutBelowMa200)'
        );
    });

    describe('show_chart routing', () => {
        it('그림이 나은 질문을 show_chart로 보내고 답변당 두 장으로 묶는다', () => {
            expect(prompt).toContain('→ show_chart with the matching kind');
            expect(prompt).toContain('At most two charts per answer.');
            // 시간 축 없는 몇 개의 현재 값 비교는 그림이 아니라 답변 안 마크다운 표로 쓴다(사용자 결정 2026-11-19).
            // 라우팅 시점에는 데이터가 없으므로 경계는 "이미 받은 값"이 아니라 질문 모양(시간 축 유무)이다(DOM-15).
            expect(prompt).toContain(
                'A comparison of a few current values with no time axis'
            );
            expect(prompt).toContain(
                'is not a chart either: answer it with a markdown table.'
            );
            // 추이·비교 차트 예시는 그대로 남는다 — 위 예외와 겹치지 않는다.
            expect(prompt).toContain(
                '엔비디아랑 AMD 6개월 수익률 비교, 애플 실적 추이'
            );
            expect(prompt).toContain(
                'never a neighbouring theme as a stand-in'
            );
            expect(prompt).toContain('portfolio weights, ');
        });

        it('show_chart가 없으면 행을 내지 않는다', () => {
            const without = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(t => t.name !== 'show_chart'),
                now: NOW,
                etSessionStatus: 'open',
            });
            expect(without).not.toContain('→ show_chart');
        });

        it('보유종목 도구가 없으면(게스트) 비중 문구를 뺀다', () => {
            const guest = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(
                    t => t.name !== 'get_my_portfolio'
                ),
                now: NOW,
                etSessionStatus: 'open',
            });
            expect(guest).toContain('→ show_chart');
            expect(guest).not.toContain('portfolio weights, ');
        });

        it('테마 도구가 없으면 테마 대체 금지 문장을 빼고 행은 남긴다', () => {
            const noTheme = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(
                    t => t.name !== 'get_theme_snapshot'
                ),
                now: NOW,
                etSessionStatus: 'open',
            });
            expect(noTheme).toContain('→ show_chart');
            expect(noTheme).not.toContain(
                'never a neighbouring theme as a stand-in'
            );
        });
    });

    describe('get_investor_flows routing', () => {
        const without = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_investor_flows'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });

        it('routes investor-flows questions to the tool with the weighting and as-of rules', () => {
            expect(prompt).toContain('→ get_investor_flows.');
            expect(prompt).toContain('기관 매수/매도, 13F');
            expect(prompt).toContain('공매도, 숏스퀴즈');
            expect(prompt).toContain('quarterly and ~45 days late');
            expect(prompt).toContain('Always give the as-of dates it returns');
            expect(prompt).toContain('never as neutral');
        });

        it('pairs it with the outlook tools for a broad question when get_cached_analysis is available', () => {
            expect(prompt).toContain(
                'call get_investor_flows alongside the outlook tools'
            );
            expect(prompt).toContain(
                '), about a US or Korean stock, call get_investor_flows alongside the outlook tools'
            );
        });

        /**
         * Measured: buy/sell-decision asks ("AAPL 지금 사도 될까?") rarely
         * called get_investor_flows while broad "종합" asks always did, so
         * both the outlook row and the flows row name the decision wording.
         */
        it('pairs it with the outlook tools for a buy, sell or hold decision', () => {
            expect(prompt).toContain(
                'For a buy, sell or hold decision about a US or Korean stock (지금 사도 될까?, 매수해도 돼?, 팔아야 해?, 들고 가도 돼?, entry timing), also call get_investor_flows in the same step.'
            );
            expect(prompt).toContain(
                'or a buy, sell or hold decision (지금 사도 될까?, 매수해도 돼?, 팔아야 해?, 들고 가도 돼?), about a US or Korean stock'
            );
            expect(without).not.toContain('buy, sell or hold decision');
        });

        /**
         * Each new question type has its own row with its own trigger words, so
         * the model can match the user's wording to the tool (tool-selection
         * accuracy over prompt length — user decision).
         */
        const rowOf = (marker: string): string =>
            prompt.split('\n').find(line => line.includes(marker)) ?? '';

        it.each([
            [
                'Share dilution or offerings of a US stock',
                [
                    '유상증자',
                    '증자',
                    '희석',
                    '공모',
                    'ATM 발행',
                    '선반 등록',
                    'shelf registration',
                    'S-3',
                    '424B5',
                    'private placement or Form D',
                    'Give each filing date',
                ],
            ],
            [
                'Planned insider sales of a US stock',
                [
                    'Form 144',
                    '매도 예정',
                    '내부자 매도 계획',
                    '10b5-1 계획 매도',
                    'notice of intent to sell, so the sale may not happen',
                ],
            ],
            [
                'Fails to deliver of a US stock',
                [
                    '결제 불이행',
                    'FTD',
                    '무차입 공매도 의혹',
                    'about two weeks after each half-month',
                    'not evidence of naked short selling (SEC)',
                ],
            ],
            [
                'Reg SHO threshold list',
                ['공매도 과열 종목', 'threshold list', 'The list is daily'],
            ],
            [
                "Institutions' put or call option positions",
                [
                    '기관 풋·콜 포지션',
                    '~45 days late',
                    'often hedges',
                    'weak signal',
                ],
            ],
            [
                'Short-squeeze score or likelihood',
                [
                    '숏스퀴즈 점수',
                    '숏스퀴즈 가능성',
                    'top components',
                    'reweighted over the inputs that were present',
                    'capped level',
                ],
            ],
            [
                'stake changes of a Korean stock',
                [
                    '대주주 지분 변동',
                    '최대주주 지분',
                    '5% 공시',
                    '임원이 주식 샀어?',
                    '대량보유 상황보고',
                    '임원·주요주주 소유보고',
                    '거래계획보고서',
                    'insufficient for Korean stocks, which is no data, not neutral',
                ],
            ],
        ] as const)(
            'routes "%s" questions to get_investor_flows in their own row',
            (marker, terms) => {
                const row = rowOf(marker);
                expect(row).toContain('→ get_investor_flows');
                for (const term of terms) expect(row).toContain(term);
            }
        );

        it('routes Korean institutional/foreign net buying to krInvestorTrend first, then a cited search only when it is null and the user asked specifically', () => {
            const row = rowOf('Korean institutional or foreign net buying');
            expect(row).toContain('기관·외국인 순매수');
            expect(row).toContain(
                '→ call get_investor_flows and answer from its `krInvestorTrend` when present (shares; cite 네이버 금융 and its asOf'
            );
            expect(row).toContain('sum5d/sum20d or sum the rows');
            expect(row).toContain(
                'When `krInvestorTrend` is null or absent, use web_search'
            );
            expect(row).toContain('cite the publisher and the date');
            expect(row).toContain('never estimate it');
            expect(row).toContain(
                'web_search is refused (quota), say the figure could not be confirmed'
            );
            expect(row).toContain(
                'Search only when krInvestorTrend is null or absent and the user asks for these figures specifically, never for a general 수급 or outlook/buy question'
            );
            expect(row).toContain(
                'Never suggest that any other SIGLENS tool holds it'
            );
            expect(row).not.toContain(
                'do not call get_investor_flows for this question'
            );
            // A general 수급 question must not fall into this row.
            expect(row).toContain('unless `krInvestorTrend` is present');
            expect(row).not.toContain('외국인 수급');
            expect(row).toContain(
                'A general 수급 question about a Korean stock is not this row'
            );
            expect(
                rowOf('major-holder or insider stake changes of a Korean stock')
            ).toContain('삼성전자 수급 어때?');
        });

        it('without web_search, says the net buying is not carried, could not be confirmed, and is never offered as a follow-up', () => {
            const noSearch = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(t => t.name !== 'web_search'),
                now: NOW,
                etSessionStatus: 'open',
            });
            const row =
                noSearch
                    .split('\n')
                    .find(l =>
                        l.includes('Korean institutional or foreign net buying')
                    ) ?? '';
            expect(row).toContain(
                'When `krInvestorTrend` is null or absent, say SIGLENS does not carry it'
            );
            expect(row).toContain('answer from its `krInvestorTrend`');
            expect(row).toContain('could not be confirmed');
            expect(row).toContain('never estimate it');
            expect(row).toContain('never offer it as a follow-up question');
            expect(row).not.toContain('use web_search');
        });

        it('drops every investor-flows row together with the tool', () => {
            for (const marker of [
                'Share dilution or offerings',
                'Planned insider sales',
                'Fails to deliver',
                'Reg SHO threshold list',
                "Institutions' put or call",
                'Short-squeeze score',
                'stake changes of a Korean stock',
                'Korean institutional or foreign net buying',
            ])
                expect(without).not.toContain(marker);
        });

        it('drops the broad-question pairing when get_cached_analysis is not available', () => {
            const noAnalysis = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(
                    t => t.name !== 'get_cached_analysis'
                ),
                now: NOW,
                etSessionStatus: 'open',
            });
            expect(noAnalysis).toContain('→ get_investor_flows.');
            expect(noAnalysis).not.toContain('alongside the outlook tools');
        });

        it('names investor flows in the guest line only when the tool is available', () => {
            const guestOf = (tools: typeof AGENT_TOOL_SPECS) =>
                buildAgentSystemPrompt({
                    locale: 'ko',
                    tools,
                    now: NOW,
                    etSessionStatus: 'open',
                    guest: true,
                });
            expect(guestOf(AGENT_TOOL_SPECS)).toContain(
                'congress trades, investor flows (수급) for US and Korean stocks, analyst targets and rating changes, company SEC filings, official company and CEO posts on X, commodity, futures and exchange-rate quotes, theme baskets, long-run index statistics, past declines and rallies of a symbol, price statistics over any period, web search'
            );
            expect(
                guestOf(
                    AGENT_TOOL_SPECS.filter(
                        t => t.name !== 'get_investor_flows'
                    )
                )
            ).toContain(
                'congress trades, analyst targets and rating changes, company SEC filings, official company and CEO posts on X, commodity, futures and exchange-rate quotes, theme baskets, long-run index statistics, past declines and rallies of a symbol, price statistics over any period, web search) works without it'
            );
        });

        it('leaves no investor-flows row when the tool is not provided', () => {
            expect(without).not.toContain('get_investor_flows');
        });

        it('tells the model corporate insiders are not Congress, only when get_investor_flows exists', () => {
            expect(prompt).toContain(
                'Executives and other corporate insiders are not Congress'
            );
            expect(without).toContain('→ get_congress_trades.');
            expect(without).not.toContain(
                'corporate insiders are not Congress'
            );
        });

        it('lists investor flows (수급) among the guest-accessible features', () => {
            const guest = buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS,
                now: NOW,
                etSessionStatus: 'open',
                guest: true,
            });
            expect(guest).toContain(
                'congress trades, investor flows (수급) for US and Korean stocks, analyst targets and rating changes, company SEC filings, official company and CEO posts on X, commodity, futures and exchange-rate quotes, theme baskets, long-run index statistics, past declines and rallies of a symbol, price statistics over any period, web search'
            );
        });
    });

    it('신규 데이터 툴 4종은 가용할 때만 호출 규칙을 넣는다', () => {
        for (const name of NEW_TOOLS) expect(prompt).toContain(`→ ${name}.`);
        const guest = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS,
            now: NOW,
            etSessionStatus: 'open',
            guest: true,
        });
        expect(guest).toContain(
            'fundamentals, market overview, economy, congress trades'
        );
        expect(prompt).toContain("quote's quoteDelayMinutes is greater than 0");
        const withoutNewTools = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => !NEW_TOOLS.includes(t.name)),
            now: NOW,
            etSessionStatus: 'open',
        });
        for (const name of NEW_TOOLS)
            expect(withoutNewTools).not.toContain(name);
    });

    it('계산 금지·수평선·컨플루언스 명칭·상위 타임프레임 규칙이 들어 있다', () => {
        expect(prompt).toContain(
            'derived, sinceAnalysis, pnl/pnlPct/weightPct, targetUpsidePct, upsidePct, gapPct, daysToEarnings, tally, ageHours, spread2s10s, bestWorstSpreadPp'
        );
        expect(prompt).toContain('maxPainDistancePct/impliedMoveRange');
        expect(prompt).toContain('Horizon:');
        expect(prompt).toContain('1Day bars → days to a few weeks');
        expect(prompt).toContain('Analysis vs now:');
        expect(prompt).toContain('sinceAnalysis.levelsBroken');
        expect(prompt).toContain(
            'sinceAnalysis.planNow.belowStopLoss or sinceAnalysis.planNow.exceedsEntryZone is true'
        );
        expect(prompt).toContain(
            'quote movePct as the move since the analysis'
        );
        expect(prompt).not.toContain('movePct is large relative to the levels');
        // The rule states left the tool output (2026-10-03): the model read
        // them as "매수/매도 규칙 미충족", so the prompt no longer names them.
        expect(prompt).not.toContain('Confluence rules:');
        expect(prompt).not.toContain('entryRuleMet');
        expect(prompt).not.toContain('rule states');
        // Positive wording, qualifier once: a "never call it a buy/sell rule"
        // line made the model write "not a buy/sell rule" disclaimers.
        expect(prompt).toContain(
            'how far the indicator families agree, never printing its 0–100 score, and say once in the answer that it is a rule-based tally, not a forecast'
        );
        expect(prompt).not.toMatch(/buy or sell rule/);
        expect(prompt).toContain('Higher timeframe:');
        expect(prompt).toContain(
            "higherTimeframe is the next larger timeframe's trend and tally"
        );
    });

    it('눌림 판독이 none이면 언급하지 않게 한다', () => {
        expect(prompt).toContain(
            'When pullback is null, do not bring it up at either level; if the question asks about it, answer as the get_bars_indicators description says (no reading, or too little history when range.bars is below 200).'
        );
    });

    it('Horizon·Analysis vs now·Confluence rules·Higher timeframe은 해당 툴이 없으면 빠진다', () => {
        const withoutBars = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_bars_indicators'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(withoutBars).not.toContain('Horizon:');
        expect(withoutBars).not.toContain('Confluence rules:');
        expect(withoutBars).not.toContain('Higher timeframe:');
        const withoutCachedAnalysis = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_cached_analysis'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(withoutCachedAnalysis).not.toContain('Analysis vs now:');
    });

    it('웹검색 폴백 행은 web_search가 있을 때만 들어가고, 외국인 순매수 행은 없으면 no tool로 돌아간다', () => {
        const fallback =
            prompt
                .split('\n')
                .find(l => l.includes('Carve-out to the row above')) ?? '';
        for (const term of [
            'dividends (yield, DPS, ex-date)',
            'never derive a trailing yield from a single payment',
            'index membership (S&P 500, Nasdaq-100, Dow) that a SIGLENS tool returned as null or absent; earnings before/after-market timing that a get_fundamentals result in this conversation left without `earningsSession`',
            'cite the publisher and date',
            'never estimate',
            'web_search is refused (quota), say the figure could not be confirmed',
            'a confirmed non-payer is not null: say it pays no dividend',
        ])
            expect(fallback).toContain(term);
        expect(fallback).not.toContain('never decline');
        expect(prompt).toContain(
            'except the routing rows that explicitly send a topic to web_search (Korean investor-type net buying when krInvestorTrend is null or absent; the null-value fallback row; a commodity, futures or exchange-rate quote that is not on the get_macro_quotes list)'
        );
        expect(prompt).not.toContain('the only carve-out');
        const noSearch = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => t.name !== 'web_search'),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noSearch).not.toContain('Carve-out to the row above');
        expect(noSearch).toContain(
            'When `krInvestorTrend` is null or absent, say SIGLENS does not carry it'
        );
    });

    it('뉴스 공백 안내는 web_search 유무에 따라 한 번만 짧게', () => {
        expect(prompt).toContain('use web_search for the gap');
        const noSearch = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => t.name !== 'web_search'),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noSearch).not.toContain('web_search');
        expect(noSearch).toContain('SIGLENS news has nothing on it yet');
    });

    it('심볼 없는 발굴 질문은 시그널 스캔으로 보내고, 후보 검증에 새 분석을 쓰지 않게 한다', () => {
        expect(prompt).toContain(
            'Which sectors, stocks or coins are worth looking at now'
        );
        expect(prompt).toContain(
            'then get_bars_indicators for at most three of the flagged symbols'
        );
        expect(prompt).toContain(
            'never run a fresh analysis to screen candidates'
        );
        // 시장 선택은 의미로 지시한다 — 한국어 트리거 문구를 프롬프트에 심으면
        // 다른 언어 사용자의 같은 질문이 행에 걸리지 않는다.
        expect(prompt).toContain(
            "('kr' for Korean stocks, 'crypto' for coins, 'us' otherwise)"
        );
    });

    it('발굴 행은 get_bars_indicators가 없으면 스캔만 안내하고, get_market_overview가 없으면 사라진다', () => {
        const noBars = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_bars_indicators'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noBars).toContain(
            'Which sectors, stocks or coins are worth looking at now'
        );
        expect(noBars).not.toContain('at most three of the flagged symbols');

        const noOverview = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(
                t => t.name !== 'get_market_overview'
            ),
            now: NOW,
            etSessionStatus: 'open',
        });
        expect(noOverview).not.toContain(
            'Which sectors, stocks or coins are worth looking at now'
        );
    });
});

describe('buildAgentSystemPrompt analyst views and macro quotes', () => {
    const build = (names: readonly string[] | null): string =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools:
                names === null
                    ? AGENT_TOOL_SPECS
                    : AGENT_TOOL_SPECS.filter(t => !names.includes(t.name)),
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';

    it('목표가·투자의견 질문을 get_analyst_views로 보내고 한국어 트리거를 싣는다', () => {
        const row = rowOf(build(null), '→ get_analyst_views.');
        expect(row).toContain('목표가 상향/하향');
        expect(row).toContain('투자의견 변경');
        expect(row).toContain('애널리스트들이 뭐래');
        expect(row).toContain('Firm-by-firm changes exist for US stocks only');
    });

    it('get_analyst_views가 있으면 펀더멘털 행은 목표가 질문을 애널리스트 행으로 넘긴다', () => {
        const row = rowOf(build(null), '→ get_fundamentals.');
        expect(row).not.toContain('or analyst price targets of a stock');
        expect(row).toContain('matches the analyst row below');
    });

    it('get_analyst_views가 없으면 펀더멘털 행이 목표가 질문을 계속 받는다', () => {
        const prompt = build(['get_analyst_views']);
        expect(prompt).not.toContain('get_analyst_views');
        expect(rowOf(prompt, '→ get_fundamentals.')).toContain(
            'financial health or analyst price targets of a stock'
        );
    });

    it('미국 종목의 등락 이유 질문은 뉴스와 함께 애널리스트 뷰를 부르게 한다', () => {
        const row = rowOf(build(null), '→ get_news.');
        expect(row).toContain('왜 떨어졌어');
        expect(row).toContain('also call get_analyst_views in the same step');
        expect(
            rowOf(build(['get_analyst_views']), '→ get_news.')
        ).not.toContain('get_analyst_views');
    });

    it('두 출처 목표가가 다르면 둘 다 말하게 하고, 애널리스트 수는 Yahoo 수치에만 붙인다', () => {
        const prompt = build(null);
        expect(prompt).toContain(
            'give both figures with their source names (Yahoo Finance, FMP), give the analyst count only for the Yahoo Finance figure (the other carries none)'
        );
        expect(prompt).toContain('never average them, pick one');
    });

    it('변경 건수는 30·90일만 tally에서 가져오고, 다른 기간은 합계 없이 행을 나열하게 한다', () => {
        const prompt = build(null);
        expect(prompt).toContain(
            'over the last 30 or 90 days from actions.tally, never by counting rows'
        );
        expect(prompt).toContain(
            'for any other window list the dated rows inside it without giving a total'
        );
        expect(prompt).toContain(
            'say it coincided with the move, never that it caused it'
        );
    });

    it('등락 이유 행의 애널리스트 뷰 호출은 미국 기업 주식으로 한정한다', () => {
        expect(rowOf(build(null), '→ get_news.')).toContain(
            'not an ETF, an index or a coin'
        );
    });

    it('애널리스트 행동 규칙은 도구가 없으면 빠지고, 목표가 불일치 규칙은 펀더멘털만 있어도 남는다', () => {
        const prompt = build(['get_analyst_views']);
        expect(prompt).not.toContain('- Analyst actions:');
        expect(prompt).toContain('- Analyst price targets:');
        expect(build(['get_analyst_views', 'get_fundamentals'])).not.toContain(
            '- Analyst price targets:'
        );
    });

    it('원자재·선물·환율 질문을 get_macro_quotes로 보내고 ETF 대체를 금지한다', () => {
        const row = rowOf(build(null), '→ get_macro_quotes');
        for (const term of ['유가', '금값', '은값', '나스닥 선물', '엔화 환율'])
            expect(row).toContain(term);
        expect(row).toContain(
            'Never answer one of these with an ETF price or a web search'
        );
    });

    it('목록에 없는 환율·선물은 web_search 유무에 따라 검색하거나 없다고 말하게 한다', () => {
        expect(rowOf(build(null), '→ get_macro_quotes')).toContain(
            'use web_search instead, cite the publisher and the time of the quote'
        );
        const row = rowOf(build(['web_search']), '→ get_macro_quotes');
        expect(row).toContain('say SIGLENS does not carry that quote');
        expect(row).not.toContain('web_search instead');
    });

    it('선물 시세는 근월물이라고 말하게 하고, 지연은 0보다 클 때만 말하게 한다', () => {
        const prompt = build(null);
        expect(prompt).toContain(
            'whose contract is not null is the front-month futures price'
        );
        expect(prompt).toContain('when it is 0 or null do not mention a delay');
    });

    it('목록 밖 시세 검색을 web_search 행의 가격 금지 예외에 함께 올린다', () => {
        const row = rowOf(build(null), 'Never for prices, indicators');
        expect(row).toContain(
            'a commodity, futures or exchange-rate quote that is not on the get_macro_quotes list'
        );
        expect(rowOf(build(null), '→ get_macro_quotes')).toContain(
            'do not call get_macro_quotes with other instruments in its place'
        );
    });

    it('get_macro_quotes가 없으면 web_search 행의 예외 목록에 그 도구 이름이 없다', () => {
        const row = rowOf(
            build(['get_macro_quotes']),
            'Never for prices, indicators'
        );
        expect(row).toContain('the null-value fallback row).');
        expect(row).not.toContain('get_macro_quotes');
    });

    it('날짜가 확정되지 않은 실적은 시간대를 검색하지 않게 한다', () => {
        expect(rowOf(build(null), 'Carve-out to the row above')).toContain(
            'Do not search it either when that result carries `earningsDateAlt` or `earningsDateConfirmed` false'
        );
    });

    it('이력이 null인 시세 항목은 채우지 않고 빼게 한다', () => {
        expect(build(null)).toContain(
            'A null changes entry or a null range52w means that history is not available: leave it out, never fill it in.'
        );
    });

    it('get_macro_quotes가 없으면 행과 규칙이 모두 빠진다', () => {
        const without = build(['get_macro_quotes']);
        expect(without).not.toContain('get_macro_quotes');
        expect(without).not.toContain('- Commodity and futures quotes:');
    });

    it('실적 장전·장후는 get_fundamentals를 먼저 부르고 earningsSession이 없을 때만 검색하게 한다', () => {
        const row = rowOf(build(null), 'Carve-out to the row above');
        expect(row).toContain(
            'Earnings timing is never searched in the first step: call get_fundamentals first'
        );
        expect(row).toContain(
            '→ web_search, cite the publisher and date, never estimate'
        );
    });

    it('get_fundamentals가 없으면 실적 시간대는 바로 검색 대상이고 그 도구 이름을 싣지 않는다', () => {
        const row = rowOf(
            build(['get_fundamentals']),
            'Carve-out to the row above'
        );
        expect(row).toContain(
            'earnings before/after-market timing, which no SIGLENS tool provides'
        );
        expect(row).not.toContain('get_fundamentals');
    });

    it('게스트 안내의 새 기능 문구는 도구가 있을 때만 들어간다', () => {
        const guest = (names: readonly string[]): string =>
            buildAgentSystemPrompt({
                locale: 'ko',
                tools: AGENT_TOOL_SPECS.filter(t => !names.includes(t.name)),
                guest: true,
            });
        expect(guest(['get_analyst_views'])).not.toContain(
            'analyst targets and rating changes'
        );
        expect(guest(['get_macro_quotes'])).not.toContain(
            'commodity, futures and exchange-rate quotes'
        );
    });
});

describe('buildAgentSystemPrompt company filings', () => {
    const build = (names: readonly string[] | null, guest = false): string =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools:
                names === null
                    ? AGENT_TOOL_SPECS
                    : AGENT_TOOL_SPECS.filter(t => !names.includes(t.name)),
            guest,
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';

    it('회사 발표의 세부 질문을 get_company_filings로 보내고 한국어 트리거를 싣는다', () => {
        const row = rowOf(build(null), '→ get_company_filings');
        for (const term of [
            '공시 뭐 나왔어',
            '보도자료 원문',
            '실적 발표 내용',
            '매출로 잡혀?',
            '왜 순이익이 늘었어?',
        ])
            expect(row).toContain(term);
    });

    it('목록을 먼저 받고 다음 단계에서 본문을 읽는 두 단계 호출을 지시한다', () => {
        const row = rowOf(build(null), '→ get_company_filings');
        expect(row).toContain('without `accession` first');
        expect(row).toContain(
            'in the next step, call it again with the `accession`'
        );
    });

    it('미국 상장사 한정을 행 맨 앞에 두고 한국 종목·코인은 뉴스 행으로 보낸다', () => {
        const row = rowOf(build(null), '→ get_company_filings');
        expect(row.startsWith('- For a US-listed company only')).toBe(true);
        expect(row).toContain('use the news row for those');
    });

    it('get_news가 없으면 없는 뉴스 행을 가리키지 않는다', () => {
        const row = rowOf(build(['get_news']), '→ get_company_filings');
        expect(row).not.toContain('news row');
        expect(row).toContain('answer those from the other matching rows');
    });

    it('회사 발표는 첫 단계에서 web_search를 부르지 않게 한다', () => {
        const row = rowOf(build(null), '→ get_company_filings');
        expect(row).toContain(
            'never call web_search in the first step: list and read the filing first'
        );
        expect(rowOf(build(null), 'Never for prices, indicators')).toContain(
            'neither the news tool nor a company filing covers'
        );
    });

    it('web_search가 없으면 공시 행이 그 도구 이름을 싣지 않는다', () => {
        const row = rowOf(build(['web_search']), '→ get_company_filings');
        expect(row).not.toContain('web_search');
    });

    it('get_company_filings가 없으면 web_search 행은 기존 문구로 돌아간다', () => {
        expect(
            rowOf(
                build(['get_company_filings']),
                'Never for prices, indicators'
            )
        ).toContain('corporate events the news tool lacks');
    });

    it('도구가 없으면 행과 게스트 문구가 모두 빠진다', () => {
        const without = build(['get_company_filings'], true);
        expect(without).not.toContain('get_company_filings');
        expect(without).not.toContain('company SEC filings');
    });

    it('근월물을 전월물로 옮기지 않게 한국어 표기를 적어 둔다', () => {
        expect(rowOf(build(null), '- Commodity and futures quotes:')).toContain(
            '근월물 in Korean, never 전월물'
        );
    });
});

describe('buildAgentSystemPrompt X posts', () => {
    const build = (names: readonly string[] | null, guest = false): string =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools:
                names === null
                    ? AGENT_TOOL_SPECS
                    : AGENT_TOOL_SPECS.filter(t => !names.includes(t.name)),
            guest,
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';

    it('X를 명시한 질문과 한 회사의 "요즘 소식" 질문을 get_x_posts로 보내고, 시세·전망·등락 이유·여러 종목·시장 전체는 뺀다', () => {
        const row = rowOf(build(null), '→ get_x_posts');
        for (const term of [
            'CEO가 X에 뭐라고 올렸어',
            '최근 트윗',
            '트위터에서 뭐래',
            'what is new with one specific company lately',
            '테슬라 요즘 무슨 소식 있어?',
            '회사가 직접 올린 거 있어?',
            'call it in the same step as get_news',
            'never the only basis of the answer',
            'on an earnings call, in an interview or in a filing matches the other rows',
        ])
            expect(row).toContain(term);
        expect(row).toContain(
            'It is not called for a stock\'s price, chart, valuation, outlook or "why did it move" question, for several stocks at once or for the market as a whole'
        );
        // No venue and no "what is new" → not this row (it would bill an X read for a filing question).
        expect(row).not.toContain('CEO가 뭐라고 했어');
    });

    it('X 행과 get_x_posts 설명은 같은 "요즘 소식" 예시와 뉴스 동반 호출을 말한다(한쪽만 바뀌지 않게)', () => {
        const row = rowOf(build(null), '→ get_x_posts');
        const description =
            AGENT_TOOL_SPECS.find(spec => spec.name === 'get_x_posts')
                ?.description ?? '';
        for (const example of ['무슨 소식 있어', '근황', '회사가 직접 올린 거'])
            for (const text of [row, description])
                expect(text).toContain(example);
        expect(row).toContain('in the same step as get_news');
        expect(description).toContain('together with the news tool');
        // 공시·보도자료로 "밝힌" 내용은 공시 행의 몫이다 — 이 표현을 트리거로 쓰지 않는다.
        for (const text of [row, description])
            expect(text).not.toContain('직접 밝힌');
    });

    it('뉴스·등락 이유 행은 get_x_posts를 가리키지 않는다', () => {
        const prompt = build(null);
        const newsRows = prompt
            .split('\n')
            .filter(l => l.includes('→ get_news'));
        // An empty match would make the negative assertion pass on nothing.
        expect(newsRows.length).toBeGreaterThan(0);
        for (const row of newsRows) expect(row).not.toContain('get_x_posts');
    });

    it('도구가 없으면 행과 게스트 문구가 모두 빠진다', () => {
        const without = build(['get_x_posts'], true);
        expect(without).not.toContain('get_x_posts');
        expect(without).not.toContain('official company and CEO posts on X');
    });
});

describe('buildAgentSystemPrompt wording rules', () => {
    const prompt = buildAgentSystemPrompt({
        locale: 'ko',
        tools: AGENT_TOOL_SPECS,
        now: NOW,
        etSessionStatus: 'open',
    });

    it('anchors the RSI zone to latest.rsiZone', () => {
        expect(prompt).toContain(
            'use latest.rsiZone for RSI (neutral between 30 and 70)'
        );
        expect(prompt).toContain(
            'give no zone word to a reading whose computed zone is neutral'
        );
    });
});

describe('buildAgentSystemPrompt — 테마·지수 통계 라우팅', () => {
    const build = (without: readonly string[]) =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => !without.includes(t.name)),
            now: NOW,
            etSessionStatus: 'open',
            guest: false,
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';

    it('테마 질문은 get_theme_snapshot, 이유를 물으면 같은 단계에서 get_news를 함께', () => {
        const row = rowOf(build([]), '→ get_theme_snapshot');
        for (const term of [
            '양자 테마 분위기',
            '네오클라우드 매도세',
            '방산주',
        ])
            expect(row).toContain(term);
        expect(row).toContain(
            'call get_theme_snapshot first and then, in the next step, get_news for the best and worst names'
        );
        expect(row).toContain('SIGLENS has no basket for that theme');
        expect(row).toContain(
            'not even with a neighbouring theme as a stand-in'
        );
        expect(
            rowOf(build(['get_news']), '→ get_theme_snapshot')
        ).not.toContain('get_news');
    });

    it('과거·계절 통계는 get_index_history_stats, 표본 수 인용·예측 금지', () => {
        const row = rowOf(build([]), '→ get_index_history_stats');
        for (const term of [
            '중간선거 뒤 상승장',
            '9월은 원래 약해?',
            '연말 랠리',
        ])
            expect(row).toContain(term);
        expect(row).toContain('never turn the past into a forecast');
        expect(row).toContain('sp500 when the question names no index');
    });

    it('조정·상승 구간 질문은 get_swing_history, 직접 세기·예측 금지, 기준은 설명과 같은 문구', () => {
        const row = rowOf(build([]), '→ get_swing_history');
        for (const term of [
            '월봉 조정 기간',
            'for a whole index pass its tracking ETF',
            SWING_THRESHOLD_GUIDE,
            SWING_TRIGGER_EXAMPLES,
        ])
            expect(row).toContain(term);
        expect(row).toContain(
            'Never count past swings from bars yourself while this tool is available'
        );
        expect(row).toContain(
            'quote afterThisAge as a past distribution, never as a date'
        );
        expect(row).toContain(
            'never turn the past into a forecast of when the current leg ends'
        );
        const description =
            findToolSpec('get_swing_history')?.description ?? '';
        expect(description).toContain(SWING_THRESHOLD_GUIDE);
        expect(description).toContain(SWING_TRIGGER_EXAMPLES);
    });

    it('지수 통계 행은 스윙 기간 질문을 스윙 행으로 넘긴다(스윙 도구가 있을 때만)', () => {
        const carveOut =
            'How long declines or rallies of an index last is not this row';
        expect(rowOf(build([]), '→ get_index_history_stats')).toContain(
            carveOut
        );
        const withoutSwing = rowOf(
            build(['get_swing_history']),
            '→ get_index_history_stats'
        );
        expect(withoutSwing).toContain('9월은 원래 약해?');
        expect(withoutSwing).not.toContain(carveOut);
    });

    it('도구가 없으면 행이 빠진다', () => {
        const prompt = build([
            'get_theme_snapshot',
            'get_index_history_stats',
            'get_swing_history',
        ]);
        expect(prompt).not.toContain('get_swing_history');
        expect(prompt).not.toContain('past declines and rallies');
        expect(prompt).not.toContain('get_theme_snapshot');
        expect(prompt).not.toContain('get_index_history_stats');
        expect(prompt).not.toContain('theme baskets');
    });
});

describe('buildAgentSystemPrompt — 추정치 추이 라우팅', () => {
    it('실적 추정치 변화 질문은 get_analyst_views로 보낸다', () => {
        const prompt = buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS,
            now: NOW,
            etSessionStatus: 'open',
            guest: false,
        });
        const row =
            prompt.split('\n').find(l => l.includes('→ get_analyst_views.')) ??
            '';
        for (const term of [
            '실적 추정치 올라가?',
            'EPS 전망 바뀌었어?',
            '컨센서스 변화',
        ])
            expect(row).toContain(term);
        expect(row).toContain('the estimate trend');
    });
});

describe('buildAgentSystemPrompt — computed facts, basis date, no offered lookups, turn note', () => {
    const build = (
        locale: 'ko' | 'en' = 'ko',
        without: readonly string[] = []
    ) =>
        buildAgentSystemPrompt({
            locale,
            tools: AGENT_TOOL_SPECS.filter(t => !without.includes(t.name)),
            guest: true,
        });

    it('overbought / oversold is triggered by the question or the answer, not by the result carrying a field', () => {
        const p = build();
        expect(p).toContain(
            '- Overbought / oversold: applies when the question asks whether something is overbought or oversold, or when your answer is about to call any reading overbought, oversold or "near" either.'
        );
        expect(p).toContain(
            'To answer the question itself, use the whole summary line, never RSI alone'
        );
        expect(p).toContain(
            'at the Plain level its counts are enough and the names you give stay within the two or three indicators allowed there'
        );
        expect(p).not.toContain('- RSI zone:');
        expect(p).not.toContain('carries latest.oscillatorSummary');
    });

    it('the oscillator rule leaves with get_bars_indicators', () => {
        expect(build('ko', ['get_bars_indicators'])).not.toContain(
            'latest.oscillatorSummary'
        );
    });

    it('the Korean net-buying row keeps its no-search limit that the second-call rule defers to', () => {
        expect(build()).toContain(
            'never for a general 수급 or outlook/buy question'
        );
    });
});

describe('buildAgentSystemPrompt computed-fact rules (WP-08)', () => {
    const build = (without: readonly string[] = []): string =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => !without.includes(t.name)),
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';

    it('the re-call rule counts a second get_investor_flows call with holder', () => {
        const p = build();
        expect(p).toContain(
            'a tool call you have not made this turn could supply it (get_investor_flows with holder for a named holder missing from the holders list'
        );
        expect(p).not.toContain('a tool you have not called for it this turn');
        const noFlows = build(['get_investor_flows']);
        expect(noFlows).toContain(
            'a tool call you have not made this turn could supply it (a period the first call did not cover)'
        );
    });

    it('the investor-flows row asks for holder in the first call', () => {
        const row = rowOf(build(), '→ get_investor_flows.');
        expect(row).toContain('pass holder in the first call');
        expect(row).toContain('블랙록은 몇 주 갖고 있어?');
        expect(row).toContain('그 펀드가 몇 주 갖고 있어?');
    });

    it('the news row asks for since, and the bars pairing only when bars exist', () => {
        const row = rowOf(build(), '→ get_news.');
        expect(row).toContain('Pass since as the start of the period');
        expect(row).toContain('also call get_bars_indicators in the same step');
        const noBars = rowOf(build(['get_bars_indicators']), '→ get_news.');
        expect(noBars).toContain('Pass since as the start of the period');
        expect(noBars).not.toContain('get_bars_indicators');
    });

    it('the news-causality bullet appears only with get_news', () => {
        expect(build()).toContain(
            "- Explaining a move with news: tie a completed session's move only to headlines whose session is that date or an earlier date in the window"
        );
        expect(build()).toContain(
            "it can bear on today's move in progress, never on an earlier session's move"
        );
        expect(build(['get_news'])).not.toContain(
            'Explaining a move with news'
        );
    });
});

describe('buildAgentSystemPrompt price statistics routing (WP-09)', () => {
    const build = (without: readonly string[] = []): string =>
        buildAgentSystemPrompt({
            locale: 'ko',
            tools: AGENT_TOOL_SPECS.filter(t => !without.includes(t.name)),
            guest: true,
        });
    const rowOf = (prompt: string, needle: string): string =>
        prompt.split('\n').find(l => l.includes(needle)) ?? '';
    const CHART_MIRROR =
        'A return, a closing high or low, or a drawdown over a stated calendar window, a calendar year or since a date matches the price statistics row; the 52-week high or low (52주 최고가) and 20- or 60-session highs and lows stay with this row.';
    const INDEX_MIRROR =
        'A named recent window or one calendar year of an index (올해, 작년 한 해, 최근 10년), its close on a date and its deepest daily drop in such a window are the price statistics row.';
    const SWINGS_TAIL =
        'How often, how deep on average or how long declines or rallies run is the swings row; the single deepest drop in one window is this row.';
    const INDEX_TAIL =
        "An index's year-by-year, monthly or election-cycle history is the index statistics row.";

    it('the row routes period statistics to get_price_stats with its triggers and the no-own-arithmetic ban', () => {
        const row = rowOf(build(), '→ get_price_stats');
        for (const term of [
            '올해 수익률',
            '연초 대비',
            '작년 수익률',
            '2022년 수익률',
            '10년 연평균 수익률',
            '올해 최대 낙폭',
            'MDD',
            '작년 마지막 거래일 종가',
            '상관관계',
            '같이 움직여?',
            'with every subject of the question in one call',
            '(index for the S&P 500, Nasdaq Composite, KOSPI or KOSDAQ themselves)',
            'More than three subjects go in parallel calls of up to three in the same step; a correlation comes only for two subjects in the same call.',
            'Quote each return with its base and end dates and say once that it is a closing-price change (without dividends for a stock, ETF or index; for a coin just a closing-price change)',
            'A question relative to this time last year or N months ago (작년 이맘때 대비, N개월 전 대비, 1년 전보다) passes period (1m, 3m, 6m or 1y), never from.',
            "today's move and the current price stay with the quote row",
            'Never compute a period return, an annual rate, a drawdown or a correlation from bars yourself while this tool is available.',
        ])
            expect(row).toContain(term);
    });

    it('the row comes directly after the chart row and the row is absent without the tool', () => {
        const lines = build().split('\n');
        const chart = lines.findIndex(l =>
            l.includes('→ get_bars_indicators;')
        );
        const stats = lines.findIndex(l => l.includes('→ get_price_stats'));
        expect(chart).toBeGreaterThan(-1);
        expect(stats).toBe(chart + 1);
        const without = build(['get_price_stats']);
        expect(without).not.toContain('get_price_stats');
        expect(without).not.toContain('price statistics row');
        expect(without).not.toContain('price statistics over any period');
    });

    it('the swings and index tails render only with their own tools', () => {
        const row = (without: readonly string[]) =>
            rowOf(build(without), '→ get_price_stats');
        expect(row([])).toContain(SWINGS_TAIL);
        expect(row([])).toContain(INDEX_TAIL);
        expect(row(['get_swing_history'])).not.toContain(SWINGS_TAIL);
        expect(row(['get_swing_history'])).toContain(INDEX_TAIL);
        expect(row(['get_index_history_stats'])).not.toContain(INDEX_TAIL);
        expect(row(['get_index_history_stats'])).toContain(SWINGS_TAIL);
        expect(
            row(['get_swing_history', 'get_index_history_stats'])
        ).not.toMatch(/swings row|index statistics row/);
    });

    it('the chart and index rows hand period questions over only with get_price_stats', () => {
        const chart = (without: readonly string[]) =>
            rowOf(build(without), '→ get_bars_indicators;');
        const index = (without: readonly string[]) =>
            rowOf(build(without), '→ get_index_history_stats');
        expect(chart([])).toContain(CHART_MIRROR);
        expect(chart(['get_price_stats'])).not.toContain(CHART_MIRROR);
        expect(chart(['get_price_stats'])).toContain(
            'A Korean outlook question (전망, 오를까, 떨어질까, 반등할까) matches the outlook row above'
        );
        expect(index([])).toContain(INDEX_MIRROR);
        expect(index(['get_price_stats'])).not.toContain(INDEX_MIRROR);
        // The long-run table statistic stays on the index row.
        expect(index([])).toContain('평균 연간 수익률');
    });

    it('the guest line names price statistics only with the tool', () => {
        expect(build()).toContain(
            'past declines and rallies of a symbol, price statistics over any period, web search'
        );
        expect(build(['get_price_stats'])).not.toContain(
            'price statistics over any period'
        );
    });

    it('the computed-figures rule lists the price statistics fields', () => {
        expect(build()).toContain(
            'price statistics returnPct/cagrPct/fromHighestClosePct/maxDrawdown/correlation coefficient'
        );
    });
});
