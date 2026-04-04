import { validateKeyLevels } from '@/domain/analysis/keyLevels';
import type { KeyLevels } from '@/domain/types';

describe('keyLevels', () => {
    describe('validateKeyLevels', () => {
        describe('유효한 데이터만 포함할 때', () => {
            it('모든 항목을 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [{ price: 100, reason: '지지선' }],
                    resistance: [{ price: 200, reason: '저항선' }],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '지지선' },
                ]);
                expect(result.resistance).toEqual([
                    { price: 200, reason: '저항선' },
                ]);
            });
        });

        describe('price가 0 이하인 항목이 있을 때', () => {
            it('price가 0인 지지선 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 0, reason: '유효하지 않음' },
                        { price: 100, reason: '유효' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '유효' },
                ]);
            });

            it('price가 음수인 저항선 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [
                        { price: -50, reason: '음수 가격' },
                        { price: 300, reason: '유효' },
                    ],
                };
                const result = validateKeyLevels(input);
                expect(result.resistance).toEqual([
                    { price: 300, reason: '유효' },
                ]);
            });
        });

        describe('reason이 빈 문자열인 항목이 있을 때', () => {
            it('reason이 빈 문자열인 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '' },
                        { price: 150, reason: '유효한 사유' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 150, reason: '유효한 사유' },
                ]);
            });

            it('reason이 공백만 있는 항목을 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '   ' },
                        { price: 200, reason: '유효' },
                    ],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 200, reason: '유효' },
                ]);
            });
        });

        describe('poc 필드 처리', () => {
            it('유효한 poc는 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 150, reason: 'PoC' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toEqual({ price: 150, reason: 'PoC' });
            });

            it('price가 0인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 0, reason: '유효하지 않음' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('reason이 빈 문자열인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 100, reason: '' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('poc가 undefined이면 결과도 undefined이다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });

            it('price가 0이고 reason이 빈 문자열인 poc는 undefined로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                    poc: { price: 0, reason: '' },
                };
                const result = validateKeyLevels(input);
                expect(result.poc).toBeUndefined();
            });
        });

        describe('빈 배열 입력일 때', () => {
            it('빈 support/resistance 배열을 그대로 반환한다', () => {
                const input: KeyLevels = {
                    support: [],
                    resistance: [],
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([]);
                expect(result.resistance).toEqual([]);
            });
        });

        describe('혼합 데이터일 때', () => {
            it('유효한 항목만 남기고 나머지를 제거한다', () => {
                const input: KeyLevels = {
                    support: [
                        { price: 100, reason: '유효' },
                        { price: 0, reason: '가격 무효' },
                        { price: 120, reason: '  ' },
                        { price: 80, reason: '유효 2' },
                    ],
                    resistance: [
                        { price: -10, reason: '음수' },
                        { price: 200, reason: '유효 저항' },
                        { price: 250, reason: '' },
                    ],
                    poc: { price: 150, reason: 'PoC 유효' },
                };
                const result = validateKeyLevels(input);
                expect(result.support).toEqual([
                    { price: 100, reason: '유효' },
                    { price: 80, reason: '유효 2' },
                ]);
                expect(result.resistance).toEqual([
                    { price: 200, reason: '유효 저항' },
                ]);
                expect(result.poc).toEqual({ price: 150, reason: 'PoC 유효' });
            });
        });
    });
});
