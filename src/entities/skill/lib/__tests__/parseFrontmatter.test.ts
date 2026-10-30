import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../parseFrontmatter';

describe('parseFrontmatter', () => {
    describe('frontmatter가 없는 입력', () => {
        it('null을 돌려준다', () => {
            expect(parseFrontmatter('본문만 있음')).toBeNull();
        });
    });

    describe('frontmatter가 있는 입력', () => {
        it('스칼라·숫자·따옴표 값을 읽고 본문을 trim한다', () => {
            expect(
                parseFrontmatter(
                    '---\nname: "RSI"\nconfidence_weight: 0.5\ndescription: 설명\n---\n\n본문\n'
                )
            ).toEqual({
                data: {
                    name: 'RSI',
                    confidence_weight: 0.5,
                    description: '설명',
                },
                content: '본문',
            });
        });

        it('인라인 배열을 문자열 배열로 읽는다', () => {
            expect(
                parseFrontmatter("---\nindicators: [rsi, 'macd']\n---\n내용")
                    ?.data
            ).toEqual({ indicators: ['rsi', 'macd'] });
        });

        it('빈 배열을 읽는다', () => {
            expect(
                parseFrontmatter('---\nindicators: []\n---\n내용')?.data
            ).toEqual({ indicators: [] });
        });

        it('2칸 들여쓰기 중첩 블록을 읽는다', () => {
            expect(
                parseFrontmatter(
                    '---\ndisplay:\n  chart:\n    show: true\nname: x\n---\n내용'
                )?.data
            ).toEqual({ display: { chart: { show: 'true' } }, name: 'x' });
        });
    });
});
