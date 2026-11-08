import { RADAR_REQUEST_SYMBOL_MAX_LENGTH } from '@/shared/config/radar';
import { CONTACT_EMAIL_MAX_LENGTH } from '../lib/constants';
import { validateRadarRequestInput } from '../lib/radarRequestValidation';

describe('validateRadarRequestInput', () => {
    it('종목이 비어 있거나 공백뿐이면 symbol_required 를 symbol 필드에 돌려준다', () => {
        for (const symbol of ['', '   ']) {
            expect(validateRadarRequestInput({ symbol, email: '' })).toEqual({
                ok: false,
                error: { code: 'symbol_required', field: 'symbol' },
            });
        }
    });

    it('종목이 상한을 넘으면 symbol_too_long, 상한 길이는 통과한다', () => {
        const over = 'A'.repeat(RADAR_REQUEST_SYMBOL_MAX_LENGTH + 1);
        expect(validateRadarRequestInput({ symbol: over, email: '' })).toEqual({
            ok: false,
            error: { code: 'symbol_too_long', field: 'symbol' },
        });
        const atLimit = 'A'.repeat(RADAR_REQUEST_SYMBOL_MAX_LENGTH);
        expect(
            validateRadarRequestInput({ symbol: atLimit, email: '' }).ok
        ).toBe(true);
    });

    it('길이는 trim 뒤에 잰다', () => {
        const padded = ` ${'A'.repeat(RADAR_REQUEST_SYMBOL_MAX_LENGTH)} `;
        expect(
            validateRadarRequestInput({ symbol: padded, email: '' }).ok
        ).toBe(true);
    });

    it('이메일을 비우면 null 로 저장한다', () => {
        for (const email of ['', '   ']) {
            expect(
                validateRadarRequestInput({ symbol: 'PLTR', email })
            ).toEqual({
                ok: true,
                values: {
                    title: '[Radar request] PLTR',
                    content: 'PLTR',
                    email: null,
                },
            });
        }
    });

    it('형식이 틀린 이메일은 email_invalid 를 email 필드에 돌려준다', () => {
        expect(
            validateRadarRequestInput({ symbol: 'PLTR', email: 'nope' })
        ).toEqual({
            ok: false,
            error: { code: 'email_invalid', field: 'email' },
        });
    });

    it('이메일이 최대 길이를 넘으면 형식이 맞아도 email_invalid 다', () => {
        const local = 'a'.repeat(CONTACT_EMAIL_MAX_LENGTH);
        expect(
            validateRadarRequestInput({
                symbol: 'PLTR',
                email: `${local}@example.com`,
            })
        ).toEqual({
            ok: false,
            error: { code: 'email_invalid', field: 'email' },
        });
    });

    it('종목이 비어 있으면 이메일이 틀려도 종목 오류를 먼저 돌려준다', () => {
        const result = validateRadarRequestInput({
            symbol: '',
            email: 'nope',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.field).toBe('symbol');
    });

    it('종목·이메일을 trim 해 ASCII 접두어 제목과 본문으로 만든다', () => {
        expect(
            validateRadarRequestInput({
                symbol: '  팔란티어 PLTR  ',
                email: '  me@example.com  ',
            })
        ).toEqual({
            ok: true,
            values: {
                title: '[Radar request] 팔란티어 PLTR',
                content: '팔란티어 PLTR',
                email: 'me@example.com',
            },
        });
    });
});
