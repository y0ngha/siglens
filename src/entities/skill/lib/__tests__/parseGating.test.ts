import { describe, expect, it } from 'vitest';
import { parseGating } from '../parseGating';

describe('parseGating', () => {
    describe('event 게이팅', () => {
        // 인라인 배열 YAML 파서는 모든 원소를 문자열로 만들기 때문에 비문자열 trigger는
        // loadSkills 경로로는 parseGating 가드에 닿지 않는다. 원시 객체로 직접 검증한다.
        it('triggers에 비문자열 항목이 섞이면 gating undefined로 fail-open한다', () => {
            expect(
                parseGating({
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold', 42],
                })
            ).toBeUndefined();
        });
    });
});
