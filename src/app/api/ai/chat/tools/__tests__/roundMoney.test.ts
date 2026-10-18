import { roundMoney } from '@/app/api/ai/chat/tools/roundMoney';

describe('roundMoney', () => {
    it('반 센트 경계는 부동소수 표현과 무관하게 0에서 먼 쪽으로 올린다', () => {
        expect(roundMoney(150.005, 'USD')).toBe(150.01);
        expect(roundMoney(10.005, 'USD')).toBe(10.01);
        expect(roundMoney(-150.005, 'USD')).toBe(-150.01);
    });

    it('-0과 부동소수 잡음은 0으로 정규화한다', () => {
        expect(Object.is(roundMoney(-0.001, 'USD'), 0)).toBe(true);
        expect(roundMoney(2.2737367544323206e-13, 'USD')).toBe(0);
    });

    it('KRW는 소수 없이 정수로 반올림한다', () => {
        expect(roundMoney(1234.5, 'KRW')).toBe(1235);
    });
});
