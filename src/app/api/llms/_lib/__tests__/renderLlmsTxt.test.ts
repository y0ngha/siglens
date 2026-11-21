import type { LlmsDocument, LlmsLink } from '@/app/api/llms/_lib/model';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';

function item(title: string, note?: string): LlmsLink {
    return {
        title,
        url: `https://example.com/${title}`,
        ...(note !== undefined && { note }),
        target: { kind: 'mainPage', path: `/${title}` },
    };
}

const DOCUMENT: LlmsDocument = {
    title: '제목',
    summary: '요약 문장입니다.',
    paragraphs: ['첫 문단.', '둘째 문단.'],
    sections: [
        { heading: '하나', links: [item('a', '설명'), item('b')] },
        { heading: '비어 있음', links: [] },
        { heading: '둘', links: [item('c', '설명 둘')] },
    ],
};

describe('renderLlmsTxt', () => {
    it('H1, 인용문, 문단, 섹션 순서로 빈 줄을 두고 그린다', () => {
        const lines = renderLlmsTxt({
            ...DOCUMENT,
            sections: DOCUMENT.sections.slice(0, 1),
        }).split('\n');

        expect(lines).toEqual([
            '# 제목',
            '',
            '> 요약 문장입니다.',
            '',
            '첫 문단.',
            '',
            '둘째 문단.',
            '',
            '## 하나',
            '',
            '- [a](https://example.com/a): 설명',
            '- [b](https://example.com/b)',
            '',
        ]);
    });

    it('설명이 없으면 `- [제목](주소)`만 그린다', () => {
        expect(renderLlmsTxt(DOCUMENT)).toContain(
            '- [b](https://example.com/b)\n'
        );
        expect(renderLlmsTxt(DOCUMENT)).not.toContain(
            '- [b](https://example.com/b):'
        );
    });

    it('링크가 없는 섹션은 그리지 않는다', () => {
        const text = renderLlmsTxt({
            ...DOCUMENT,
            sections: [{ heading: '비어 있음', links: [] }],
        });

        expect(text).not.toContain('## 비어 있음');
    });

    it('섹션 사이에 빈 줄이 하나 있다', () => {
        expect(renderLlmsTxt(DOCUMENT)).toContain(
            '- [b](https://example.com/b)\n\n## 둘\n'
        );
    });

    it('파일 끝은 정확히 한 번의 개행이고 \\r과 줄 끝 공백이 없다', () => {
        const text = renderLlmsTxt(DOCUMENT);

        expect(text.endsWith('\n')).toBe(true);
        expect(text.endsWith('\n\n')).toBe(false);
        expect(text).not.toContain('\r');
        expect(text).not.toMatch(/[ \t]+\n/);
    });
});
