import type { getTranslations } from 'next-intl/server';
import type {
    ApiToolArgument,
    ApiToolReference,
} from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { TOOL_SUMMARY_VALUES } from './lib/developersContent';

/** 페이지가 `views.developers` 네임스페이스로 만든 번역기. 카드는 비동기 컴포넌트가 아니라 번역기를 받는다. */
export type DevelopersTranslator = Awaited<ReturnType<typeof getTranslations>>;

interface Props {
    readonly t: DevelopersTranslator;
    readonly tool: ApiToolReference;
}

/** 이 도구의 문서 앵커. 목차 칩과 카드가 같은 규칙을 쓴다. */
export const toolAnchor = (name: string): string => `tool-${name}`;

/** 이 개수를 넘는 열거형은 앞부분만 보이고 나머지는 펼친다 — 좁은 화면에서 인자 열이 목록 하나로 터지는 것을 막는다. */
const ENUM_PREVIEW_LIMIT = 6;
const ENUM_PREVIEW_COUNT = 3;

function ArgumentType({
    arg,
    t,
}: {
    readonly arg: ApiToolArgument;
    readonly t: DevelopersTranslator;
}) {
    const values = arg.enumValues;
    const typeClass =
        'mt-0.5 block font-mono text-xs break-words text-secondary-400';
    if (values === undefined || values.length <= ENUM_PREVIEW_LIMIT)
        return <span className={typeClass}>{arg.type}</span>;
    const rest = values.slice(ENUM_PREVIEW_COUNT);
    return (
        <>
            <span className={typeClass}>
                {arg.array === true ? 'array of ' : ''}
                {values
                    .slice(0, ENUM_PREVIEW_COUNT)
                    .map(value => `"${value}"`)
                    .join(' | ')}
            </span>
            {/* 네이티브 disclosure — 키보드·스크린리더 동작을 브라우저가 맡고, JS 없이도 본문이 크롤된다. */}
            <details className="mt-0.5">
                <summary className="cursor-pointer text-xs text-secondary-300 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none">
                    {t('tools.enumMore', { count: rest.length })}
                </summary>
                <span className="mt-1 block font-mono text-xs break-words text-secondary-400">
                    {rest.map(value => `"${value}"`).join(' | ')}
                </span>
            </details>
        </>
    );
}

/**
 * 도구 하나의 레퍼런스 카드: 사람용 요약(카탈로그, `tools.summaries.<name>`),
 * 인자 표(`inputSchema`), curl 예시.
 *
 * 인자 표는 이름 칸에 타입과 필수 여부를 함께 담는다 — 열을 셋으로 나누면 열거형 타입이 긴 도구
 * (`get_news`의 `category`)가 좁은 화면에서 표를 가로로 밀어낸다.
 */
export function ToolReference({ t, tool }: Props) {
    const id = toolAnchor(tool.name);
    const summaryKey = `tools.summaries.${tool.name}`;
    const summary = t.has(summaryKey)
        ? t(summaryKey, TOOL_SUMMARY_VALUES[tool.name])
        : null;
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
                {tool.byok ? (
                    <span className="ml-2 rounded border border-border-control px-1.5 py-0.5 align-middle font-sans text-xs font-semibold text-secondary-300">
                        {t('tools.byokBadge')}
                    </span>
                ) : null}
            </h3>
            <p className="mt-1 font-mono text-xs break-all text-secondary-400">
                POST {tool.path}
            </p>
            {/* 에이전트용 영어 원문은 이 페이지에 싣지 않는다 — OpenAPI JSON·YAML과 SKILL.md에만 있다.
                요약이 없는 도구는 `developersToolSummaries` 가드 테스트가 운영에 나가지 못하게 막으므로
                여기서는 요약 문단만 생략한다(원문으로 대신 채우지 않는다). */}
            {summary === null ? null : (
                <p className="mt-3 max-w-prose text-[15px] leading-7 text-secondary-200">
                    {summary}
                </p>
            )}
            {tool.byok ? (
                <p className="mt-3 rounded-lg border border-border-control px-3 py-2 text-sm leading-6 text-secondary-200">
                    {t('tools.byokNote')}
                </p>
            ) : null}

            <h4 className="mt-5 text-sm font-semibold text-secondary-100">
                {t('tools.argsTitle')}
            </h4>
            {tool.arguments.length === 0 ? (
                <p className="mt-2 text-sm text-secondary-400">
                    {t('tools.noArgs')}
                </p>
            ) : (
                <div
                    role="region"
                    aria-label={t('tools.argsCaption', { name: tool.name })}
                    tabIndex={0}
                    className="mt-2 overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
                        <caption className="sr-only">
                            {t('tools.argsCaption', { name: tool.name })}
                        </caption>
                        <thead>
                            <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                                <th
                                    scope="col"
                                    className="w-2/5 py-2 pr-3 font-semibold"
                                >
                                    {t('tools.colArgument')}
                                </th>
                                <th scope="col" className="py-2 font-semibold">
                                    {t('tools.colDescription')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {tool.arguments.map(arg => (
                                <tr
                                    key={arg.name}
                                    className="border-b border-secondary-700 align-top last:border-b-0"
                                >
                                    <th
                                        scope="row"
                                        className="py-2.5 pr-3 text-left font-normal"
                                    >
                                        <code className="font-mono text-[13px] font-semibold text-secondary-100">
                                            {arg.name}
                                        </code>
                                        <ArgumentType arg={arg} t={t} />
                                        <span className="mt-0.5 block text-xs text-secondary-400">
                                            {arg.required
                                                ? t('tools.required')
                                                : t('tools.optional')}
                                        </span>
                                    </th>
                                    <td
                                        lang="en"
                                        className="max-w-prose py-2.5 pl-1 leading-6 break-words text-secondary-300"
                                    >
                                        {arg.description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

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
