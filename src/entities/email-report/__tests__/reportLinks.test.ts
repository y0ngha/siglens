import {
    buildChartImageUrl,
    buildSymbolPageUrl,
    buildUnsubscribeApiUrl,
    buildUnsubscribePageUrl,
    chartSignatureValue,
} from '@/entities/email-report/lib/reportLinks';
import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';

const SITE = 'https://siglens.io';
const SECRET = 'links-secret-links-secret-links-secret';

describe('reportLinks', () => {
    it('차트 URL은 심볼·날짜와 그 둘에 대한 서명을 싣는다', () => {
        const url = new URL(
            buildChartImageUrl(SITE, SECRET, '005930.KS', '2026-10-08')
        );

        expect(url.pathname).toBe('/api/email-report/chart');
        expect(url.searchParams.get('s')).toBe('005930.KS');
        expect(url.searchParams.get('d')).toBe('2026-10-08');
        expect(
            verifyReportValue(
                SECRET,
                'chart',
                chartSignatureValue('005930.KS', '2026-10-08'),
                url.searchParams.get('sig')!
            )
        ).toBe(true);
    });

    it('수신거부 페이지 URL은 로케일 경로를 따르고 회원 id 서명을 싣는다', () => {
        const ko = new URL(buildUnsubscribePageUrl(SITE, SECRET, 'ko', 'u-1'));
        const en = new URL(buildUnsubscribePageUrl(SITE, SECRET, 'en', 'u-1'));

        expect(ko.pathname).toBe('/email-report/unsubscribe');
        expect(en.pathname).toBe('/en/email-report/unsubscribe');
        expect(
            verifyReportValue(
                SECRET,
                'unsubscribe',
                'u-1',
                ko.searchParams.get('sig')!
            )
        ).toBe(true);
    });

    it('원클릭 수신거부 URL은 API 경로를 가리킨다', () => {
        const url = new URL(buildUnsubscribeApiUrl(SITE, SECRET, 'u-1'));

        expect(url.pathname).toBe('/api/email-report/unsubscribe');
        expect(url.searchParams.get('u')).toBe('u-1');
    });

    it('종목 페이지 URL은 로케일 경로와 UTM을 싣는다', () => {
        const url = new URL(buildSymbolPageUrl(SITE, 'ja', 'AAPL'));

        expect(url.pathname).toBe('/ja/AAPL');
        expect(url.searchParams.get('utm_campaign')).toBe('email_report');
    });
});
