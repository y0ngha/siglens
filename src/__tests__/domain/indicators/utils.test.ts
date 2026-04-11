import {
    sma,
    typicalPrice,
    stdDev,
    rollingHighest,
    rollingLowest,
    linreg,
} from '@/domain/indicators/utils';

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

    describe('stdDev', () => {
        describe('입력 배열 길이가 period 미만일 때', () => {
            it('null을 반환한다', () => {
                expect(stdDev([10, 20], 3)).toBeNull();
            });
        });

        describe('모든 값이 동일할 때', () => {
            it('0을 반환한다', () => {
                expect(stdDev([5, 5, 5, 5], 4)).toBeCloseTo(0);
            });
        });

        describe('알려진 값으로 검증할 때', () => {
            it('모집단 표준편차를 반환한다', () => {
                // values: [2, 4, 4, 4, 5, 5, 7, 9], mean=5, variance=4, std=2
                expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9], 8)).toBeCloseTo(2);
            });
        });

        describe('period보다 길 때', () => {
            it('마지막 period개의 표준편차를 계산한다', () => {
                // last 3: [7, 9, 11], mean=9, variance=(4+0+4)/3, std≈2.309
                expect(stdDev([1, 3, 5, 7, 9, 11], 3)).toBeCloseTo(
                    Math.sqrt(8 / 3)
                );
            });
        });
    });

    describe('rollingHighest', () => {
        describe('입력 배열 길이가 period 미만일 때', () => {
            it('null을 반환한다', () => {
                expect(rollingHighest([10], 3)).toBeNull();
            });
        });

        describe('마지막 period개 중 최대값을 반환할 때', () => {
            it('올바른 최대값을 반환한다', () => {
                expect(rollingHighest([1, 5, 3, 2, 4], 3)).toBe(4);
            });
        });

        describe('모든 값이 동일할 때', () => {
            it('해당 값을 반환한다', () => {
                expect(rollingHighest([7, 7, 7], 3)).toBe(7);
            });
        });
    });

    describe('rollingLowest', () => {
        describe('입력 배열 길이가 period 미만일 때', () => {
            it('null을 반환한다', () => {
                expect(rollingLowest([10], 3)).toBeNull();
            });
        });

        describe('마지막 period개 중 최소값을 반환할 때', () => {
            it('올바른 최소값을 반환한다', () => {
                expect(rollingLowest([5, 1, 3, 2, 4], 3)).toBe(2);
            });
        });

        describe('모든 값이 동일할 때', () => {
            it('해당 값을 반환한다', () => {
                expect(rollingLowest([3, 3, 3], 3)).toBe(3);
            });
        });
    });

    describe('linreg', () => {
        describe('입력 배열 길이가 period 미만일 때', () => {
            it('null을 반환한다', () => {
                expect(linreg([10, 20], 3)).toBeNull();
            });
        });

        describe('완전한 선형 상승 데이터일 때', () => {
            it('선의 마지막 값을 반환한다', () => {
                // y = [1,2,3,4,5]: perfect linear, last value = 5
                expect(linreg([1, 2, 3, 4, 5], 5)).toBeCloseTo(5);
            });
        });

        describe('완전한 선형 하락 데이터일 때', () => {
            it('선의 마지막 값을 반환한다', () => {
                // y = [5,4,3,2,1]: perfect linear, last value = 1
                expect(linreg([5, 4, 3, 2, 1], 5)).toBeCloseTo(1);
            });
        });

        describe('모든 값이 동일할 때', () => {
            it('해당 값을 반환한다 (기울기 0인 선)', () => {
                expect(linreg([7, 7, 7, 7, 7], 5)).toBeCloseTo(7);
            });
        });

        describe('period보다 긴 배열일 때', () => {
            it('마지막 period개의 선형 회귀를 계산한다', () => {
                // last 3 values of [0,1,2,3,4]: [2,3,4] → last = 4
                expect(linreg([0, 1, 2, 3, 4], 3)).toBeCloseTo(4);
            });
        });
    });
});
