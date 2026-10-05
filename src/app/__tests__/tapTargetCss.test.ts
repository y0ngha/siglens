import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS_CSS = readFileSync(
    join(process.cwd(), 'src/app/globals.css'),
    'utf8'
);

/**
 * `.tap-target`은 클래스 이름만 믿고 쓰는 계약이다 — 정의가 지워지거나 `::after` 크기가
 * 줄어도 컴포넌트 테스트(클래스 존재만 본다)와 tsc는 전부 통과한다. 그래서 CSS 자체를
 * 읽어 "가운데 정렬된 24px 이상 가상 상자"라는 계약을 고정한다.
 */
describe('globals.css .tap-target', () => {
    const block = /\.tap-target::after\s*\{([^}]*)\}/.exec(GLOBALS_CSS)?.[1];

    it('::after 규칙이 @layer components 안에 있다', () => {
        const layer = GLOBALS_CSS.indexOf('@layer components');
        const rule = GLOBALS_CSS.indexOf('.tap-target::after');
        expect(layer).toBeGreaterThan(-1);
        expect(rule).toBeGreaterThan(layer);
    });

    it('요소에 position: relative를 줘 ::after의 기준 상자가 된다', () => {
        expect(GLOBALS_CSS).toMatch(
            /\.tap-target\s*\{[^}]*position:\s*relative/
        );
    });

    it('::after는 가운데 정렬된 max(100%, 24px) 상자다 — 레이아웃 크기는 건드리지 않는다', () => {
        expect(block).toBeDefined();
        expect(block).toMatch(/position:\s*absolute/);
        expect(block).toMatch(/top:\s*50%/);
        expect(block).toMatch(/left:\s*50%/);
        expect(block).toMatch(/width:\s*max\(100%,\s*24px\)/);
        expect(block).toMatch(/height:\s*max\(100%,\s*24px\)/);
        expect(block).toMatch(/translate\(-50%,\s*-50%\)/);
    });
});
