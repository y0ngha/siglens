// @vitest-environment jsdom
import { focusSearchSurface } from '@/features/ticker-search/lib/focusSearchSurface';

describe('focusSearchSurface', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    function setup() {
        const trigger = document.createElement('button');
        const desktop = document.createElement('div');
        const input = document.createElement('input');
        desktop.append(input);
        document.body.append(trigger, desktop);
        return { trigger, desktop, input };
    }

    it('트리거가 보이면 트리거로 보낸다', () => {
        const { trigger, desktop } = setup();
        focusSearchSurface(trigger, desktop);
        expect(document.activeElement).toBe(trigger);
    });

    it('트리거가 숨겨져 있으면 데스크톱 입력으로 보낸다', () => {
        const { trigger, desktop, input } = setup();
        trigger.style.display = 'none';
        focusSearchSurface(trigger, desktop);
        expect(document.activeElement).toBe(input);
    });

    it('트리거가 없으면(provider 없음) 데스크톱 입력으로 보낸다', () => {
        const { desktop, input } = setup();
        focusSearchSurface(null, desktop);
        expect(document.activeElement).toBe(input);
    });
});
