import { reportSymbolLabel } from '@/entities/email-report/lib/reportSymbolLabel';

const HYNIX = { name: 'SK hynix Inc.', koreanName: 'SK하이닉스' };
const APPLE = { name: 'Apple Inc.', koreanName: '애플' };

describe('reportSymbolLabel', () => {
    it('ko에서 국내 종목은 한글명과 접미사 없는 코드를 쓴다', () => {
        expect(reportSymbolLabel('000660.KS', HYNIX, 'ko')).toEqual({
            name: 'SK하이닉스',
            code: '000660',
            text: 'SK하이닉스 (000660)',
        });
    });

    it('en에서 국내 종목은 영문 법인명을 쓰고 한글을 섞지 않는다', () => {
        const label = reportSymbolLabel('000660.KS', HYNIX, 'en');

        expect(label.text).toBe('SK hynix Inc. (000660)');
    });

    it('미국 종목은 로케일에 맞는 회사명과 티커를 쓴다', () => {
        expect(reportSymbolLabel('AAPL', APPLE, 'ko').text).toBe('애플 (AAPL)');
        expect(reportSymbolLabel('AAPL', APPLE, 'en').text).toBe(
            'Apple Inc. (AAPL)'
        );
    });

    it('이름이 없으면 접미사를 뗀 티커 하나로 떨어진다', () => {
        expect(reportSymbolLabel('000660.KQ', null, 'ko')).toEqual({
            name: '000660',
            code: '000660',
            text: '000660',
        });
        expect(reportSymbolLabel('AAPL', { name: '' }, 'en').text).toBe('AAPL');
    });

    it('이름이 티커와 같으면 코드를 한 번만 적는다', () => {
        expect(reportSymbolLabel('BTCUSD', { name: 'BTCUSD' }, 'en').text).toBe(
            'BTCUSD'
        );
        expect(
            reportSymbolLabel('000660.KS', { name: '000660.KS' }, 'en')
        ).toEqual({ name: '000660', code: '000660', text: '000660' });
    });

    it('비-ko에서 영문명이 비면 한글명으로 떨어진다(사이트와 같다)', () => {
        expect(
            reportSymbolLabel(
                '000660.KS',
                { name: '', koreanName: 'SK하이닉스' },
                'en'
            ).text
        ).toBe('SK하이닉스 (000660)');
    });

    it('ja·zh도 영문 법인명을 쓴다', () => {
        expect(reportSymbolLabel('000660.KS', HYNIX, 'ja').text).toBe(
            'SK hynix Inc. (000660)'
        );
        expect(reportSymbolLabel('AAPL', APPLE, 'zh').text).toBe(
            'Apple Inc. (AAPL)'
        );
    });
});
