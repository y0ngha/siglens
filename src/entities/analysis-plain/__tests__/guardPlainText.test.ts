import { describe, expect, it } from 'vitest';
import {
    buildAllowedNumbers,
    salvageByRemovingSentences,
    describeFailure,
    findUnsupportedNumbers,
    guardPlainText,
} from '../lib/guardPlainText';

describe('buildAllowedNumbers', () => {
    it('facts 숫자와 산문 안의 숫자를 모두 모은다', () => {
        const allowed = buildAllowedNumbers(
            [183.6, 188.37],
            ['종가 186.29달러에서 1,234.56까지']
        );
        expect(allowed).toEqual(
            expect.arrayContaining([183.6, 188.37, 186.29, 1234.56])
        );
    });
});

describe('findUnsupportedNumbers', () => {
    const allowed = [183.6, 431.29, 433.68, 219522.5, 185];

    it('원본에 있는 값을 통과시킨다', () => {
        expect(findUnsupportedNumbers('지지선 183.60달러', allowed)).toEqual(
            []
        );
    });

    it('반올림 표현을 통과시킨다 — 초보자용 글에서 431.29보다 431이 낫다', () => {
        expect(
            findUnsupportedNumbers('431달러에서 434달러 사이', allowed)
        ).toEqual([]);
    });

    it('후행 0 변형을 통과시킨다', () => {
        expect(findUnsupportedNumbers('185.00달러', allowed)).toEqual([]);
    });

    /**
     * 회귀: 후행 단언이 `(?![\w])`이면 단위 접미사 `B`에 걸려 정규식이 백트래킹해
     * `219,522`만 잡고, 원본에 정확히 있는 값이 위반으로 찍힌다(실측).
     */
    it('단위 접미사가 붙은 값을 절단하지 않는다', () => {
        expect(findUnsupportedNumbers('총부채 219,522.5B', allowed)).toEqual(
            []
        );
    });

    it('날조된 가격을 잡는다', () => {
        expect(findUnsupportedNumbers('지지선 183.65달러', allowed)).toEqual([
            '183.65',
        ]);
    });

    it('날조된 3자리 정수를 잡는다', () => {
        expect(findUnsupportedNumbers('목표가 210달러', allowed)).toEqual([
            '210',
        ]);
    });

    it('모델이 계산해 낸 퍼센트를 잡는다', () => {
        expect(findUnsupportedNumbers('약 12.7% 상승', allowed)).toEqual([
            '12.7',
        ]);
    });

    it('자연어 수량(2자리 이하)은 검사하지 않는다', () => {
        expect(
            findUnsupportedNumbers(
                '세 번 반등했고 두 단계 강해졌으며 15일 만에',
                allowed
            )
        ).toEqual([]);
    });
});

describe('guardPlainText', () => {
    const allowed = [183.6];
    const long = '가'.repeat(400);

    it('빈 문자열을 거부한다', () => {
        expect(
            guardPlainText({ text: '   ', inputChars: 100, allowed })
        ).toEqual({ kind: 'empty' });
    });

    it('절대 하한(200자) 미만을 거부한다', () => {
        const failure = guardPlainText({
            text: '짧은 글',
            inputChars: 100,
            allowed,
        });
        expect(failure).toMatchObject({ kind: 'too_short', min: 200 });
    });

    it('입력 대비 20% 미만을 거부한다', () => {
        const failure = guardPlainText({
            text: '가'.repeat(250),
            inputChars: 5_000,
            allowed,
        });
        expect(failure).toMatchObject({ kind: 'too_short', min: 1_000 });
    });

    it('상한은 두지 않는다 — 타입마다 적정 분량이 다르다', () => {
        expect(
            guardPlainText({
                text: '가'.repeat(20_000),
                inputChars: 1_000,
                allowed,
            })
        ).toBeNull();
    });

    it('지원되지 않는 숫자를 거부한다', () => {
        const failure = guardPlainText({
            text: `${long} 목표가 999.99달러`,
            inputChars: 100,
            allowed,
        });
        expect(failure).toMatchObject({
            kind: 'unsupported_numbers',
            tokens: ['999.99'],
        });
    });

    it('모두 통과하면 null', () => {
        expect(
            guardPlainText({ text: long, inputChars: 100, allowed })
        ).toBeNull();
    });
});

describe('describeFailure', () => {
    it('재시도 문구에 위반 토큰을 담는다', () => {
        expect(
            describeFailure({
                kind: 'unsupported_numbers',
                tokens: ['236.4', '99'],
            })
        ).toContain('236.4, 99');
    });

    it('길이 실패에 목표 길이를 담는다', () => {
        expect(
            describeFailure({ kind: 'too_short', chars: 80, min: 200 })
        ).toContain('200자 이상');
    });
});

describe('findUnsupportedNumbers — 표기 차이를 환각으로 오판하지 않는다', () => {
    /**
     * 이 검사기의 거부는 재작성 폐기(`plain: null`)로 이어져 기능이 조용히 꺼진다.
     * 그래서 "정상 문장을 거부하는 것"이 "환각을 통과시키는 것"보다 비싸다.
     * 아래 다섯은 전부 실제로 거부되던 케이스다(감사 실측).
     */
    it('음수 필드를 산문에서 양수로 쓴 것을 통과시킨다', () => {
        const allowed = buildAllowedNumbers([-3.5], []);
        expect(
            findUnsupportedNumbers('전분기 대비 3.5% 하락했습니다', allowed)
        ).toEqual([]);
    });

    it('음수 소수도 마찬가지', () => {
        const allowed = buildAllowedNumbers([-1.234], []);
        expect(
            findUnsupportedNumbers('지표가 1.234만큼 아래입니다', allowed)
        ).toEqual([]);
    });

    it('한국어 만 단위 분해를 통과시킨다', () => {
        const allowed = buildAllowedNumbers([71500], []);
        expect(
            findUnsupportedNumbers('7만 1500원 근처입니다', allowed)
        ).toEqual([]);
    });

    it('한국어 조·억 단위 분해를 통과시킨다', () => {
        // 42조 3000억 = 42 × 10^12 + 3000 × 10^8
        const allowed = buildAllowedNumbers([42_300_000_000_000], []);
        expect(
            findUnsupportedNumbers('약 42조 3000억원입니다', allowed)
        ).toEqual([]);
    });

    it('연도를 가격으로 오인하지 않는다', () => {
        const allowed = buildAllowedNumbers([], ['가격 100.5']);
        expect(
            findUnsupportedNumbers('2027년까지 지켜봐야 합니다', allowed)
        ).toEqual([]);
    });

    /** 면제는 `년` 접미사에만 걸린다 — 같은 숫자가 가격 자리에 오면 여전히 잡는다. */
    it('연도 면제가 가격 자리의 같은 숫자를 풀어주지 않는다', () => {
        const allowed = buildAllowedNumbers([], ['가격 100.5']);
        expect(
            findUnsupportedNumbers('목표가 2027달러입니다', allowed)
        ).toEqual(['2027']);
    });

    it('관대해진 뒤에도 날조된 가격은 계속 잡는다', () => {
        const allowed = buildAllowedNumbers([-3.5, 71500], []);
        expect(
            findUnsupportedNumbers('지지선은 183.65달러입니다', allowed)
        ).toEqual(['183.65']);
    });
});

describe('guardPlainText — 크기 접미사', () => {
    const long = '가'.repeat(400);

    /**
     * 회귀: 원본 `3,475.2B`(3.48조원)를 `3,475.2억 원`(0.35조)으로 옮긴 사례가 있었다.
     * **10배 축소된 금액이 그대로 화면에 나갔고**, 숫자 자체는 허용 집합에 있어
     * 숫자 가드를 통과했다 — 단위는 아무도 보지 않았다. 접미사를 옮기는 것 자체를 막는다.
     */
    it('B 접미사가 붙은 숫자를 거부한다', () => {
        const failure = guardPlainText({
            text: `${long} 총부채는 3,475.2B 원입니다`,
            inputChars: 100,
            allowed: [3475.2],
        });
        expect(failure).toMatchObject({ kind: 'magnitude_suffix' });
    });

    it('M·K 접미사도 거부한다', () => {
        for (const suffix of ['M', 'K']) {
            expect(
                guardPlainText({
                    text: `${long} 매출 120${suffix} 입니다`,
                    inputChars: 100,
                    allowed: [120],
                })
            ).toMatchObject({ kind: 'magnitude_suffix' });
        }
    });

    it('재시도 문구가 접미사를 지적한다', () => {
        expect(
            describeFailure({ kind: 'magnitude_suffix', tokens: ['3,475.2B'] })
        ).toContain('3,475.2B');
    });

    /** 영문 단어 안의 대문자를 접미사로 오인하면 정상 문장이 거부된다. */
    it('숫자와 무관한 대문자는 건드리지 않는다', () => {
        expect(
            guardPlainText({
                text: `${long} KOSPI 지수와 3 M&A 건이 있습니다`,
                inputChars: 100,
                allowed: [3],
            })
        ).toBeNull();
    });
});

describe('salvageByRemovingSentences', () => {
    const allowed = [183.6, 431.29];
    const long = '괜찮은 문장입니다. '.repeat(30);

    it('위반이 없으면 원문을 그대로 돌려준다', () => {
        expect(salvageByRemovingSentences(long, allowed, 100)).toBe(long);
    });

    it('어긋난 숫자가 든 문장만 도려낸다', () => {
        const text = `${long}\n\n목표가 999.99달러입니다. 지지선은 183.60달러입니다.`;
        const out = salvageByRemovingSentences(text, allowed, 100);
        expect(out).not.toBeNull();
        expect(out).not.toContain('999.99');
        expect(out).toContain('183.60달러');
        expect(out).toContain('괜찮은 문장입니다');
    });

    it('문단이 통째로 비면 그 문단을 없앤다', () => {
        const text = `${long}\n\n목표가 999.99달러입니다.`;
        const out = salvageByRemovingSentences(text, allowed, 100);
        expect(out).not.toContain('999.99');
        expect(out?.includes('\n\n\n')).toBe(false);
    });

    /** 도려낸 결과가 요약도 못 되는 조각이면 살리지 않는다. */
    it('길이 하한에 못 미치면 null', () => {
        expect(
            salvageByRemovingSentences('목표가 999.99달러입니다.', allowed, 100)
        ).toBeNull();
    });

    it('입력이 길면 비율 하한도 함께 본다', () => {
        const text = `${'가'.repeat(300)} 목표가 999.99달러입니다.`;
        expect(salvageByRemovingSentences(text, allowed, 5_000)).toBeNull();
    });
});
