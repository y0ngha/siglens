import { describe, expect, it } from 'vitest';
import {
    buildAllowedNumbers,
    salvageByRemovingSentences,
    describeFailure,
    findAdvicePhrases,
    findStaleDeixis,
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
        expect(guardPlainText({ text: '   ', allowed })).toEqual({
            kind: 'empty',
        });
    });

    it('상한은 두지 않는다 — 타입마다 적정 분량이 다르다', () => {
        expect(
            guardPlainText({
                text: '가'.repeat(20_000),
                allowed,
            })
        ).toBeNull();
    });

    it('지원되지 않는 숫자를 거부한다', () => {
        const failure = guardPlainText({
            text: `${long} 목표가 999.99달러`,
            allowed,
        });
        expect(failure).toMatchObject({
            kind: 'unsupported_numbers',
            tokens: ['999.99'],
        });
    });

    it('모두 통과하면 null', () => {
        expect(guardPlainText({ text: long, allowed })).toBeNull();
    });

    /**
     * 하한 폐지 회귀: 짧은 재작성도 통과해야 한다. 원본보기 토글이 항상 옆에
     * 있어 짧은 글이 내용을 숨기지 않는다 — 원본이 아무리 길어도 이 함수는
     * 그 길이를 아예 받지 않는다(`GuardInput`에 입력 길이 파라미터가 없다).
     */
    it('짧은 재작성도 숫자가 모두 설명되면 통과한다', () => {
        expect(
            guardPlainText({
                text: '지지선은 183.60달러 부근입니다.',
                allowed,
            })
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
            allowed: [3475.2],
        });
        expect(failure).toMatchObject({ kind: 'magnitude_suffix' });
    });

    it('M·K 접미사도 거부한다', () => {
        for (const suffix of ['M', 'K']) {
            expect(
                guardPlainText({
                    text: `${long} 매출 120${suffix} 입니다`,
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
                allowed: [3],
            })
        ).toBeNull();
    });
});

describe('salvageByRemovingSentences', () => {
    const allowed = [183.6, 431.29];
    const long = '괜찮은 문장입니다. '.repeat(30);

    it('위반이 없으면 원문을 그대로 돌려준다', () => {
        expect(salvageByRemovingSentences(long, allowed)).toBe(long);
    });

    it('어긋난 숫자가 든 문장만 도려낸다', () => {
        const text = `${long}\n\n목표가 999.99달러입니다. 지지선은 183.60달러입니다.`;
        const out = salvageByRemovingSentences(text, allowed);
        expect(out).not.toBeNull();
        expect(out).not.toContain('999.99');
        expect(out).toContain('183.60달러');
        expect(out).toContain('괜찮은 문장입니다');
    });

    it('문단이 통째로 비면 그 문단을 없앤다', () => {
        const text = `${long}\n\n목표가 999.99달러입니다.`;
        const out = salvageByRemovingSentences(text, allowed);
        expect(out).not.toContain('999.99');
        expect(out?.includes('\n\n\n')).toBe(false);
    });

    /**
     * 하한 폐지 회귀: 문장 하나만 남아도 그걸 그대로 돌려준다 — 예전에는
     * 5,000자 입력 대비 20% 하한(1,000자)에 못 미쳐 null이었다.
     */
    it('한 문장만 남아도 null이 아니라 그 문장을 돌려준다', () => {
        const text = `${'가'.repeat(300)}. 목표가 999.99달러입니다.`;
        const out = salvageByRemovingSentences(text, allowed);
        expect(out).not.toBeNull();
        expect(out).not.toContain('999.99');
        expect(out).toContain('가'.repeat(300));
    });

    /** 모든 문장이 위반을 안고 있으면 도려낸 결과가 비어 그때는 버린다. */
    it('모든 문장에 지원되지 않는 숫자가 있으면 null', () => {
        expect(
            salvageByRemovingSentences('목표가 999.99달러입니다.', allowed)
        ).toBeNull();
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
    const opts = { allowed: [] as number[] };

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
        const text =
            '株価は上昇しています。流れは続いています。過去の高値は9999です。';
        const salvaged = salvageByRemovingSentences(text, []);

        expect(salvaged).not.toBeNull();
        expect(salvaged).not.toContain('9999');
        // 나머지 두 문장은 남아야 한다 — 옛 분리기는 공백 없는 `。`에서
        // 문단 전체를 문장 하나로 묶어 여기서 null을 냈다.
        expect(salvaged).toContain('株価は上昇しています');
        expect(salvaged).toContain('流れは続いています');
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

/**
 * 2026-10-04 운영 크롤에서 색인된 페이지에 실제로 남아 있던 문장들이다. 프롬프트가
 * 조언을 금지해도 모델이 이런 문장을 만들었으므로 가드가 결과를 직접 검사한다.
 */
describe('findAdvicePhrases — 독자에게 행동을 권하거나 유불리를 평가하는 문장', () => {
    const flagged = [
        '그래서 지금 새로 사기에는 불리한 위치입니다.',
        '추세는 살아 있지만 지금 진입하기에는 위치가 불리하다는 뜻입니다.',
        '이는 진입 시점을 앞당길 근거가 아니라, 조정을 기다려야 하는 구간이라는 뜻입니다.',
        '위쪽의 197.02달러 장애물이 아래쪽의 190.00달러 지지보다 가까워서, 지금 새로 들어가기에는 기다려야 할 근거가 더 큽니다.',
        '지금 가격은 이미 많이 오른 구간의 위쪽에 있어서, 급하게 따라 사기보다는 한 번 눌렸을 때를 확인하는 편이 나은 자리입니다.',
        '나눠서 사는 편이 낫습니다.',
        '관망하세요.',
        '분할 매수하세요.',
        // 2026-10-04 실모델 A/B(새 프롬프트)에서 가드를 빠져나간 문장
        '이렇게 한 방향으로 꾸준히 움직이는 국면에서는 반대로 베팅하는 것이 통계적으로 불리합니다.',
        '확인한 뒤에 움직이는 것이 합리적입니다.',
    ];
    const clean = [
        '다만 지금 당장 급하게 팔려는 움직임이 몰리고 있다는 판정은 아니고, 사야 할 조건도 팔아야 할 조건도 아직 충족되지 않았습니다.',
        '여러 신호를 종합한 점수는 100점 만점에 54점이고, 지금 당장 사거나 팔아야 한다는 신호는 나오지 않았습니다.',
        '다만 이런 신호들은 지금 벌어지는 상황을 설명해 줄 뿐, 사야 한다거나 팔아야 한다는 뜻은 아닙니다.',
        '모건스탠리는 이 회사를 반도체 부문 최고 추천 종목으로 다시 꼽고 12개월 목표주가를 제시했습니다.',
        '한 증권사는 다른 반도체 회사를 추천하면서 이 회사에는 신중한 태도를 보였다고 전해졌습니다.',
        '사모시장과 기술, 인공지능 인프라 쪽으로 사업을 넓히고 있다는 점을 근거로 목표주가 1,256달러를 제시한 매수 추천도 나왔습니다.',
        '222.27달러에는 같은 가격대에서 매수하려는 물량이 몰려 있어, 이 아래로 내려가면 추가 하락 요인이 됩니다.',
        '거래량도 최근 20일 평균의 절반에도 못 미치는 수준으로 줄어 관망하는 사람이 많다는 뜻입니다.',
        '오히려 가격이 다시 위쪽 고점을 향해 반등했기 때문에, 지금은 하락으로 돌아선 것이 아니라 오르는 흐름 중간에 한 번 쉬어간 것으로 보는 편이 맞습니다.',
        '뚜렷한 약세 신호는 없지만, 아직 진입 조건이 충족되지는 않았습니다.',
        '325.81달러 아래로 내려가면 이 흐름은 깨진 것으로 봅니다.',
        // 같은 A/B의 정상 문장 — 구조의 유불리, "불리는데"(호칭)는 행동 평가가 아니다
        '위쪽까지의 거리와 아래쪽까지의 거리를 견주면 1.04로, 어느 쪽도 유리하지 않은 중립 상태입니다.',
        '이런 상태는 보통 한 차례 씻어내는 국면으로 불리는데, 과거에는 이런 자리에서 평균적으로 반등이 나왔습니다.',
        // 형용사 어간이 명사·동사의 접두로 쓰인 경우(리뷰 2라운드)
        '금값이 오르는 것이 안전자산 수요 때문입니다.',
        '가격이 내려가는 것이 시장에서 불리는 이름이 있습니다.',
        '가격이 지지선 위에 머무는 것이 확인되면 흐름이 이어집니다.',
    ];
    // 숫자 가드를 통과시키기 위해 픽스처에 든 가격을 모두 허용한다.
    const allowed = [197.02, 190, 222.27, 325.81, 1256, 100, 54, 20, 12, 1.04];

    it.each(flagged)('걸러낸다: %s', sentence => {
        expect(findAdvicePhrases(sentence)).not.toEqual([]);
        expect(guardPlainText({ text: sentence, allowed })).toEqual({
            kind: 'advice',
            tokens: findAdvicePhrases(sentence),
        });
    });

    it.each(clean)('걸러내지 않는다: %s', sentence => {
        expect(findAdvicePhrases(sentence)).toEqual([]);
        expect(guardPlainText({ text: sentence, allowed })).toBeNull();
    });

    it('일치한 부분 문자열을 돌려준다', () => {
        expect(findAdvicePhrases('지금 새로 사기에는 불리합니다.')).toContain(
            '사기에는'
        );
        expect(findAdvicePhrases('나눠서 사는 편이 낫습니다.')).toContain(
            '는 편이 낫'
        );
    });

    it('다른 단어 안의 `사기에는`은 잡지 않는다', () => {
        expect(findAdvicePhrases('유사기에는 차이가 있습니다.')).toEqual([]);
    });

    it('ko가 아닌 로케일은 항상 빈 배열이다', () => {
        for (const locale of ['en', 'ja', 'zh']) {
            expect(
                findAdvicePhrases('지금 새로 사기에는 불리합니다.', locale)
            ).toEqual([]);
        }
    });

    it('guardPlainText도 ko가 아니면 advice를 보고하지 않는다', () => {
        const failure = guardPlainText({
            text: '지금 새로 사기에는 불리합니다.',
            allowed,
            locale: 'en',
        });
        expect(failure?.kind).not.toBe('advice');
    });

    it('숫자 오류와 조언이 함께 있으면 unsupported_numbers가 먼저다', () => {
        expect(
            guardPlainText({
                text: '목표가 999.99달러이고 지금 새로 사기에는 불리합니다.',
                allowed,
            })?.kind
        ).toBe('unsupported_numbers');
    });
});

describe('describeFailure — advice', () => {
    it('위반 토큰을 담고 베낄 예시 문장은 담지 않는다', () => {
        const message = describeFailure({
            kind: 'advice',
            tokens: ['사기에는'],
        });
        expect(message).toContain('사기에는');
        expect(message).not.toContain('"');
        expect(message).not.toContain('불리한 위치');
        expect(message).not.toContain('오를 때 얻는 것보다');
    });
});

describe('salvageByRemovingSentences — 조언 문장', () => {
    const allowed = [183.6];

    it('조언 문장만 도려내고 나머지 두 문장을 살린다', () => {
        const text =
            '지지선은 183.60달러입니다. 그래서 지금 새로 사기에는 불리한 위치입니다. 이 아래로 내려가면 흐름이 깨집니다.';
        expect(salvageByRemovingSentences(text, allowed)).toBe(
            '지지선은 183.60달러입니다. 이 아래로 내려가면 흐름이 깨집니다.'
        );
    });

    it('모든 문장이 조언이면 null', () => {
        expect(
            salvageByRemovingSentences(
                '관망하세요. 나눠서 사는 편이 낫습니다.',
                allowed
            )
        ).toBeNull();
    });

    it('숫자 위반과 조언을 함께 도려낸다', () => {
        const out = salvageByRemovingSentences(
            '지지선은 183.60달러입니다. 목표가 999.99달러입니다. 관망하세요.',
            allowed
        );
        expect(out).toBe('지지선은 183.60달러입니다.');
    });

    it('조언이 없으면 원문을 그대로 돌려준다', () => {
        const text = '지지선은 183.60달러입니다. 이 아래로 내려가면 깨집니다.';
        expect(salvageByRemovingSentences(text, allowed)).toBe(text);
    });
});

describe('buildAllowedNumbers — facts.asOf 날짜 숫자', () => {
    it('asOf 문구 안의 월·일 숫자를 허용 집합에 넣는다', () => {
        const allowed = buildAllowedNumbers([], ['9월 29일 종가']);
        expect(allowed).toEqual(expect.arrayContaining([9, 29]));
    });
});

describe('findStaleDeixis — 가격 값을 읽는 시점에 기대어 말하는 표현', () => {
    it.each([
        ['지금 주가는 329.40달러입니다', '지금 주가는'],
        ['현재 가격이 183.6달러입니다', '현재 가격이'],
        ['현재의 가격은 약 330달러입니다', '현재의 가격은'],
        ['오늘 시세 $330 부근입니다', '오늘 시세'],
        ['지금주가가 329달러입니다', '지금주가가'],
        ['주가는 지금 329.4달러입니다', '주가는 지금'],
        ['가격은 현재 약 183.6달러입니다', '가격은 현재'],
        ['지금 329.4달러에 거래됩니다', '지금 329.4달러'],
        ['현재 70,000원입니다', '현재 70,000원'],
    ])('걸린다: %s', (text, token) => {
        expect(findStaleDeixis(text)).toEqual([token]);
    });

    /**
     * 합성어와 숫자 없는 상태 서술은 시점에 기대어 값을 말하는 것이 아니다. 걸리면 멀쩡한 글을
     * 두 번 쓰게 한다.
     */
    it.each([
        '9월 29일 종가 기준 주가는 329.40달러입니다',
        '현재 가격대는 320달러에서 330달러 사이입니다',
        '현재 주가수익비율은 25배입니다',
        '현재 주가순자산비율은 3.2배입니다',
        '가격은 현재 저항선에 막혀 있습니다',
        '지금 주가가 지지선 근처에 있습니다',
        '그동안 주가가 꾸준히 올랐습니다',
        '현재 상황에서 거래량이 늘었습니다',
        '지금까지 가격이 한 방향으로 움직였습니다',
        '현재가와 목표가 사이의 거리입니다',
        '오늘날의 시장 구조와 다릅니다',
        '가격이 지금의 두 배가 되려면',
        '현재 시세는 변동이 큰 편입니다',
    ])('걸리지 않는다: %s', text => {
        expect(findStaleDeixis(text)).toEqual([]);
    });

    it('한국어 패턴이므로 ko가 아니면 검사하지 않는다', () => {
        expect(findStaleDeixis('The current price is 329.40', 'en')).toEqual(
            []
        );
        expect(findStaleDeixis('지금 주가는 329달러', 'ja')).toEqual([]);
    });
});

describe('guardPlainText — stale_deixis (연성)', () => {
    it('시점 표현이 있으면 stale_deixis로 보고한다', () => {
        expect(
            guardPlainText({
                text: '지금 주가는 183.60달러입니다.',
                allowed: [183.6],
            })
        ).toEqual({
            kind: 'stale_deixis',
            tokens: ['지금 주가는'],
        });
    });

    it('숫자 위반이 함께 있으면 경성 위반이 먼저 보고된다', () => {
        expect(
            guardPlainText({
                text: '지금 주가는 999.99달러입니다.',
                allowed: [183.6],
            })
        ).toMatchObject({ kind: 'unsupported_numbers' });
    });

    it('조언 위반이 함께 있으면 조언이 먼저 보고된다', () => {
        expect(
            guardPlainText({
                text: '지금 주가는 183.60달러이니 기다리세요.',
                allowed: [183.6],
            })
        ).toMatchObject({ kind: 'advice' });
    });

    it('기준 시점을 붙인 문장은 통과한다', () => {
        expect(
            guardPlainText({
                text: '9월 29일 종가 기준 주가는 183.60달러입니다.',
                allowed: [183.6],
            })
        ).toBeNull();
    });

    it('비-ko에서는 걸리지 않는다', () => {
        expect(
            guardPlainText({
                text: 'The current price is high.',
                allowed: [],
                locale: 'en',
            })
        ).toBeNull();
    });

    it('문장 도려내기 대상이 아니다 — 연성 위반은 글을 깎지 않는다', () => {
        const text = '지금 주가는 183.60달러입니다. 거래량도 많습니다.';
        expect(salvageByRemovingSentences(text, [183.6])).toBe(text);
    });
});

describe('describeFailure — stale_deixis', () => {
    it('걸린 표현과 asOf를 쓰라는 지시를 담되 예시 문장은 넣지 않는다', () => {
        const hint = describeFailure({
            kind: 'stale_deixis',
            tokens: ['지금 주가는'],
        });
        expect(hint).toContain('지금 주가는');
        expect(hint).toContain('facts.asOf');
        // 이 프롬프트의 예시는 출력으로 샌다 — 따옴표 예시 문장이 없어야 한다.
        expect(hint).not.toMatch(/["“”']/);
    });
});
