import { isE2E, isE2EFakeMode } from '../e2eEnv';

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

describe('isE2EFakeMode', () => {
    const original = {
        e2e: process.env.E2E_TEST,
        real: process.env.AGENT_REAL_PROVIDER,
    };
    const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    };

    afterEach(() => {
        restore('E2E_TEST', original.e2e);
        restore('AGENT_REAL_PROVIDER', original.real);
    });

    it('E2E이고 옵트인이 없으면 true', () => {
        process.env.E2E_TEST = '1';
        delete process.env.AGENT_REAL_PROVIDER;
        expect(isE2EFakeMode()).toBe(true);
    });

    it('AGENT_REAL_PROVIDER=1이면 E2E여도 false', () => {
        process.env.E2E_TEST = '1';
        process.env.AGENT_REAL_PROVIDER = '1';
        expect(isE2EFakeMode()).toBe(false);
    });

    it('옵트인 값이 1이 아니면(0, true) 여전히 fake', () => {
        process.env.E2E_TEST = '1';
        process.env.AGENT_REAL_PROVIDER = 'true';
        expect(isE2EFakeMode()).toBe(true);
    });

    it('E2E가 아니면 옵트인과 무관하게 false', () => {
        delete process.env.E2E_TEST;
        delete process.env.AGENT_REAL_PROVIDER;
        expect(isE2EFakeMode()).toBe(false);
    });
});
