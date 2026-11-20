import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    PANEL_HANDLE_WIDTH,
    PANEL_MAX_ROW_SHARE,
} from '@/views/symbol/hooks/usePanelResize';

/**
 * 패널 폭 상한은 두 곳에 있다. 렌더는 `ChartContent.tsx`의 Tailwind 클래스
 * (`md:w-[min(var(--panel-width),calc(45%-4px))]`), 드래그·키보드·ARIA 값은
 * `usePanelResize.ts`의 상수다. 한쪽만 바뀌면 구분선이 보고하는 폭이 화면과 어긋나므로
 * 클래스 리터럴을 소스에서 읽어 상수와 맞춘다. 리터럴을 못 찾으면 조용히 통과하지 않고 실패한다.
 */
describe('ChartContent 패널 폭 상한 — CSS와 상수 동기화', () => {
    const source = readFileSync(
        join(process.cwd(), 'src/views/symbol/ChartContent.tsx'),
        'utf-8'
    );
    const match =
        /md:w-\[min\(var\(--panel-width\),calc\((\d+(?:\.\d+)?)%-(\d+(?:\.\d+)?)px\)\)\]/.exec(
            source
        );

    it('ChartContent.tsx에서 상한 클래스 리터럴을 찾는다', () => {
        expect(match).not.toBeNull();
    });

    it('퍼센트가 PANEL_MAX_ROW_SHARE와 같다', () => {
        expect(Number(match?.[1]) / 100).toBeCloseTo(PANEL_MAX_ROW_SHARE, 10);
    });

    it('핸들 폭(px)이 PANEL_HANDLE_WIDTH와 같다', () => {
        expect(Number(match?.[2])).toBe(PANEL_HANDLE_WIDTH);
    });
});
