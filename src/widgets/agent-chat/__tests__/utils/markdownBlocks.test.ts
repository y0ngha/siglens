import { describe, expect, it } from 'vitest';
import { splitMarkdownBlocks } from '@/widgets/agent-chat/utils/markdownBlocks';

describe('splitMarkdownBlocks', () => {
    it('빈 줄로 문단을 나누고, 여러 빈 줄은 하나의 경계다', () => {
        expect(splitMarkdownBlocks('첫 문단\n둘째 줄\n\n\n둘째 문단')).toEqual([
            '첫 문단\n둘째 줄',
            '둘째 문단',
        ]);
    });

    it('빈 문자열·공백만 있으면 블록이 없다', () => {
        expect(splitMarkdownBlocks('')).toEqual([]);
        expect(splitMarkdownBlocks('\n\n  \n')).toEqual([]);
    });

    it('펜스 코드 블록 안의 빈 줄은 경계가 아니다', () => {
        const fence = '```ts\nconst a = 1;\n\nconst b = 2;\n```';
        expect(splitMarkdownBlocks(`앞\n\n${fence}\n\n뒤`)).toEqual([
            '앞',
            fence,
            '뒤',
        ]);
    });

    it('물결 펜스와 더 긴 닫는 펜스도 짝을 맞춘다', () => {
        const fence = '~~~\n\n안\n~~~~';
        expect(splitMarkdownBlocks(`${fence}\n\n뒤`)).toEqual([fence, '뒤']);
    });

    it('스트리밍 중 아직 닫히지 않은 펜스는 끝까지 한 블록이다', () => {
        expect(splitMarkdownBlocks('앞\n\n```\n코드\n\n계속')).toEqual([
            '앞',
            '```\n코드\n\n계속',
        ]);
    });

    it('느슨한 목록(항목 사이 빈 줄)은 한 블록으로 묶는다 — 번호가 다시 시작되지 않게', () => {
        expect(
            splitMarkdownBlocks('1. 하나\n\n2. 둘\n\n3. 셋\n\n다음 문단')
        ).toEqual(['1. 하나\n\n2. 둘\n\n3. 셋', '다음 문단']);
    });

    it('목록 항목 밑의 들여쓴 이어 쓰기는 앞 블록에 붙는다', () => {
        expect(splitMarkdownBlocks('- 항목\n\n  이어지는 설명\n\n끝')).toEqual([
            '- 항목\n\n  이어지는 설명',
            '끝',
        ]);
    });

    it('문단 뒤의 목록은 따로, 목록 뒤의 문단도 따로다', () => {
        expect(splitMarkdownBlocks('문단\n\n- a\n- b\n\n문단')).toEqual([
            '문단',
            '- a\n- b',
            '문단',
        ]);
    });

    it('답변이 끝에서 자라면 앞 블록의 문자열은 그대로다 (memo가 재파싱을 건너뛴다)', () => {
        const before = splitMarkdownBlocks('첫 문단\n\n둘째 문단 쓰는');
        const after = splitMarkdownBlocks('첫 문단\n\n둘째 문단 쓰는 중\n\n셋');
        expect(after[0]).toBe(before[0]);
        expect(after).toHaveLength(3);
    });

    it('게으른 이어 쓰기로 끝난 목록 항목 뒤의 항목도 같은 블록이다 (<ul> 하나)', () => {
        expect(splitMarkdownBlocks('- a\nlazy\n\n- b')).toEqual([
            '- a\nlazy\n\n- b',
        ]);
    });

    it('목록 뒤에 제목이 오면 목록은 닫힌 것이라 다음 목록은 따로다', () => {
        expect(splitMarkdownBlocks('- a\n## 제목\n\n- b')).toEqual([
            '- a\n## 제목',
            '- b',
        ]);
    });

    it('목록이 없는 문단 뒤의 들여쓴 줄은 붙이지 않는다', () => {
        expect(splitMarkdownBlocks('문단\n\n    코드처럼 들여쓴 줄')).toEqual([
            '문단',
            '    코드처럼 들여쓴 줄',
        ]);
    });
});
