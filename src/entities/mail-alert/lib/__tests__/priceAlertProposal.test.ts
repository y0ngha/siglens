import {
    PRICE_ALERT_TOKEN_MAX_LENGTH,
    isIsoCalendarDate,
    parsePriceAlertProposal,
} from '@/entities/mail-alert/lib/priceAlertProposal';

const VALID = {
    proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
    subject: 'subject-hash',
    symbol: 'AAPL',
    market: 'us',
    condition: { kind: 'close_below', level: 180 },
    basis: 'price_level',
    analysisAt: null,
    referenceClose: 190,
    quoteAt: '2026-11-25T14:59:00.000Z',
    startsAfterSession: '2026-11-24',
    expiresOn: '2026-12-24',
    exp: 1_795_000_000,
};

describe('parsePriceAlertProposal', () => {
    it('올바른 제안은 그대로 읽는다', () => {
        expect(parsePriceAlertProposal(VALID)).toEqual(VALID);
    });

    it('구간 조건과 한국 종목, 분석 시각이 있는 제안도 읽는다', () => {
        const zone = {
            ...VALID,
            symbol: '005930.KS',
            market: 'kr',
            basis: 'analysis_entry_zone',
            analysisAt: '2026-11-25T12:00:00.000Z',
            condition: {
                kind: 'enter_zone',
                low: 70_000,
                high: 71_000,
                approach: 'from_above',
            },
        };

        expect(parsePriceAlertProposal(zone)).toEqual(zone);
    });

    it('알 수 없는 필드는 버린다(토큰에 실린 여분이 카드로 번지지 않는다)', () => {
        const read = parsePriceAlertProposal({ ...VALID, extra: 'x' });

        expect(read).toEqual(VALID);
        expect(read).not.toHaveProperty('extra');
    });

    it.each([
        ['객체가 아님', 'x'],
        ['배열', []],
        ['null', null],
        ['proposalId가 uuid가 아님', { ...VALID, proposalId: 'abc' }],
        ['subject가 비어 있음', { ...VALID, subject: '' }],
        ['허용 모양이 아닌 종목', { ...VALID, symbol: 'A B' }],
        ['모르는 시장', { ...VALID, market: 'crypto' }],
        ['모르는 기준', { ...VALID, basis: 'analysis_target' }],
        ['분석 시각이 날짜가 아님', { ...VALID, analysisAt: 'yesterday' }],
        ['시세 시각이 날짜가 아님', { ...VALID, quoteAt: 5 }],
        ['0 이하 기준 가격', { ...VALID, referenceClose: 0 }],
        ['유한하지 않은 기준 가격', { ...VALID, referenceClose: Number.NaN }],
        ['문자열 기준 가격', { ...VALID, referenceClose: '190' }],
        ['실제 없는 날짜', { ...VALID, expiresOn: '2026-13-45' }],
        ['모양이 다른 날짜', { ...VALID, startsAfterSession: '20261124' }],
        ['만료 시각이 숫자가 아님', { ...VALID, exp: '1' }],
        ['조건이 없음', { ...VALID, condition: undefined }],
        [
            '모르는 조건',
            { ...VALID, condition: { kind: 'close_at', level: 1 } },
        ],
        [
            '0 이하 가격 조건',
            { ...VALID, condition: { kind: 'close_above', level: 0 } },
        ],
        [
            'low가 high보다 큰 구간',
            {
                ...VALID,
                condition: {
                    kind: 'enter_zone',
                    low: 2,
                    high: 1,
                    approach: 'from_above',
                },
            },
        ],
        [
            'approach가 없는 구간',
            { ...VALID, condition: { kind: 'enter_zone', low: 1, high: 2 } },
        ],
    ])('%s → null', (_label, value) => {
        expect(parsePriceAlertProposal(value)).toBeNull();
    });
});

describe('isIsoCalendarDate', () => {
    it.each(['2026-11-24', '2028-02-29', '2026-12-31'])(
        '%s는 실제 날짜다',
        value => {
            expect(isIsoCalendarDate(value)).toBe(true);
        }
    );

    it.each([
        '2026-02-29',
        '2026-13-01',
        '2026-00-10',
        '2026-11-31',
        '2026-1-1',
        '',
        '2026-11-24T00:00:00Z',
    ])('%s는 아니다', value => {
        expect(isIsoCalendarDate(value)).toBe(false);
    });

    it('문자열이 아니면 아니다', () => {
        expect(isIsoCalendarDate(20_261_124)).toBe(false);
        expect(isIsoCalendarDate(null)).toBe(false);
    });
});

describe('PRICE_ALERT_TOKEN_MAX_LENGTH', () => {
    it('서명된 제안(본문 base64url + 서명)이 들어가고도 여유가 있다', () => {
        const body = Buffer.from(JSON.stringify(VALID)).toString('base64url');
        const token = `${body}.${'s'.repeat(43)}`;

        expect(token.length).toBeLessThan(PRICE_ALERT_TOKEN_MAX_LENGTH / 2);
    });
});
