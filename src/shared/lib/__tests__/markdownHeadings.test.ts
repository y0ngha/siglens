import {
    parseHeadingLine,
    scanMarkdownLines,
} from '@/shared/lib/markdownHeadings';

describe('parseHeadingLine', () => {
    it('h2·h3 제목을 레벨과 함께 돌려준다', () => {
        expect(parseHeadingLine('## 제목')).toEqual({
            level: 2,
            title: '제목',
        });
        expect(parseHeadingLine('### 소제목')).toEqual({
            level: 3,
            title: '소제목',
        });
    });

    it('여분 공백과 닫는 #을 무시한다', () => {
        expect(parseHeadingLine('##   제목  ##')).toEqual({
            level: 2,
            title: '제목',
        });
    });

    it('h1·h4·본문은 제목이 아니다', () => {
        expect(parseHeadingLine('# 제목')).toBeNull();
        expect(parseHeadingLine('#### 제목')).toBeNull();
        expect(parseHeadingLine('##제목')).toBeNull();
        expect(parseHeadingLine('본문')).toBeNull();
    });
});

describe('scanMarkdownLines', () => {
    it('코드 펜스 안의 제목은 무시한다', () => {
        const lines = scanMarkdownLines(
            ['## 앞', '```', '## 펜스 안', '```', '### 뒤'].join('\n')
        );
        expect(lines.map(l => l.heading?.title ?? null)).toEqual([
            '앞',
            null,
            null,
            null,
            '뒤',
        ]);
        expect(lines.map(l => l.inFence)).toEqual([
            false,
            true,
            true,
            true,
            false,
        ]);
    });

    it('~~~ 펜스도 같게 다루고, 닫히지 않으면 끝까지 펜스 안이다', () => {
        const lines = scanMarkdownLines(['~~~', '## x', '## y'].join('\n'));
        expect(lines.every(l => l.inFence && l.heading === null)).toBe(true);
    });

    it('원문 줄을 그대로 보존한다', () => {
        const text = 'a\n\n## b';
        expect(
            scanMarkdownLines(text)
                .map(l => l.text)
                .join('\n')
        ).toBe(text);
    });
});
