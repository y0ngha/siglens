import {
    __resetSignalLabelWarningsForTests,
    createSignalLabelResolver,
} from '@/app/api/cron/email-report/signalLabelResolver';

const DICT: Record<string, string> = {
    'signalType.golden_cross': '골든크로스',
    'signalType.rsi_oversold': 'RSI 과매도',
};

function dictionary() {
    return {
        has: (key: string) => key in DICT,
        label: (key: string) => DICT[key]!,
    };
}

describe('createSignalLabelResolver', () => {
    beforeEach(() => {
        __resetSignalLabelWarningsForTests();
    });

    it('사전에 있는 타입은 라벨을 돌려준다', () => {
        const resolve = createSignalLabelResolver(dictionary(), vi.fn());

        expect(resolve('golden_cross')).toBe('골든크로스');
        expect(resolve('rsi_oversold')).toBe('RSI 과매도');
    });

    it('사전에 없는 타입은 null을 돌려주고 타입 이름을 로그에 남긴다', () => {
        const warn = vi.fn();
        const resolve = createSignalLabelResolver(dictionary(), warn);

        expect(resolve('brand_new_type')).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('brand_new_type')
        );
    });

    it('같은 미등록 타입은 한 번만 로그한다(로케일·리졸버가 달라도)', () => {
        const warn = vi.fn();
        const ko = createSignalLabelResolver(dictionary(), warn);
        const en = createSignalLabelResolver(dictionary(), warn);

        ko('brand_new_type');
        ko('brand_new_type');
        en('brand_new_type');
        en('another_type');

        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('another_type')
        );
    });
});
