import { stripMarkdownCodeBlock } from '@/infrastructure/ai/utils';

describe('stripMarkdownCodeBlock', () => {
    describe('입력이 마크다운 코드 블록으로 감싸진 경우', () => {
        it('json 태그가 있는 코드 블록에서 내용을 추출한다', () => {
            const input = '```json\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });

        it('json 태그 없는 코드 블록에서 내용을 추출한다', () => {
            const input = '```\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('입력이 일반 텍스트인 경우', () => {
        it('코드 블록 없이 트림된 원본 텍스트를 반환한다', () => {
            const input = '  {"key": "value"}  ';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('입력 앞뒤에 공백이 있는 경우', () => {
        it('코드 블록 내 앞뒤 공백을 제거한다', () => {
            const input = '```json\n  {"key": "value"}  \n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('코드 블록 앞에 일반 텍스트가 있는 경우', () => {
        it('앞의 텍스트를 무시하고 코드 블록 내용을 반환한다', () => {
            const input = '다음과 같습니다:\n```json\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('코드 블록 뒤에 일반 텍스트가 있는 경우', () => {
        it('뒤의 텍스트를 무시하고 코드 블록 내용을 반환한다', () => {
            const input = '```json\n{"key": "value"}\n```\n이상입니다.';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });
});
