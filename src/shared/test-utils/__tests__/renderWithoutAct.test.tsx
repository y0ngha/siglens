import { startTransition, useEffect, useState } from 'react';
import { renderWithoutAct } from '@/shared/test-utils/renderWithoutAct';

type ActGlobals = { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('renderWithoutAct', () => {
    it('첫 동기 커밋의 DOM만 넘긴다 — effect에서 채운 값은 아직 없다', () => {
        function Probe() {
            const [value, setValue] = useState('first');
            useEffect(() => {
                startTransition(() => {
                    setValue('effect');
                });
            }, []);
            return <span>{value}</span>;
        }
        let seen = '';
        renderWithoutAct(<Probe />, container => {
            seen = container.textContent ?? '';
        });
        expect(seen).toBe('first');
    });

    it('inspect가 던져도 act 환경 플래그와 컨테이너를 정리한다', () => {
        const globals = globalThis as ActGlobals;
        const before = globals.IS_REACT_ACT_ENVIRONMENT;
        const bodyChildren = document.body.childElementCount;
        let duringFlag: boolean | undefined;
        expect(() =>
            renderWithoutAct(<span />, () => {
                duringFlag = globals.IS_REACT_ACT_ENVIRONMENT;
                throw new Error('boom');
            })
        ).toThrow('boom');
        expect(duringFlag).toBe(false);
        expect(globals.IS_REACT_ACT_ENVIRONMENT).toBe(before);
        expect(document.body.childElementCount).toBe(bodyChildren);
    });
});
