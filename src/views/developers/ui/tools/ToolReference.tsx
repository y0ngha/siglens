import type { ApiToolReference } from '@/entities/siglens-api-key/model';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { TOOL_SUMMARIES } from '../../lib/developersContent';
import { toolAnchor } from '../../lib/toolReference';
import type { DevelopersTranslator } from '../../types';
import { ArgumentTable } from './ArgumentTable';

interface Props {
    readonly t: DevelopersTranslator;
    readonly tool: ApiToolReference;
}

/**
 * 도구 하나의 레퍼런스 카드: 사람용 요약(카탈로그, `TOOL_SUMMARIES`), 인자 표(`inputSchema`), curl 예시.
 * 카드 제목(`h3`)이 목차 칩의 앵커이자 카드(`article`)의 이름이다.
 *
 * 에이전트용 영어 원문 설명은 이 페이지에 싣지 않는다 — OpenAPI JSON·YAML과 SKILL.md에만 있다. 요약이 없는 도구는
 * `developersToolSummaries` 가드 테스트가 운영에 나가지 못하게 막으므로 여기서는 요약 문단만 생략한다(원문으로 대신
 * 채우지 않는다).
 */
export function ToolReference({ t, tool }: Props) {
    const id = toolAnchor(tool.name);
    const summaryMessage = TOOL_SUMMARIES[tool.name];
    return (
        <article
            aria-labelledby={id}
            className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
        >
            <h3
                id={id}
                className={cn(HEADING_SUBSECTION, 'scroll-mt-24 font-mono')}
            >
                {tool.name}
                {/* 배지와의 간격은 여백 클래스가 아니라 공백 텍스트로 둔다 — 여백만 있으면 제목·카드 이름(텍스트)이
                    `run_fresh_analysisBYOK`로 붙는다. */}
                {tool.byok ? (
                    <>
                        {' '}
                        <span className="rounded border border-border-control px-1.5 py-0.5 align-middle font-sans text-xs font-semibold text-secondary-300">
                            {t('tools.byokBadge')}
                        </span>
                    </>
                ) : null}
            </h3>
            <p className="mt-1 font-mono text-xs break-all text-secondary-400">
                POST {tool.path}
            </p>
            {summaryMessage === undefined ? null : (
                <p className="mt-3 max-w-prose text-[15px] leading-7 text-secondary-200">
                    {t(summaryMessage.key, summaryMessage.values)}
                </p>
            )}
            {tool.byok ? (
                <p className="mt-3 rounded-lg border border-border-control px-3 py-2 text-sm leading-6 text-secondary-200">
                    {t('tools.byokNote')}
                </p>
            ) : null}

            {/* h4는 카드 제목(h3, `HEADING_SUBSECTION`)보다 작고 어둡고 가벼워야 한다(DESIGN.md#DS-4). */}
            <h4 className="mt-5 text-sm font-medium text-secondary-300">
                {t('tools.argsTitle')}
            </h4>
            <ArgumentTable t={t} toolName={tool.name} args={tool.arguments} />

            <div className="mt-5">
                <CodeBlock
                    code={tool.curl}
                    language="bash"
                    label={t('tools.curlLabel', { name: tool.name })}
                />
            </div>
        </article>
    );
}
