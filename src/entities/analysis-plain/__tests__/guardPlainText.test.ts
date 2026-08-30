import { describe, expect, it } from 'vitest';
import {
    buildAllowedNumbers,
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
