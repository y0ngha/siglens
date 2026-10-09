import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
    EMAIL_REPORT_MAX_SYMBOLS,
} from '@/entities/email-report/lib/emailReportConstants';
import type {
    SymbolBrief,
    SymbolReport,
} from '@/entities/email-report/reportModel';
import {
    buildReportEmail,
    REPORT_EMAIL_MAX_HTML_BYTES,
    type BuildReportEmailInput,
    type ReportEmailTranslator,
    type SignalLabelResolver,
} from '@/entities/email-report/templates/reportEmail';

/** 키와 인자를 그대로 드러내는 번역자 — 어떤 키가 쓰였는지 단언할 수 있다. */
const t: ReportEmailTranslator = (key, values) =>
    values ? `${key}(${Object.values(values).join(',')})` : key;
/** 타입 이름을 그대로 라벨로 돌려주는 리졸버. */
const signalLabel: SignalLabelResolver = type => type;

const REPORT: SymbolReport = {
    symbol: 'AAPL',
    technical: {
        summary: '추세 <강함>',
        trend: 'bullish',
        patterns: ['컵앤핸들'],
    },
    plain: '첫 문단\n\n둘째 문단',
    news: [
        {
            title: 'Apple & "AI" <script>',
            summary: '요약입니다',
            sentiment: 'bullish',
            url: 'https://news.example.com/a?x=1&y=2',
            source: 'Reuters',
            publishedAt: '2026-10-07T00:00:00Z',
        },
        {
            title: '위험한 링크',
            summary: null,
            sentiment: null,
            url: 'javascript:alert(1)',
            source: 'Unknown',
            publishedAt: '2026-10-06T00:00:00Z',
        },
    ],
    options: {
        expirationDate: '2026-10-16',
        putCallRatio: 0.8234,
        atmImpliedVolatility: 0.312,
        impliedMovePercent: 4.44,
        summary: '콜 수요 우세',
    },
    analyzedAt: '2026-10-07T21:00:00Z',
};

const BRIEF: SymbolBrief = {
    symbol: 'AAPL',
    close: 180.5,
    changePercent: 1.234,
    trend: 'uptrend',
    signals: {
        score: 72,
        bullish: [
            'macd_bullish_cross',
            'bollinger_lower_bounce',
            'dmi_bullish_cross',
            'golden_cross',
        ],
        bearish: ['rsi_overbought'],
        fresh: ['dmi_bullish_cross'],
        pullback: 'washoutInUptrend',
    },
};

function briefOf(
    symbol: string,
    overrides: Partial<SymbolBrief> = {}
): SymbolBrief {
    return { ...BRIEF, symbol, ...overrides };
}

const INPUT: BuildReportEmailInput = {
    to: 'member@example.com',
    locale: 'ko',
    localDate: '2026-10-08',
    sections: [
        {
            report: REPORT,
            brief: BRIEF,
            chartUrl: 'https://siglens.io/api/email-report/chart?s=AAPL&sig=x',
            pageUrl: 'https://siglens.io/AAPL?utm_source=email',
        },
    ],
    briefRows: [],
    unsubscribePageUrl: 'https://siglens.io/email-report/unsubscribe?u=1',
    unsubscribeApiUrl: 'https://siglens.io/api/email-report/unsubscribe?u=1',
    settingsUrl: 'https://siglens.io/email-report',
    t,
    signalLabel,
};

describe('buildReportEmail', () => {
    it('수신자·제목(사이트명·현지 날짜)을 채운다', () => {
        const email = buildReportEmail(INPUT);

        expect(email.to).toBe('member@example.com');
        expect(email.subject).toBe('subject(SIGLENS,10월 8일)');
    });

    it('원클릭 수신거부 헤더를 단다', () => {
        expect(buildReportEmail(INPUT).headers).toEqual({
            'List-Unsubscribe':
                '<https://siglens.io/api/email-report/unsubscribe?u=1>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        });
    });

    it('외부 문자열(뉴스 제목·AI 산문·URL)을 이스케이프한다', () => {
        const { html } = buildReportEmail(INPUT);

        expect(html).not.toContain('<script>');
        expect(html).toContain('Apple &amp; &quot;AI&quot; &lt;script&gt;');
        expect(html).toContain('추세 &lt;강함&gt;');
        expect(html).toContain('href="https://news.example.com/a?x=1&amp;y=2"');
    });

    it('http(s)가 아닌 기사 URL은 링크로 걸지 않는다', () => {
        const { html, text } = buildReportEmail(INPUT);

        expect(html).not.toContain('javascript:');
        expect(html).toContain('위험한 링크');
        expect(text).not.toContain('javascript:');
    });

    it('차트 이미지를 종목 페이지 링크로 감싸고 alt를 단다', () => {
        const { html } = buildReportEmail(INPUT);

        expect(html).toContain(
            '<a href="https://siglens.io/AAPL?utm_source=email"><img src="https://siglens.io/api/email-report/chart?s=AAPL&amp;sig=x"'
        );
        expect(html).toContain('alt="chartAlt(AAPL)"');
    });

    it('쉽게보기·차트 분석·패턴·뉴스·옵션 섹션을 모두 싣고 산문 문단을 나눈다', () => {
        const { html } = buildReportEmail(INPUT);

        for (const key of [
            'sectionPlain',
            'sectionTechnical',
            'sectionPatterns',
            'sectionNews',
            'sectionOptions',
        ]) {
            expect(html).toContain(key);
        }
        expect(html).toContain('>첫 문단</p>');
        expect(html).toContain('>둘째 문단</p>');
        expect(html).toContain('[sentiment.bullish]');
    });

    it('옵션 지표를 사람이 읽는 형식으로 적는다', () => {
        const { text } = buildReportEmail(INPUT);

        expect(text).toContain('optionsPutCall: 0.82');
        expect(text).toContain('optionsIv: 31.2%');
        expect(text).toContain('optionsMove(2026-10-16): ±4.4%');
    });

    it('분석이 없는 종목은 안내 문구를 싣고 분석 섹션은 뺀다', () => {
        const { html } = buildReportEmail({
            ...INPUT,
            sections: [
                {
                    ...INPUT.sections[0]!,
                    report: {
                        ...REPORT,
                        technical: null,
                        plain: null,
                        analyzedAt: null,
                    },
                },
            ],
        });

        expect(html).toContain('noAnalysis');
        expect(html).not.toContain('sectionTechnical');
        expect(html).not.toContain('sectionPlain');
    });

    it('옵션 데이터가 없으면 옵션 섹션을 뺀다', () => {
        const { html } = buildReportEmail({
            ...INPUT,
            sections: [
                {
                    ...INPUT.sections[0]!,
                    report: { ...REPORT, options: null },
                },
            ],
        });

        expect(html).not.toContain('sectionOptions');
    });

    it('고지문과 수신 설정·수신거부 링크를 본문과 텍스트 양쪽에 싣는다', () => {
        const { html, text } = buildReportEmail(INPUT);

        expect(html).toContain('disclaimer');
        expect(html).toContain(
            'href="https://siglens.io/email-report/unsubscribe?u=1"'
        );
        expect(html).toContain('href="https://siglens.io/email-report"');
        expect(text).toContain('disclaimer');
        expect(text).toContain(
            'unsubscribe: https://siglens.io/email-report/unsubscribe?u=1'
        );
    });

    it('html lang을 메일 로케일로 둔다', () => {
        expect(buildReportEmail({ ...INPUT, locale: 'ja' }).html).toContain(
            '<html lang="ja">'
        );
    });

    describe('카드의 신호 요약 한 줄', () => {
        it('점수·방향별 개수와 라벨(최대 3개 + "+N")·새로 켜짐·눌림목을 한 줄로 적는다', () => {
            const { html, text } = buildReportEmail(INPUT);

            expect(html).toContain('signalScore(72)');
            expect(html).toContain(
                'signalBullish(4) (macd_bullish_cross, bollinger_lower_bounce, dmi_bullish_cross, signalMore(1))'
            );
            expect(html).toContain('signalBearish(1) (rsi_overbought)');
            expect(html).toContain('signalFresh(dmi_bullish_cross)');
            expect(html).toContain('signalPullback(pullback.washoutInUptrend)');
            expect(text).toContain('signalScore(72)');
        });

        it('새로 켜짐 라벨도 최대 개수까지만 적고 나머지는 "+N"으로 줄인다', () => {
            const fresh = ['t1', 't2', 't3', 't4', 't5', 't6'];
            const { html, text } = buildReportEmail({
                ...INPUT,
                sections: [
                    {
                        ...INPUT.sections[0]!,
                        brief: briefOf('AAPL', {
                            signals: { ...BRIEF.signals!, fresh },
                        }),
                    },
                ],
            });

            expect(html).toContain('signalFresh(t1, t2, t3, signalMore(3))');
            expect(html).not.toContain('t4');
            expect(text).toContain('signalFresh(t1, t2, t3, signalMore(3))');
        });

        it('보류(score null)는 "—" 키로 적고 중립 점수를 꾸미지 않는다', () => {
            const { html } = buildReportEmail({
                ...INPUT,
                sections: [
                    {
                        ...INPUT.sections[0]!,
                        brief: briefOf('AAPL', {
                            signals: { ...BRIEF.signals!, score: null },
                        }),
                    },
                ],
            });

            expect(html).toContain('signalAbstain');
            expect(html).not.toContain('signalScore(');
        });

        it('데이터가 없으면(signals null) 줄 자체를 생략한다', () => {
            const { html } = buildReportEmail({
                ...INPUT,
                sections: [
                    {
                        ...INPUT.sections[0]!,
                        brief: briefOf('AAPL', { signals: null, trend: null }),
                    },
                ],
            });

            expect(html).not.toContain('signalScore');
            expect(html).not.toContain('signalAbstain');
            expect(html).not.toContain('briefNoData');
        });

        it('사전에 없는 타입은 라벨도 개수도 빠진다', () => {
            const { html } = buildReportEmail({
                ...INPUT,
                signalLabel: type => (type === 'golden_cross' ? null : type),
            });

            expect(html).toContain('signalBullish(3)');
            expect(html).not.toContain('golden_cross');
        });
    });

    describe('그 외 관심종목 표', () => {
        const rows = [
            {
                brief: briefOf('TSLA'),
                pageUrl:
                    'https://siglens.io/TSLA?utm_source=email&utm_medium=email&utm_campaign=email_report',
            },
            {
                brief: briefOf('NVDA', {
                    signals: null,
                    trend: null,
                    close: null,
                    changePercent: null,
                }),
                pageUrl:
                    'https://siglens.io/NVDA?utm_source=email&utm_medium=email&utm_campaign=email_report',
            },
        ];

        it('행이 없으면 섹션을 생략한다', () => {
            const { html, text } = buildReportEmail(INPUT);

            expect(html).not.toContain('sectionBrief');
            expect(text).not.toContain('sectionBrief');
        });

        it('종목 링크(UTM)·종가/등락률·추세·신호 요약을 행마다 적고, 데이터 없는 행은 안내 문구를 둔다', () => {
            const { html, text } = buildReportEmail({
                ...INPUT,
                briefRows: rows,
            });

            expect(html).toContain('sectionBrief');
            expect(html).toContain(
                'href="https://siglens.io/TSLA?utm_source=email&amp;utm_medium=email&amp;utm_campaign=email_report"'
            );
            expect(html).toContain('180.5');
            expect(html).toContain('+1.23%');
            expect(html).toContain('trendState.uptrend');
            expect(html).toContain('briefNoData');
            expect(text).toContain('TSLA');
            expect(text).toContain('briefNoData');
        });

        it('음수 등락률은 부호를 그대로 적는다', () => {
            const { html } = buildReportEmail({
                ...INPUT,
                briefRows: [
                    {
                        ...rows[0]!,
                        brief: briefOf('TSLA', { changePercent: -2.5 }),
                    },
                ],
            });

            expect(html).toContain('-2.50%');
        });
    });

    it('컨플루언스 설명 각주를 본문과 텍스트에 싣는다', () => {
        const { html, text } = buildReportEmail(INPUT);

        expect(html).toContain('confluenceNote');
        expect(text).toContain('confluenceNote');
    });

    it('컨플루언스 줄이 하나도 없으면 각주를 싣지 않는다', () => {
        const { html, text } = buildReportEmail({
            ...INPUT,
            sections: [
                {
                    ...INPUT.sections[0]!,
                    brief: briefOf('AAPL', { signals: null, trend: null }),
                },
            ],
        });

        expect(html).not.toContain('confluenceNote');
        expect(text).not.toContain('confluenceNote');
    });

    it('요약 표 머리글은 열 범위를 알리고 표를 장식용으로 숨기지 않는다', () => {
        const { html } = buildReportEmail({
            ...INPUT,
            briefRows: [
                { brief: briefOf('TSLA'), pageUrl: 'https://siglens.io/TSLA' },
            ],
        });

        expect(html).toContain('<th scope="col"');
        expect(html).not.toContain('role="presentation"');
    });

    it(`${EMAIL_REPORT_MAX_SYMBOLS} 카드 + ${EMAIL_REPORT_MAX_BRIEF_SYMBOLS} 행 픽스처가 HTML 크기 상한 안에 든다`, () => {
        const symbols = (n: number, prefix: string) =>
            Array.from({ length: n }, (_, i) => `${prefix}${i}`);
        const { html } = buildReportEmail({
            ...INPUT,
            sections: symbols(EMAIL_REPORT_MAX_SYMBOLS, 'FULL').map(symbol => ({
                report: { ...REPORT, symbol },
                brief: briefOf(symbol),
                chartUrl: `https://siglens.io/api/email-report/chart?s=${symbol}&d=2026-10-08&sig=${'a'.repeat(64)}`,
                pageUrl: `https://siglens.io/${symbol}?utm_source=email&utm_medium=email&utm_campaign=email_report`,
            })),
            briefRows: symbols(EMAIL_REPORT_MAX_BRIEF_SYMBOLS, 'BRIEF').map(
                symbol => ({
                    brief: briefOf(symbol),
                    pageUrl: `https://siglens.io/${symbol}?utm_source=email&utm_medium=email&utm_campaign=email_report`,
                })
            ),
        });

        expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(
            REPORT_EMAIL_MAX_HTML_BYTES
        );
    });

    describe('실제 ko 카탈로그로 렌더한 메일', () => {
        const ko = JSON.parse(
            readFileSync(resolve(process.cwd(), 'messages/ko.json'), 'utf8')
        ) as {
            entities: { 'email-report': { email: Record<string, unknown> } };
            shared: { enumLabel: { signalType: Record<string, string> } };
        };
        const emailMessages = ko.entities['email-report'].email;
        const signalTypes = ko.shared.enumLabel.signalType;

        /** 중첩 키(`pullback.washoutInUptrend`)를 따라가고 `{v0}`를 채우는 최소 번역자. */
        const realT: ReportEmailTranslator = (key, values) => {
            const raw = key
                .split('.')
                .reduce<unknown>(
                    (node, part) => (node as Record<string, unknown>)[part],
                    emailMessages
                );
            let out = String(raw);
            for (const [name, value] of Object.entries(values ?? {})) {
                out = out.replaceAll(`{${name}}`, value);
            }
            return out;
        };
        const realLabel: SignalLabelResolver = type =>
            signalTypes[type] ?? null;
        const allTypes = Object.keys(signalTypes);
        const FORBIDDEN = /(?<!과)매수|(?<!과)매도|진입|청산|트리거/;

        it('모든 신호 타입·눌림목 판독을 실어도 매수·매도·진입·청산·트리거 문구가 없다', () => {
            const readings = [
                'washoutInUptrend',
                'nearWashoutInUptrend',
                'washoutBelowMa200',
            ] as const;
            const { html, text } = buildReportEmail({
                ...INPUT,
                t: realT,
                signalLabel: realLabel,
                briefRows: readings.map((pullback, i) => ({
                    brief: briefOf(`R${i}`, {
                        signals: {
                            score: 92,
                            bullish: allTypes,
                            bearish: allTypes,
                            fresh: allTypes,
                            pullback,
                        },
                    }),
                    pageUrl: `https://siglens.io/R${i}`,
                })),
            });

            expect(allTypes.length).toBeGreaterThan(30);
            // 렌더된 목록은 3개로 잘리므로 사전의 모든 라벨을 직접 검사한다.
            for (const type of allTypes) {
                expect(realLabel(type)).not.toMatch(FORBIDDEN);
            }
            for (const body of [html, text]) {
                // 지표 상태 라벨 "과매수·과매도"(overbought/oversold)는 행동 권고가 아니므로 "과" 뒤는 제외한다.
                expect(body).not.toMatch(FORBIDDEN);
            }
            expect(html).toContain('그 외 관심종목');
            expect(html).toContain('상승추세 내 단기 과매도');
        });
    });
});
