import { describe, expect, it } from 'vitest';
import { parseUsageRoles } from '../parseUsageRoles';

describe('parseUsageRoles', () => {
    describe('유효한 입력', () => {
        it('valid usage_roles [confirmation, signal] → usageRoles 정규 순서 [signal, confirmation]', () => {
            expect(parseUsageRoles(['confirmation', 'signal'])).toEqual([
                'signal',
                'confirmation',
            ]);
        });

        it('모든 5개 역할 → 정규 순서로 정렬된다', () => {
            expect(
                parseUsageRoles([
                    'risk',
                    'regime',
                    'confirmation',
                    'measurement',
                    'signal',
                ])
            ).toEqual([
                'signal',
                'confirmation',
                'regime',
                'measurement',
                'risk',
            ]);
        });
    });

    describe('유효하지 않은 입력', () => {
        it('알 수 없는 역할이 포함되면 usageRoles === undefined (fail-open)', () => {
            expect(parseUsageRoles(['signal', 'unknown_role'])).toBeUndefined();
        });

        it('빈 배열 [] → usageRoles === undefined', () => {
            expect(parseUsageRoles([])).toBeUndefined();
        });

        it('중복 역할이 있으면 usageRoles === undefined', () => {
            expect(parseUsageRoles(['signal', 'signal'])).toBeUndefined();
        });

        it('usage_roles 필드 없음 → usageRoles === undefined', () => {
            expect(parseUsageRoles(undefined)).toBeUndefined();
        });

        it('scalar(비배열) usage_roles → usageRoles === undefined', () => {
            expect(parseUsageRoles('signal')).toBeUndefined();
        });
    });
});
