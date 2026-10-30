import {
    REPORT_UNSUBSCRIBE_API_PATH,
    REPORT_UNSUBSCRIBE_PAGE_PATH,
} from '@/entities/email-report/lib/reportLinks';
import {
    buildSampleReportEmailInput,
    sampleChartUrl,
} from '@/entities/email-report/lib/sampleReportData';
import {
    buildReportEmail,
    REPORT_EMAIL_MAX_HTML_BYTES,
} from '@/entities/email-report/templates/reportEmail';
import type {
    ReportEmailTranslator,
    SignalLabelResolver,
} from '@/entities/email-report/templates/reportEmailTypes';

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

describe('sampleChartUrl', () => {
    it('사이트 상대 경로의 샘플 차트 URL을 만든다', () => {
        expect(sampleChartUrl('NVDA')).toBe(
            '/api/email-report/sample-chart/NVDA'
        );
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
