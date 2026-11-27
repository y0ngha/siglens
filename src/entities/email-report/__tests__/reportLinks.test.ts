import {
    buildChartImageUrl,
    emailUtmQuery,
    buildMarketPageUrl,
    buildSymbolPageUrl,
    buildUnsubscribeApiUrl,
    buildUnsubscribePageUrl,
    chartSignatureValue,
} from '@/entities/email-report/lib/reportLinks';
import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';
import { defined } from '@/shared/test-utils/defined';

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

    describe('차트 URL 서명 고정', () => {
        // 값을 하드코딩해 둔다 — 서명 입력 모양이 바뀌면 이미 나간 메일의 이미지가 깨진다.
        const ANALYSIS_AT = new Date(1_793_062_800_123);

        it('작도가 없는 URL은 옛 서명(symbol:date)을 그대로 쓰고 a가 없다', () => {
            const url = new URL(
                buildChartImageUrl(SITE, SECRET, '005930.KS', '2026-10-08')
            );

            expect(url.searchParams.has('a')).toBe(false);
            expect(url.searchParams.get('sig')).toBe(
                'KPs38qrgBgzicJ4krxKoiEj-3giePfDIEOL5lWim1Kk'
            );
            expect(chartSignatureValue('005930.KS', '2026-10-08')).toBe(
                '005930.KS:2026-10-08'
            );
        });

        it('작도가 있는 URL은 분석 시각(epoch 밀리초)을 a로 싣고 서명이 그 시각을 묶는다', () => {
            const url = new URL(
                buildChartImageUrl(
                    SITE,
                    SECRET,
                    '005930.KS',
                    '2026-10-08',
                    ANALYSIS_AT
                )
            );

            expect(url.searchParams.get('a')).toBe('1793062800123');
            expect(url.searchParams.get('sig')).toBe(
                '-q-r7jtYQMTAZUxLazeq2DhyirLkaT33v5JH8EzMCF0'
            );
            expect(
                chartSignatureValue('005930.KS', '2026-10-08', '1793062800123')
            ).toBe('005930.KS:2026-10-08:1793062800123');
        });

        it('다른 분석 시각의 서명은 통하지 않는다', () => {
            const url = new URL(
                buildChartImageUrl(
                    SITE,
                    SECRET,
                    '005930.KS',
                    '2026-10-08',
                    ANALYSIS_AT
                )
            );

            expect(
                verifyReportValue(
                    SECRET,
                    'chart',
                    chartSignatureValue(
                        '005930.KS',
                        '2026-10-08',
                        '1793062800124'
                    ),
                    defined(url.searchParams.get('sig'))
                )
            ).toBe(false);
            expect(
                verifyReportValue(
                    SECRET,
                    'chart',
                    chartSignatureValue('005930.KS', '2026-10-08'),
                    defined(url.searchParams.get('sig'))
                )
            ).toBe(false);
        });
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

    it('종목 페이지 URL은 메일 출처 UTM 세 쌍을 싣는다', () => {
        const url = new URL(buildSymbolPageUrl(SITE, 'ko', 'AAPL'));

        expect(url.searchParams.get('utm_source')).toBe('email');
        expect(url.searchParams.get('utm_medium')).toBe('email');
        expect(url.searchParams.get('utm_campaign')).toBe('email_report');
    });

    it('시장 페이지 URL은 로케일 경로와 같은 UTM을 싣는다', () => {
        const url = new URL(buildMarketPageUrl(SITE, 'en'));

        expect(url.pathname).toBe('/en/market');
        expect(url.searchParams.get('utm_source')).toBe('email');
        expect(url.searchParams.get('utm_medium')).toBe('email');
        expect(url.searchParams.get('utm_campaign')).toBe('email_report');
    });

    it('한국어 시장 페이지 URL은 로케일 접두사가 없다', () => {
        expect(new URL(buildMarketPageUrl(SITE, 'ko')).pathname).toBe(
            '/market'
        );
    });

    it('UTM 캠페인은 메일 종류마다 갈리고 기본값은 정기 리포트다', () => {
        expect(new URLSearchParams(emailUtmQuery()).get('utm_campaign')).toBe(
            'email_report'
        );
        expect(
            new URLSearchParams(emailUtmQuery('mail_alert')).get('utm_campaign')
        ).toBe('mail_alert');
        expect(
            new URLSearchParams(emailUtmQuery('mail_alert')).get('utm_medium')
        ).toBe('email');
    });
});
