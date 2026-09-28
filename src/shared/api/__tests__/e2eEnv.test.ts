import { isE2E } from '../e2eEnv';

describe('isE2E', () => {
    const original = process.env.E2E_TEST;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.E2E_TEST;
            return;
        }
        process.env.E2E_TEST = original;
    });

    it('E2E_TEST=1이면 true를 반환한다', () => {
        process.env.E2E_TEST = '1';

        expect(isE2E()).toBe(true);
    });

    it('E2E_TEST가 1이 아니면 false를 반환한다', () => {
        process.env.E2E_TEST = '0';

        expect(isE2E()).toBe(false);
    });

    it('E2E_TEST가 없으면 false를 반환한다', () => {
        delete process.env.E2E_TEST;

        expect(isE2E()).toBe(false);
    });

    it("'1'이 아닌 truthy 문자열('true')도 false다", () => {
        process.env.E2E_TEST = 'true';

        expect(isE2E()).toBe(false);
    });
});
