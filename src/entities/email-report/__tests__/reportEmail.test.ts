import type { SymbolReport } from '@/entities/email-report/reportModel';
import {
    buildReportEmail,
    type BuildReportEmailInput,
} from '@/entities/email-report/templates/reportEmail';

/** 키와 인자를 그대로 드러내는 번역자 — 어떤 키가 쓰였는지 단언할 수 있다. */
const t = (key: string, values?: Record<string, string>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key;

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

const INPUT: BuildReportEmailInput = {
    to: 'member@example.com',
    locale: 'ko',
    localDate: '2026-10-08',
    sections: [
        {
            report: REPORT,
            chartUrl: 'https://siglens.io/api/email-report/chart?s=AAPL&sig=x',
            pageUrl: 'https://siglens.io/AAPL?utm_source=email',
        },
    ],
    unsubscribePageUrl: 'https://siglens.io/email-report/unsubscribe?u=1',
    unsubscribeApiUrl: 'https://siglens.io/api/email-report/unsubscribe?u=1',
    settingsUrl: 'https://siglens.io/account',
    t,
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
        expect(html).toContain('href="https://siglens.io/account"');
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
});
