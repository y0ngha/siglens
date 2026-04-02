import { sma, typicalPrice } from '@/domain/indicators/utils';

describe('utils', () => {
    describe('sma', () => {
        describe('빈 배열일 때', () => {
            it('null을 반환한다', () => {
                expect(sma([], 3)).toBeNull();
            });
        });

        describe('입력 배열 길이가 period 미만일 때', () => {
            it('null을 반환한다', () => {
                expect(sma([10, 20], 3)).toBeNull();
            });
        });

        describe('입력 배열 길이가 period와 같을 때', () => {
            it('전체 평균을 반환한다', () => {
                expect(sma([10, 20, 30], 3)).toBeCloseTo(20);
            });
        });

        describe('입력 배열 길이가 period보다 길 때', () => {
            it('마지막 period개의 평균을 반환한다', () => {
                expect(sma([5, 10, 20, 30, 40], 3)).toBeCloseTo(30);
            });
        });

        describe('period가 1일 때', () => {
            it('마지막 값을 반환한다', () => {
                expect(sma([10, 20, 30], 1)).toBeCloseTo(30);
            });
        });

        describe('소수점 값일 때', () => {
            it('정확한 평균을 계산한다', () => {
                expect(sma([1.5, 2.5, 3.5], 3)).toBeCloseTo(2.5);
            });
        });

        describe('동일한 값들일 때', () => {
            it('해당 값을 반환한다', () => {
                expect(sma([50, 50, 50, 50], 3)).toBeCloseTo(50);
            });
        });
    });

    describe('typicalPrice', () => {
        describe('일반적인 봉 데이터일 때', () => {
            it('(high + low + close) / 3을 반환한다', () => {
                expect(typicalPrice(120, 100, 110)).toBeCloseTo(110);
            });
        });

        describe('high, low, close가 동일할 때', () => {
            it('해당 값을 반환한다', () => {
                expect(typicalPrice(50, 50, 50)).toBeCloseTo(50);
            });
        });

        describe('소수점 값일 때', () => {
            it('정확한 전형 가격을 계산한다', () => {
                expect(typicalPrice(10.5, 9.5, 10.0)).toBeCloseTo(10.0);
            });
        });
    });
});
