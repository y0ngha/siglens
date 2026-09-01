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

describe('guardPlainText — 외국어 혼입', () => {
    const long = '괜찮은 문장입니다. '.repeat(30);

    /**
     * 회귀: `"이是国内 상장사 역사상"` — 모델이 한국어를 쓰다 중국어로 새어 나갔다.
     * 숫자도 용어도 멀쩡해 다른 가드를 전부 통과했고, 블라인드 평가자는 "글이
     * 고장 난 것"으로 읽어 신뢰를 잃었다.
     */
    it('한자가 섞이면 거부한다', () => {
        expect(
            guardPlainText({
                text: `${long} 이是国内 상장사 역사상 최대입니다.`,
                inputChars: 100,
                allowed: [],
            })
        ).toMatchObject({ kind: 'foreign_script' });
    });

    it('재시도 문구가 섞인 글자를 지적한다', () => {
        expect(
            describeFailure({ kind: 'foreign_script', tokens: ['是国内'] })
        ).toContain('是国内');
    });

    /** 종목명·티커는 라틴 문자라 걸리지 않아야 한다. */
    it('영문 티커와 한글만 있는 글은 통과한다', () => {
        expect(
            guardPlainText({
                text: `${long} AAPL과 SK하이닉스는 정상입니다.`,
                inputChars: 100,
                allowed: [],
            })
        ).toBeNull();
    });
});

/**
 * 로케일별 문자 계열 가드.
 *
 * 예전에는 "한자 금지" 하나였다 — 산출물이 한국어라고 못 박고 있었기 때문이다.
 * 로케일 지원이 들어오면서 그 전제가 깨졌고, 실측에서 ja·zh 요청이 한국어로
 * 돌아왔는데 한자를 한 글자도 안 써서 옛 가드가 조용히 통과시켰다.
 */
describe('guardPlainText — 로케일별 금지 문자', () => {
    const long = (s: string) => s.repeat(60);
    const opts = { inputChars: 100, allowed: [] as number[] };

    it('ko 산문에 섞인 한자를 잡는다', () => {
        const v = guardPlainText({
            ...opts,
            text: long('이 종목은 上昇 흐름입니다. '),
            locale: 'ko',
        });
        expect(v?.kind).toBe('foreign_script');
    });

    it('ja 산문의 한자는 정상이다 — 일본어는 한자를 쓴다', () => {
        const v = guardPlainText({
            ...opts,
            text: long('この銘柄は上昇の流れにあります。'),
            locale: 'ja',
        });
        expect(v).toBeNull();
    });

    it('zh 산문의 한자도 정상이다', () => {
        const v = guardPlainText({
            ...opts,
            text: long('该股票目前处于上涨趋势之中。'),
            locale: 'zh',
        });
        expect(v).toBeNull();
    });

    /**
     * 이것이 이 가드를 뒤집은 **이유**다. 옛 가드는 한자만 봤으므로, 일본어를
     * 요청했는데 한국어가 돌아온 산출물을 그대로 통과시켰다.
     */
    it.each(['ja', 'zh', 'en'])(
        '%s 요청에 한국어가 돌아오면 잡는다',
        locale => {
            const v = guardPlainText({
                ...opts,
                text: long('이 종목은 상승 흐름에 있습니다. '),
                locale,
            });
            expect(v?.kind).toBe('foreign_script');
        }
    );

    it('en 산문에 섞인 가나를 잡는다', () => {
        const v = guardPlainText({
            ...opts,
            text: long('The stock is trending up です。 '),
            locale: 'en',
        });
        expect(v?.kind).toBe('foreign_script');
    });

    it('알 수 없는 로케일은 ko 규칙으로 떨어진다 — 프롬프트도 같은 값에서 한국어로 떨어진다', () => {
        const v = guardPlainText({
            ...opts,
            text: long('이 종목은 上昇 흐름입니다. '),
            locale: 'pt-BR',
        });
        expect(v?.kind).toBe('foreign_script');
        expect(
            guardPlainText({
                ...opts,
                text: long('이 종목은 상승 흐름입니다. '),
                locale: 'pt-BR',
            })
        ).toBeNull();
    });

    it('locale을 생략하면 ko와 같다', () => {
        expect(
            guardPlainText({
                ...opts,
                text: long('이 종목은 上昇 흐름입니다. '),
            })?.kind
        ).toBe('foreign_script');
    });
});

describe('buildAllowedNumbers — 자릿수 단위 분해', () => {
    it('만/억 분해 조각을 허용한다 — ko·ja·zh가 같은 자릿수를 쓴다', () => {
        const allowed = buildAllowedNumbers([71500], []);
        expect(allowed).toContain(7); // 7만
        expect(allowed).toContain(1500); // 1500
    });

    it('백만/십억 분해 조각도 허용한다 — 영어는 short scale로 끊는다', () => {
        const allowed = buildAllowedNumbers([3_500_000_000], []);
        expect(allowed).toContain(3); // 3 billion
    });
});

describe('salvageByRemovingSentences — CJK 종결부호', () => {
    /**
     * 일본어·중국어는 `。` 뒤에 공백을 두지 않는다. 공백을 요구하는 분기만 두면
     * 문단 전체가 문장 하나로 잡혀, 살리기가 문장 하나가 아니라 **문단 전체**를
     * 버린다 — 목적과 정반대로 동작한다.
     */
    it('공백 없는 `。`에서도 문장 단위로만 도려낸다', () => {
        // 살리기는 남은 글이 최소 길이(200자)를 넘어야 성공한다 — 문장을
        // 반복해 그 조건을 채운다. 검증 대상은 길이가 아니라 **끊는 위치**다.
        const keep = '株価は上昇しています。流れは続いています。'.repeat(12);
        const text = `${keep}過去の高値は9999です。`;
        const salvaged = salvageByRemovingSentences(text, [], 10);

        expect(salvaged).not.toBeNull();
        expect(salvaged).not.toContain('9999');
        // 나머지 두 문장은 남아야 한다.
        expect(salvaged).toContain('株価は上昇しています');
        expect(salvaged).toContain('流れは続いています');
        // 문단이 통째로 사라지지 않았다는 것 — 옛 분리기는 여기서 null을 냈다.
        expect((salvaged ?? '').length).toBeGreaterThan(200);
    });
});

/**
 * 재무·펀더멘털 탭은 `285.5B` 같은 표기가 데이터의 본질이다. 접미사를 그대로
 * 옮기는 길은 `magnitude_suffix`가 막으므로, **풀어 쓰는 길**은 열려 있어야
 * 한다. 실측: 열려 있지 않아 두 탭의 평이화가 초회·재시도 모두 실패했다.
 */
describe('buildAllowedNumbers — 크기 접미사 표기', () => {
    it('285.5B의 한국어 자릿수 표기(2,855억)를 허용한다', () => {
        const allowed = buildAllowedNumbers([], ['총부채는 285.5B입니다']);

        expect(
            findUnsupportedNumbers('총부채는 2,855억 달러입니다', allowed)
        ).toEqual([]);
    });

    it('접미사를 그대로 옮기는 것은 여전히 막는다', () => {
        const allowed = buildAllowedNumbers([], ['총부채는 285.5B입니다']);
        const verdict = guardPlainText({
            text: '총부채는 285.5B입니다. '.repeat(30),
            inputChars: 100,
            allowed,
        });

        expect(verdict?.kind).toBe('magnitude_suffix');
    });

    it('M·K도 같은 규칙을 따른다', () => {
        const allowed = buildAllowedNumbers([], ['영업이익 12.7M, 배당 500K']);

        expect(allowed).toContain(12_700_000);
        expect(allowed).toContain(500_000);
    });
});
