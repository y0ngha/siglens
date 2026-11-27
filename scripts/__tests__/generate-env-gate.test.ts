import { describe, expect, it } from 'vitest';
import type { EnvSpec } from '../../src/shared/config/envRegistry';
import { ENV_GATE_HEADER, renderEnvGate } from '../generate-env-gate';

const spec = (
    name: string,
    requirement: EnvSpec['requirement'],
    sources: EnvSpec['sources']
): EnvSpec => ({
    name,
    requirement,
    sources,
    readBy: ['siglens'],
    note: 'fixture',
});

describe('renderEnvGate', () => {
    it('헤더 한 줄로 시작하고 개행으로 끝난다', () => {
        const out = renderEnvGate([spec('A', 'required', ['ssm'])]);

        expect(out.startsWith(`${ENV_GATE_HEADER}\n`)).toBe(true);
        expect(out.endsWith('\n')).toBe(true);
    });

    it('ssm 키만 싣고 required/optional 라벨을 붙인다', () => {
        const out = renderEnvGate([
            spec('SSM_REQUIRED', 'required', ['ssm']),
            spec('SSM_OPTIONAL', 'optional', ['ssm']),
            spec('BUILD_ONLY', 'optional', ['build-arg']),
            spec('LOCAL_ONLY', 'optional', ['local']),
            spec('PLATFORM_ONLY', 'optional', ['platform']),
        ]);

        expect(out).toBe(
            `${ENV_GATE_HEADER}\noptional SSM_OPTIONAL\nrequired SSM_REQUIRED\n`
        );
    });

    it('override 키도 자기 라벨로 싣는다', () => {
        const out = renderEnvGate([spec('KNOB', 'override', ['ssm'])]);

        expect(out).toBe(`${ENV_GATE_HEADER}\noverride KNOB\n`);
    });

    it('ssm과 다른 경로를 함께 가진 키도 싣는다', () => {
        const out = renderEnvGate([
            spec('BOTH', 'required', ['ssm', 'build-arg']),
        ]);

        expect(out).toContain('required BOTH\n');
    });

    it('이름순으로 정렬한다(입력 순서와 무관, 라벨과 무관)', () => {
        const out = renderEnvGate([
            spec('C', 'required', ['ssm']),
            spec('A', 'optional', ['ssm']),
            spec('B', 'required', ['ssm']),
        ]);

        expect(out.split('\n').slice(1, 4)).toEqual([
            'optional A',
            'required B',
            'required C',
        ]);
    });

    it('입력 배열을 바꾸지 않는다', () => {
        const input = [
            spec('B', 'required', ['ssm']),
            spec('A', 'required', ['ssm']),
        ];

        renderEnvGate(input);

        expect(input.map(s => s.name)).toEqual(['B', 'A']);
    });

    it('ssm 키가 없으면 헤더만 남는다', () => {
        expect(renderEnvGate([spec('X', 'optional', ['local'])])).toBe(
            `${ENV_GATE_HEADER}\n`
        );
    });
});
