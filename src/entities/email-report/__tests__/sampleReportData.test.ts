import {
    REPORT_UNSUBSCRIBE_API_PATH,
    REPORT_UNSUBSCRIBE_PAGE_PATH,
} from '@/entities/email-report/lib/reportLinks';
import {
    buildSampleBars,
    buildSampleChartMa,
    buildSampleReportEmailInput,
    isSampleChartSymbol,
    SAMPLE_CHART_SYMBOLS,
    SAMPLE_REPORT_DATE,
    sampleChartUrl,
} from '@/entities/email-report/lib/sampleReportData';
import {
    buildReportEmail,
    REPORT_EMAIL_MAX_HTML_BYTES,
    type ReportEmailTranslator,
    type SignalLabelResolver,
} from '@/entities/email-report/templates/reportEmail';

/** 키와 인자를 그대로 드러내는 번역자 — 어떤 키가 쓰였는지 단언할 수 있다. */
const t: ReportEmailTranslator = (key, values) =>
    values ? `${key}(${Object.values(values).join(',')})` : key;
const signalLabel: SignalLabelResolver = type => type;
const sampleText = (key: string) => `prose:${key}`;

function buildMessage(locale: 'ko' | 'en' = 'ko') {
    return buildReportEmail(
        buildSampleReportEmailInput({
            locale,
            t,
            signalLabel,
            sampleText,
            siteUrl: 'https://siglens.io',
        })
    );
}

describe('buildSampleBars', () => {
    it('같은 심볼은 호출마다 같은 봉을 만든다', () => {
        expect(buildSampleBars('NVDA')).toEqual(buildSampleBars('NVDA'));
    });

    it('심볼마다 다른 봉을 만든다', () => {
        expect(buildSampleBars('NVDA')).not.toEqual(buildSampleBars('AAPL'));
    });

    it('샘플 발송일에 끝나는 주말 없는 일봉이다', () => {
        for (const symbol of SAMPLE_CHART_SYMBOLS) {
            const bars = buildSampleBars(symbol);
            const days = bars.map(b => new Date(b.time * 1_000));

            expect(days.at(-1)!.toISOString().slice(0, 10)).toBe(
                SAMPLE_REPORT_DATE
            );
            expect(days.some(d => [0, 6].includes(d.getUTCDay()))).toBe(false);
            expect(
                bars.every((b, i) => i === 0 || b.time > bars[i - 1]!.time)
            ).toBe(true);
        }
    });

    it('봉마다 고가가 최고, 저가가 최저다', () => {
        const bars = buildSampleBars('AAPL');

        expect(
            bars.every(
                b =>
                    b.high >= Math.max(b.open, b.close) &&
                    b.low <= Math.min(b.open, b.close) &&
                    b.low > 0
            )
        ).toBe(true);
    });

    describe('샘플 산문의 수치·방향 주장이 봉에서 그대로 나온다', () => {
        const MA_SLOPE_BARS = 10;
        const SHORT_SLOPE_BARS = 5;
        const SIX_WEEKS = 30;
        const TWO_MONTHS = 42;

        function view(symbol: 'NVDA' | 'AAPL') {
            const bars = buildSampleBars(symbol);
            const ma = buildSampleChartMa(bars);
            const n = bars.length;
            const maAt = (period: 20 | 60, back = 0) =>
                ma[period]![n - 1 - back]!;
            const high = (list: typeof bars) =>
                Math.max(...list.map(b => b.high));
            const low = (list: typeof bars) =>
                Math.min(...list.map(b => b.low));
            return { bars, n, maAt, high, low, close: bars.at(-1)!.close };
        }

        it('NVDA: 종가가 20일선·60일선 위, 20일선이 60일선 위, 두 선 모두 우상향', () => {
            const v = view('NVDA');

            expect(v.close).toBeGreaterThan(v.maAt(20));
            expect(v.maAt(20)).toBeGreaterThan(v.maAt(60));
            expect(v.maAt(20)).toBeGreaterThan(v.maAt(20, MA_SLOPE_BARS));
            expect(v.maAt(60)).toBeGreaterThan(v.maAt(60, MA_SLOPE_BARS));
        });

        it('NVDA: "최근 넉 달" — 봉이 걸친 기간이 네 달 안팎이다', () => {
            const { bars } = view('NVDA');
            const days = (bars.at(-1)!.time - bars[0]!.time) / 86_400;

            expect(days).toBeGreaterThanOrEqual(115);
            expect(days).toBeLessThanOrEqual(135);
        });

        it('NVDA: "6주간 고점과 저점이 함께 높아진다" — 직전 6주 구간보다 최근 구간의 고점·저점이 높다', () => {
            const { bars, high, low } = view('NVDA');
            const recent = bars.slice(-SIX_WEEKS / 2);
            const earlier = bars.slice(-SIX_WEEKS, -SIX_WEEKS / 2);
            const before = bars.slice(-SIX_WEEKS - SIX_WEEKS / 2, -SIX_WEEKS);

            expect(high(recent)).toBeGreaterThan(high(earlier));
            expect(low(recent)).toBeGreaterThan(low(earlier));
            expect(high(earlier)).toBeGreaterThan(high(before));
            expect(low(earlier)).toBeGreaterThan(low(before));
        });

        it('AAPL: 종가가 20일선·60일선 위, 20일선은 아직 60일선 아래', () => {
            const v = view('AAPL');

            expect(v.close).toBeGreaterThan(v.maAt(20));
            expect(v.close).toBeGreaterThan(v.maAt(60));
            expect(v.maAt(60)).toBeGreaterThan(v.maAt(20));
        });

        it('AAPL: 20일선은 최근 며칠 올랐고 60일선은 거의 평평하다', () => {
            const v = view('AAPL');
            const ma60Change =
                (v.maAt(60) - v.maAt(60, MA_SLOPE_BARS)) /
                v.maAt(60, MA_SLOPE_BARS);

            expect(v.maAt(20)).toBeGreaterThan(v.maAt(20, SHORT_SLOPE_BARS));
            expect(Math.abs(ma60Change)).toBeLessThan(0.01);
        });

        it('AAPL: "좁은 범위"였고 종가는 두 달 박스권 상단 부근이되 돌파는 아니다', () => {
            const v = view('AAPL');
            const prior = v.bars.slice(-TWO_MONTHS - 1, -1);
            const priorHigh = v.high(prior);
            const halfRange = v.bars.slice(v.n / 2);

            expect(
                (v.high(halfRange) - v.low(halfRange)) / v.low(halfRange)
            ).toBeLessThan(0.1);
            expect(v.close).toBeLessThan(priorHigh);
            expect(v.close).toBeGreaterThanOrEqual(priorHigh * 0.97);
        });
    });

    it('차트에 겹치는 이동평균은 봉과 같은 길이다', () => {
        const bars = buildSampleBars('NVDA');
        const ma = buildSampleChartMa(bars);

        expect(Object.keys(ma).sort()).toEqual(['20', '60']);
        expect(ma[20]).toHaveLength(bars.length);
        expect(ma[60]!.at(-1)).not.toBeNull();
    });
});

describe('sampleChartUrl / isSampleChartSymbol', () => {
    it('사이트 상대 경로의 샘플 차트 URL을 만든다', () => {
        expect(sampleChartUrl('NVDA')).toBe(
            '/api/email-report/sample-chart/NVDA'
        );
    });

    it('샘플 종목만 통과시킨다', () => {
        expect(isSampleChartSymbol('NVDA')).toBe(true);
        expect(isSampleChartSymbol('MSFT')).toBe(false);
        expect(isSampleChartSymbol('../etc')).toBe(false);
    });
});

describe('buildSampleReportEmailInput -> buildReportEmail', () => {
    it('전체 카드 두 장과 요약 표 세 행을 실제 템플릿으로 그린다', () => {
        const { html } = buildMessage();

        expect(html).toContain('<h2 style="font-size:20px;');
        expect(html.match(/<h2 style="font-size:20px;/g)).toHaveLength(2);
        expect(html).toContain('>NVDA</h2>');
        expect(html).toContain('>AAPL</h2>');
        for (const symbol of ['MSFT', 'TSLA', 'AMZN']) {
            expect(html).toMatch(new RegExp(`>${symbol}</a></td>`));
        }
        expect(html).toContain('prose:nvda.plain');
        expect(html).toContain('prose:aapl.technical');
        expect(html).toContain('sectionBrief');
    });

    it('카드의 차트는 서명 없는 샘플 차트 이미지를 가리킨다', () => {
        const { html } = buildMessage();

        expect(html).toContain('src="/api/email-report/sample-chart/NVDA"');
        expect(html).toContain('src="/api/email-report/sample-chart/AAPL"');
        expect(html).not.toContain('/api/email-report/chart?');
        expect(html).not.toContain('sig=');
    });

    it('수신거부 링크는 실제 수신거부 경로를 가리키지 않는다', () => {
        const message = buildMessage();
        const everything = `${message.html}\n${message.text}\n${JSON.stringify(message.headers)}`;

        expect(everything).not.toContain(REPORT_UNSUBSCRIBE_API_PATH);
        expect(everything).not.toContain(REPORT_UNSUBSCRIBE_PAGE_PATH);
        expect(message.headers?.['List-Unsubscribe']).toBe(
            '</email-report/sample>'
        );
    });

    it('로케일 접두사가 링크에 붙는다', () => {
        const { html } = buildMessage('en');

        expect(html).toContain('href="/en/NVDA"');
        expect(html).toContain('href="/en/email-report"');
        expect(html).toContain('href="/en/email-report/sample"');
    });

    it('뉴스 링크는 절대 주소라 링크로 걸린다', () => {
        const { html } = buildMessage();

        expect(html).toContain('href="https://siglens.io/NVDA/news"');
    });

    it('뉴스 링크에도 로케일 접두사가 붙는다', () => {
        const { html } = buildMessage('en');

        expect(html).toContain('href="https://siglens.io/en/NVDA/news"');
        expect(html).toContain('href="https://siglens.io/en/AAPL/news"');
        expect(html).not.toContain('href="https://siglens.io/NVDA/news"');
    });

    it('본문 크기 상한 안에 든다', () => {
        expect(Buffer.byteLength(buildMessage().html, 'utf8')).toBeLessThan(
            REPORT_EMAIL_MAX_HTML_BYTES
        );
    });
});
