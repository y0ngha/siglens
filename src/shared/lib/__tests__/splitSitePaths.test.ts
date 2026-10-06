import { splitSitePaths } from '@/shared/lib/splitSitePaths';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

const paths = (text: string): string[] =>
    splitSitePaths(text)
        .filter(s => s.kind === 'path')
        .map(s => s.value);

describe('splitSitePaths', () => {
    it('문장 중간의 /market을 경로로 뽑는다', () => {
        expect(
            splitSitePaths('Siglens의 /market 페이지에서는 스캔합니다.')
        ).toEqual([
            { kind: 'text', value: 'Siglens의 ' },
            { kind: 'path', value: '/market' },
            { kind: 'text', value: ' 페이지에서는 스캔합니다.' },
        ]);
    });

    it('두 세그먼트 경로(/NVDA/overall)를 하나로 뽑는다', () => {
        expect(paths('엔비디아는 /NVDA/overall 경로입니다.')).toEqual([
            '/NVDA/overall',
        ]);
    });

    it('문장 끝 마침표는 경로에 넣지 않는다', () => {
        expect(splitSitePaths('예: /BTCUSD.')).toEqual([
            { kind: 'text', value: '예: ' },
            { kind: 'path', value: '/BTCUSD' },
            { kind: 'text', value: '.' },
        ]);
    });

    it('문장 처음의 경로와 괄호 안의 경로를 뽑는다', () => {
        expect(paths('/backtesting 페이지에서 공개합니다.')).toEqual([
            '/backtesting',
        ]);
        expect(paths('종합 분석(/AAPL/overall)을 봅니다.')).toEqual([
            '/AAPL/overall',
        ]);
    });

    it('한 문장의 여러 경로를 모두 뽑는다', () => {
        expect(paths('/market, /economy 를 보세요')).toEqual([
            '/market',
            '/economy',
        ]);
    });

    it('PER/PBR·24/7·매수/매도 같은 단어 사이 슬래시는 경로가 아니다', () => {
        expect(paths('PER/PBR 같은 지표')).toEqual([]);
        expect(paths('24/7 시세')).toEqual([]);
        expect(paths('매수/매도 신호')).toEqual([]);
        expect(paths('풋/콜 비율')).toEqual([]);
    });

    it('URL의 슬래시는 경로로 보지 않는다', () => {
        expect(paths('https://siglens.io/market 에서')).toEqual([]);
    });

    it('경로가 없으면 원문 하나만 돌려준다', () => {
        expect(splitSitePaths('회원가입 없이 이용합니다.')).toEqual([
            { kind: 'text', value: '회원가입 없이 이용합니다.' },
        ]);
    });

    it('조각을 이어 붙이면 원문과 같다', () => {
        const text = 'Siglens의 /market 페이지, 예: /NVDA/overall.';
        expect(
            splitSitePaths(text)
                .map(s => s.value)
                .join('')
        ).toBe(text);
    });

    it('빈 문자열은 빈 배열이다', () => {
        expect(splitSitePaths('')).toEqual([]);
    });

    it('일본어·중국어처럼 띄어쓰기 없는 문장에서도 경로를 뽑는다', () => {
        expect(paths('Siglensの/marketページ')).toEqual(['/market']);
        expect(paths('NVIDIAは/NVDA/overallです。')).toEqual(['/NVDA/overall']);
        expect(paths('例：/BTCUSD。')).toEqual(['/BTCUSD']);
        expect(paths('英伟达对应 /NVDA/overall。')).toEqual(['/NVDA/overall']);
    });

    it('전각 마침표(。)는 링크 밖에 남는다', () => {
        expect(splitSitePaths('例：/BTCUSD。')).toEqual([
            { kind: 'text', value: '例：' },
            { kind: 'path', value: '/BTCUSD' },
            { kind: 'text', value: '。' },
        ]);
    });

    it('도메인·URL 안의 경로와 단어 사이 슬래시는 계속 링크가 아니다', () => {
        expect(paths('https://x.com/foo')).toEqual([]);
        expect(paths('siglens.io/market')).toEqual([]);
        expect(paths('PER/PBR')).toEqual([]);
        expect(paths('24/7')).toEqual([]);
    });

    it('숫자가 이어지는 경로는 부분 일치시키지 않는다', () => {
        expect(paths('/NVDA/overall2 를')).toEqual([]);
    });
});

/**
 * 실제 홈 FAQ 답변(`app.home.jsonLd.faq`)으로 로케일별 기대 경로를 못 박는다 — 카탈로그
 * 문장이 바뀌어 경로가 링크가 되지 않게 되면 여기서 실패한다.
 */
describe('splitSitePaths — 홈 FAQ 실제 답변', () => {
    const CATALOGS = {
        ko: koMessages,
        en: enMessages,
        ja: jaMessages,
        zh: zhMessages,
    } as const;
    const EXPECTED: Record<string, string[]> = {
        q2: ['/market'],
        q8: ['/NVDA/overall'],
        q9: ['/backtesting'],
        q11: ['/BTCUSD'],
    };

    describe.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
        '%s',
        locale => {
            const faq = CATALOGS[locale].app.home.jsonLd.faq as Record<
                string,
                { answer: string }
            >;

            it.each(Object.entries(EXPECTED))(
                '%s 답변의 경로가 전부 링크가 된다',
                (key, expected) => {
                    expect(paths(faq[key].answer)).toEqual(expected);
                }
            );

            it('경로가 없는 답변은 링크가 없다', () => {
                for (const key of ['q0', 'q10']) {
                    expect(paths(faq[key].answer)).toEqual([]);
                }
            });
        }
    );
});
