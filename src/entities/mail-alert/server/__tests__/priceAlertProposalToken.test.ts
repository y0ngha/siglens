import { signReportValue } from '@/entities/email-report/lib/reportSignature';
import { PRICE_ALERT_TOKEN_MAX_LENGTH } from '@/entities/mail-alert/lib/priceAlertProposal';
import type { PriceAlertProposal } from '@/entities/mail-alert/model';
import {
    isPriceAlertProposalExpired,
    priceAlertSubject,
    signPriceAlertProposal,
    verifyPriceAlertProposal,
} from '@/entities/mail-alert/server/priceAlertProposalToken';

const SECRET = 'price-alert-test-secret-0123456789abcdef';
const OTHER_SECRET = 'another-secret-value-0123456789abcdefgh';

const PROPOSAL: PriceAlertProposal = {
    proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
    subject: priceAlertSubject(SECRET, 'user-1'),
    symbol: 'AAPL',
    market: 'us',
    condition: { kind: 'close_below', level: 180 },
    basis: 'price_level',
    analysisAt: null,
    referenceClose: 190,
    quoteAt: null,
    startsAfterSession: '2026-11-24',
    expiresOn: '2026-12-24',
    exp: 1_795_000_000,
};

describe('signPriceAlertProposal / verifyPriceAlertProposal', () => {
    it('봉한 제안은 같은 비밀로 그대로 읽힌다', () => {
        const token = signPriceAlertProposal(SECRET, PROPOSAL);

        expect(verifyPriceAlertProposal(SECRET, token)).toEqual(PROPOSAL);
    });

    it('토큰은 `<본문>.<서명>` 두 조각이고 URL·폼에 그대로 실을 수 있는 문자만 쓴다', () => {
        const token = signPriceAlertProposal(SECRET, PROPOSAL);

        expect(token.split('.')).toHaveLength(2);
        expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
        expect(token.length).toBeLessThan(PRICE_ALERT_TOKEN_MAX_LENGTH);
    });

    it('다른 비밀로는 읽히지 않는다', () => {
        const token = signPriceAlertProposal(SECRET, PROPOSAL);

        expect(verifyPriceAlertProposal(OTHER_SECRET, token)).toBeNull();
    });

    it('본문을 바꾸면(가격 조작) 서명이 맞지 않는다', () => {
        const token = signPriceAlertProposal(SECRET, PROPOSAL);
        const [, signature] = token.split('.');
        const forged = Buffer.from(
            JSON.stringify({
                ...PROPOSAL,
                condition: { kind: 'close_below', level: 1 },
            })
        ).toString('base64url');

        expect(
            verifyPriceAlertProposal(SECRET, `${forged}.${signature}`)
        ).toBeNull();
    });

    it('서명을 바꾸면 읽히지 않는다', () => {
        const token = signPriceAlertProposal(SECRET, PROPOSAL);
        const [body] = token.split('.');

        expect(verifyPriceAlertProposal(SECRET, `${body}.AAAA`)).toBeNull();
        expect(verifyPriceAlertProposal(SECRET, `${body}.`)).toBeNull();
    });

    it('다른 용도의 서명(수신거부 링크 등)은 제안 서명으로 통하지 않는다', () => {
        const body = Buffer.from(JSON.stringify(PROPOSAL)).toString(
            'base64url'
        );
        const asUnsubscribe = signReportValue(
            SECRET,
            'alert-unsubscribe',
            body
        );

        expect(
            verifyPriceAlertProposal(SECRET, `${body}.${asUnsubscribe}`)
        ).toBeNull();
    });

    it('서명은 맞지만 값의 의미가 틀린 본문은 읽지 않는다(0 이하 가격)', () => {
        const bad = Buffer.from(
            JSON.stringify({ ...PROPOSAL, referenceClose: -1 })
        ).toString('base64url');
        const signature = signReportValue(SECRET, 'price-alert-proposal', bad);

        expect(
            verifyPriceAlertProposal(SECRET, `${bad}.${signature}`)
        ).toBeNull();
    });

    it('서명은 맞지만 JSON이 아닌 본문은 던지지 않고 null이다', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const body = Buffer.from('not json').toString('base64url');
        const signature = signReportValue(SECRET, 'price-alert-proposal', body);

        expect(
            verifyPriceAlertProposal(SECRET, `${body}.${signature}`)
        ).toBeNull();
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });

    it.each([
        ['문자열이 아님', 123],
        ['undefined', undefined],
        ['null', null],
        ['빈 문자열', ''],
        ['구분자 없음', 'abcdef'],
        ['구분자가 맨 앞', '.abcdef'],
        ['구분자가 둘', 'a.b.c'],
        ['상한을 넘는 길이', `${'a'.repeat(PRICE_ALERT_TOKEN_MAX_LENGTH)}.b`],
    ])('%s → 던지지 않고 null', (_label, token) => {
        expect(verifyPriceAlertProposal(SECRET, token)).toBeNull();
    });
});

describe('priceAlertSubject', () => {
    it('같은 호출자는 같은 해시, 다른 호출자·다른 비밀은 다른 해시다', () => {
        expect(priceAlertSubject(SECRET, 'user-1')).toBe(
            priceAlertSubject(SECRET, 'user-1')
        );
        expect(priceAlertSubject(SECRET, 'user-1')).not.toBe(
            priceAlertSubject(SECRET, 'user-2')
        );
        expect(priceAlertSubject(SECRET, 'user-1')).not.toBe(
            priceAlertSubject(OTHER_SECRET, 'user-1')
        );
    });

    it('원본 id를 담지 않는다(대화 행에 저장되어 화면에 내려간다)', () => {
        const hash = priceAlertSubject(
            SECRET,
            'guest:22222222-2222-4222-8222-222222222222'
        );

        expect(hash).not.toContain('guest');
        expect(hash).not.toContain('2222');
    });

    it('제안 토큰의 서명과 같은 값이 될 수 없다(접두사로 갈린다)', () => {
        const raw = 'abc';

        expect(priceAlertSubject(SECRET, raw)).not.toBe(
            signReportValue(SECRET, 'price-alert-proposal', raw)
        );
    });
});

describe('isPriceAlertProposalExpired', () => {
    it('만료 시각 정각부터 만료다', () => {
        const exp = 1_795_000_000;

        expect(isPriceAlertProposalExpired({ exp }, exp * 1000 - 1)).toBe(
            false
        );
        expect(isPriceAlertProposalExpired({ exp }, exp * 1000)).toBe(true);
    });
});
