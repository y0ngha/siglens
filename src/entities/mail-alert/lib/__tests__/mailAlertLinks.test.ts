import { verifyReportValue } from '@/entities/email-report/lib/reportSignature';
import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import {
    buildMailAlertFearGreedUrl,
    buildMailAlertHubUrl,
    buildMailAlertManageUrl,
    buildMailAlertSymbolUrl,
    buildMailAlertUnsubscribeApiUrl,
    buildMailAlertUnsubscribePageUrl,
    MAIL_ALERT_MANAGE_PATH,
    MAIL_ALERT_UNSUBSCRIBE_API_PATH,
    MAIL_ALERT_UTM_CAMPAIGN,
    verifyMailAlertUnsubscribe,
} from '../mailAlertLinks';

const SECRET = 'link-secret-link-secret-link-secret-xx';
const SITE = 'https://siglens.io';
const ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';

describe('설정·수신거부 링크', () => {
    it('설정 링크는 구독자 id와 alert-manage 서명을 싣는다', () => {
        const url = new URL(buildMailAlertManageUrl(SITE, SECRET, 'ko', ID));

        expect(url.origin + url.pathname).toBe(
            `${SITE}${MAIL_ALERT_MANAGE_PATH}`
        );
        expect(url.searchParams.get('s')).toBe(ID);
        expect(
            verifyReportValue(
                SECRET,
                'alert-manage',
                ID,
                url.searchParams.get('sig') ?? ''
            )
        ).toBe(true);
    });

    it('설정 링크의 서명은 수신거부 서명으로 통하지 않는다(용도 분리)', () => {
        const url = new URL(buildMailAlertManageUrl(SITE, SECRET, 'ko', ID));

        expect(
            verifyMailAlertUnsubscribe(
                SECRET,
                ID,
                url.searchParams.get('sig') ?? ''
            )
        ).toBe(false);
    });

    it('로케일 접두사는 영어에만 붙는다', () => {
        expect(buildMailAlertManageUrl(SITE, SECRET, 'en', ID)).toContain(
            `${SITE}/en${MAIL_ALERT_MANAGE_PATH}?`
        );
        expect(buildMailAlertManageUrl(SITE, SECRET, 'ko', ID)).toContain(
            `${SITE}${MAIL_ALERT_MANAGE_PATH}?`
        );
    });

    it('본문 수신거부 링크는 같은 설정 링크에 수신거부 구역 앵커를 붙인다', () => {
        const manage = buildMailAlertManageUrl(SITE, SECRET, 'ko', ID);

        expect(buildMailAlertUnsubscribePageUrl(SITE, SECRET, 'ko', ID)).toBe(
            `${manage}#unsubscribe`
        );
    });

    it('원클릭 링크는 alert-unsubscribe 서명을 싣고 검증을 통과한다', () => {
        const url = new URL(
            buildMailAlertUnsubscribeApiUrl(SITE, SECRET, ID, 'ko')
        );

        expect(url.origin + url.pathname).toBe(
            `${SITE}${MAIL_ALERT_UNSUBSCRIBE_API_PATH}`
        );
        expect(
            verifyMailAlertUnsubscribe(
                SECRET,
                url.searchParams.get('s') ?? '',
                url.searchParams.get('sig') ?? ''
            )
        ).toBe(true);
    });

    it('원클릭 링크는 로케일을 서명 밖 쿼리(l)로 싣는다', () => {
        const url = new URL(
            buildMailAlertUnsubscribeApiUrl(SITE, SECRET, ID, 'en')
        );

        expect(url.searchParams.get('l')).toBe('en');
        expect(
            verifyMailAlertUnsubscribe(
                SECRET,
                ID,
                url.searchParams.get('sig') ?? ''
            )
        ).toBe(true);
    });

    it('다른 비밀·다른 id·깨진 서명·UUID가 아닌 id는 모두 거절한다', () => {
        const url = new URL(
            buildMailAlertUnsubscribeApiUrl(SITE, SECRET, ID, 'ko')
        );
        const sig = url.searchParams.get('sig') ?? '';

        expect(verifyMailAlertUnsubscribe('x'.repeat(40), ID, sig)).toBe(false);
        expect(
            verifyMailAlertUnsubscribe(
                SECRET,
                '00000000-0000-4000-8000-000000000000',
                sig
            )
        ).toBe(false);
        expect(verifyMailAlertUnsubscribe(SECRET, ID, 'not-a-signature')).toBe(
            false
        );
        expect(verifyMailAlertUnsubscribe(SECRET, 'not-a-uuid', sig)).toBe(
            false
        );
    });
});

describe('본문 콘텐츠 링크', () => {
    it('모두 알림 메일 캠페인 UTM을 싣는다', () => {
        const urls = [
            buildMailAlertSymbolUrl(SITE, 'ko', 'AAPL'),
            buildMailAlertFearGreedUrl(SITE, 'ko', 'us'),
            buildMailAlertHubUrl(SITE, 'ko', 'golden_cross'),
        ];

        urls.forEach(url => {
            const params = new URL(url ?? '').searchParams;
            expect(params.get('utm_source')).toBe('email');
            expect(params.get('utm_medium')).toBe('email');
            expect(params.get('utm_campaign')).toBe(MAIL_ALERT_UTM_CAMPAIGN);
        });
    });

    it('종목 코드는 경로에서 인코딩한다', () => {
        expect(buildMailAlertSymbolUrl(SITE, 'ko', '005930.KS')).toContain(
            `${SITE}/005930.KS?`
        );
        expect(buildMailAlertSymbolUrl(SITE, 'ko', 'A/B')).toContain('/A%2FB?');
    });

    it('공포·탐욕은 시장별 허브로 간다', () => {
        expect(buildMailAlertFearGreedUrl(SITE, 'ko', 'us')).toContain(
            '/fear-greed?'
        );
        expect(buildMailAlertFearGreedUrl(SITE, 'ko', 'kr')).toContain(
            '/fear-greed/kr?'
        );
        expect(buildMailAlertFearGreedUrl(SITE, 'en', 'crypto')).toContain(
            '/en/fear-greed/crypto?'
        );
    });

    it('신호 허브 링크는 허브 슬러그로 가고, 허브가 없는 유형은 null이다', () => {
        const hub = SIGNAL_HUBS[0];
        expect(
            buildMailAlertHubUrl(SITE, 'ko', hub?.signalType ?? 'golden_cross')
        ).toContain(`/market/signals/${hub?.slug}?`);
        expect(
            buildMailAlertHubUrl(SITE, 'ko', 'cci_bullish_cross')
        ).toBeNull();
    });
});
