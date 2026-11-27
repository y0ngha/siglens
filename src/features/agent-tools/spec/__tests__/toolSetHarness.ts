import {
    buildAgentSystemPrompt as buildCoreAgentSystemPrompt,
    selectToolSetSpecs,
    type AgentToolSpec,
    type BuildAgentSystemPromptInput,
} from '@y0ngha/siglens-core';
import { SIGLENS_AGENT_TOOL_SET } from '@/features/agent-tools/spec/agentToolSet';

/**
 * core의 도구 테스트를 siglens로 옮기면서 쓰는 얇은 연결부. 옮긴 테스트 본문이 core에서 쓰던 이름
 * (`AGENT_TOOL_SPECS`·`findToolSpec`·`selectTools`·`buildAgentSystemPrompt`)을 그대로 쓰되, 그 이름이 core의
 * 내장 모음이 아니라 siglens 모음을 가리키게 한다. 프롬프트는 항상 `toolSet: SIGLENS_AGENT_TOOL_SET`으로
 * 만든다 — 운영의 에이전트 스트림과 같은 조합이다.
 */

/** siglens 모음의 공급자용 명세 전체(루프 전용 필드를 뺀 것), 모음 순서 그대로. */
export const AGENT_TOOL_SPECS: readonly AgentToolSpec[] = selectToolSetSpecs(
    SIGLENS_AGENT_TOOL_SET,
    new Set(SIGLENS_AGENT_TOOL_SET.tools.map(tool => tool.name))
);

export const AGENT_TOOL_NAMES: readonly string[] = AGENT_TOOL_SPECS.map(
    spec => spec.name
);

export function findToolSpec(name: string): AgentToolSpec | undefined {
    return AGENT_TOOL_SPECS.find(spec => spec.name === name);
}

export function selectTools(available: ReadonlySet<string>): AgentToolSpec[] {
    return selectToolSetSpecs(SIGLENS_AGENT_TOOL_SET, available);
}

/** core 프롬프트 빌더에 siglens 모음을 넘긴 것. `toolSet`은 덮어쓸 수 없다. */
export function buildAgentSystemPrompt(
    input: Omit<BuildAgentSystemPromptInput, 'toolSet'>
): string {
    return buildCoreAgentSystemPrompt({
        ...input,
        toolSet: SIGLENS_AGENT_TOOL_SET,
    });
}
