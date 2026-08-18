import { buildTitleSubject } from '@/shared/lib/seo';

describe('buildTitleSubject', () => {
    it('한국어명이 있으면 한국어명(티커) 형태로 만든다', () => {
        expect(buildTitleSubject('AAPL', '애플')).toBe('애플(AAPL)');
    });

    it('한국어명이 없으면 티커만 반환한다', () => {
        expect(buildTitleSubject('AAPL')).toBe('AAPL');
    });

    it('빈 문자열 한국어명은 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '')).toBe('AAPL');
    });

    it('공백뿐인 한국어명도 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '   ')).toBe('AAPL');
    });

    it('한국어명이 티커와 같으면 중복을 피해 티커만 반환한다', () => {
        expect(buildTitleSubject('SOXL', 'SOXL')).toBe('SOXL');
    });

    it('티커를 대문자로 정규화한다', () => {
        expect(buildTitleSubject('aapl', '애플')).toBe('애플(AAPL)');
    });

    it('한국어명이 티커의 대소문자만 다른 값이어도 중복을 피해 티커만 반환한다', () => {
        expect(buildTitleSubject('SOXL', 'soxl')).toBe('SOXL');
    });

    it('티커가 빈 문자열이면 한국어명만 반환한다 (빈 괄호 방지)', () => {
        expect(buildTitleSubject('', '애플')).toBe('애플');
    });
});

/**
 * 국내 상장 종목 title에서 거래소 접미사를 뗀다.
 *
 * `.KS`/`.KQ`는 yahoo 벤더 규약이고 한국 검색량이 0이다 — 검색되는 건 6자리 코드다.
 * 반면 폭 예산은 3단위를 먹어, 20종목 × 6탭 = 120개 KR title 중 21개가 서술 tail을
 * 떨어뜨리고 있었다. canonical·URL·라우팅은 접미사를 유지해야 하므로 **표기만** 바꾼다.
 */
describe('buildTitleSubject — 국내 종목 거래소 접미사', () => {
    it('KOSPI 종목은 .KS를 떼고 표기한다', () => {
        expect(buildTitleSubject('005930.KS', '삼성전자')).toBe(
            '삼성전자(005930)'
        );
    });

    it('KOSDAQ 종목은 .KQ를 떼고 표기한다', () => {
        expect(buildTitleSubject('247540.KQ', '에코프로비엠')).toBe(
            '에코프로비엠(247540)'
        );
    });

    it('한글명이 없으면 접미사 없는 코드만 남는다', () => {
        expect(buildTitleSubject('005930.KS')).toBe('005930');
    });

    it('소문자 입력도 접미사를 떼고 대문자로 정규화한다', () => {
        expect(buildTitleSubject('005930.ks', '삼성전자')).toBe(
            '삼성전자(005930)'
        );
    });

    it('미국 티커는 손대지 않는다', () => {
        expect(buildTitleSubject('AAPL', '애플')).toBe('애플(AAPL)');
        // `.K`로 끝나도 국내 종목 형상(6자리 숫자)이 아니면 그대로 둔다.
        expect(buildTitleSubject('BRK.B', '버크셔')).toBe('버크셔(BRK.B)');
    });
});
