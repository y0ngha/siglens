// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    FIRST_INPUT_EVENTS,
    FIRST_INPUT_FLAG,
    FIRST_INPUT_PROBE_SCRIPT,
    hadFirstInputBeforeHydration,
} from '@/features/pwa-install/lib/firstInputProbe';

function runProbe(): void {
    // 레이아웃이 인라인 `<script>`로 싣는 것과 같은 문자열을 그대로 실행한다.
    new Function(FIRST_INPUT_PROBE_SCRIPT)();
}

describe('firstInputProbe', () => {
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>)[FIRST_INPUT_FLAG];
    });

    it('입력이 없으면 하이드레이션 전 입력이 없다고 본다', () => {
        runProbe();
        expect(hadFirstInputBeforeHydration()).toBe(false);
    });

    it.each(FIRST_INPUT_EVENTS)(
        '%s가 오면 플래그를 남긴다 — 대상이 전파를 막아도(캡처 단계)',
        type => {
            runProbe();
            const button = document.createElement('button');
            button.addEventListener(type, e => e.stopPropagation());
            document.body.append(button);
            button.dispatchEvent(new Event(type, { bubbles: true }));
            expect(hadFirstInputBeforeHydration()).toBe(true);
            button.remove();
        }
    );

    /** 훅의 방아쇠(`click`·`keydown` + 지연 `pointerup`)와 같은 집합이어야 놓치는 입력이 없다. */
    it('훅의 방아쇠와 같은 이벤트를 본다', () => {
        expect([...FIRST_INPUT_EVENTS].sort()).toEqual(
            ['click', 'keydown', 'pointerup'].sort()
        );
    });

    /**
     * `next/script`의 `beforeInteractive`는 Next 런타임이 로드될 때 실행돼 하이드레이션과 거의 같은
     * 시점이다 — 그렇게 실으면 이 장치가 존재 이유를 잃는다. 두 루트 레이아웃이 인라인
     * `<script>`로 싣는지 고정한다.
     */
    it.each(['src/app/[locale]/layout.tsx', 'src/app/ai/[locale]/layout.tsx'])(
        '%s가 프로브를 인라인 <script>로 싣는다',
        rel => {
            const source = readFileSync(
                path.resolve(__dirname, '../../../../..', rel),
                'utf8'
            );
            expect(source).toMatch(
                /<script\s+dangerouslySetInnerHTML=\{\{\s*__html: FIRST_INPUT_PROBE_SCRIPT,?\s*\}\}/
            );
        }
    );
});
