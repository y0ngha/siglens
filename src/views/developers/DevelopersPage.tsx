import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import type { ApiToolReference } from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import {
    API_KEY_ENV_NAME,
    API_KEY_MAX_ACTIVE_PER_USER,
    LOCALE_HEADER_DOC_NAME,
    API_KEY_PREFIX,
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_DOC_PATHS,
    PUBLIC_API_RATE_LIMITS,
} from '@/shared/config/publicApi';
import type { Locale } from '@/shared/i18n/locales';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import {
    ACCOUNT_PATH,
    DEVELOPER_SECTION_IDS,
    ERROR_RESPONSE_EXAMPLE,
    QUICKSTART_TOOL,
    SKILL_FILE_NAME,
    SUCCESS_RESPONSE_EXAMPLE,
    type DeveloperSectionId,
} from './lib/developersContent';
import { ToolReference, toolAnchor } from './ToolReference';

interface Props {
    readonly locale: Locale;
    /** Breadcrumb label, shared with the `BreadcrumbList` JSON-LD. */
    readonly title: string;
    /** 사이트 origin(끝 슬래시 없음). 예시 URL과 내려받기 링크의 기준이다. */
    readonly baseUrl: string;
    /** 노출 도구의 문서 표현 — OpenAPI 문서와 같은 빌더에서 온다. */
    readonly tools: readonly ApiToolReference[];
    /** `DEVELOPERS_UPDATED_AT`, already formatted for the locale. */
    readonly updatedAt: string;
}

const BODY = 'max-w-2xl text-[15px] leading-7 text-secondary-300';

const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 섹션 목차 링크. 좁은 화면에서는 줄바꿈되는 칩 줄, `lg` 이상에서는 왼쪽 경계선을 낀 세로 목록이다
 * (같은 `<nav>` 하나가 두 배치를 다 맡아 링크가 DOM에 한 벌만 있다).
 */
const TOC_LINK =
    'inline-flex min-h-11 items-center rounded px-2 text-sm text-secondary-300 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none lg:min-h-9 lg:w-full';

const INLINE_CODE =
    'rounded bg-secondary-800 px-1 py-0.5 font-mono text-[13px] text-secondary-100';

interface SectionProps {
    readonly id: DeveloperSectionId;
    readonly title: string;
    readonly sub?: string;
    readonly children: ReactNode;
}

function Section({ id, title, sub, children }: SectionProps) {
    return (
        <section aria-labelledby={id} className="mt-14 first:mt-0">
            <h2 id={id} className={cn(HEADING_SECTION, 'scroll-mt-24')}>
                {title}
            </h2>
            {sub ? (
                <p className="mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400">
                    {sub}
                </p>
            ) : null}
            {children}
        </section>
    );
}

interface InfoRow {
    readonly term: string;
    readonly body: string;
    /** 본문 뒤에 붙는 현지어 보충 문장(본문이 영어 원문이어도 이 문장은 페이지 언어다). */
    readonly note?: string;
}

/** 이름-설명 두 열 표. 첫 열이 행 머리(`th scope="row"`)라 스크린리더가 행을 이름으로 읽는다. */
function InfoTable({
    caption,
    termHeading,
    bodyHeading,
    rows,
    bodyLang,
}: {
    readonly caption: string;
    readonly termHeading: string;
    readonly bodyHeading: string;
    readonly rows: readonly InfoRow[];
    readonly bodyLang?: string;
}) {
    return (
        <div
            // 좁은 화면에서 가로 스크롤되는 표 — 키보드로 닿도록 이름 붙은 `region` + `tabIndex={0}`.
            role="region"
            aria-label={caption}
            tabIndex={0}
            className="mt-4 overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                        <th
                            scope="col"
                            className="w-1/2 py-2 pr-3 font-semibold sm:w-2/5"
                        >
                            {termHeading}
                        </th>
                        <th scope="col" className="py-2 font-semibold">
                            {bodyHeading}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr
                            key={row.term}
                            className="border-b border-secondary-700 align-top last:border-b-0"
                        >
                            <th
                                scope="row"
                                className="py-2.5 pr-3 text-left font-normal"
                            >
                                <code className="font-mono text-xs font-semibold break-words text-secondary-100 sm:text-[13px]">
                                    {row.term}
                                </code>
                            </th>
                            <td className="py-2.5 leading-6 text-secondary-300">
                                <span lang={bodyLang}>{row.body}</span>
                                {row.note ? (
                                    <span className="mt-1 block text-xs text-secondary-400">
                                        {row.note}
                                    </span>
                                ) : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface DownloadCardProps {
    /** `PUBLIC_API_DOC_PATHS`의 값. 링크와 파일 이름이 여기서 나온다. */
    readonly path: (typeof PUBLIC_API_DOC_PATHS)[keyof typeof PUBLIC_API_DOC_PATHS];
    readonly body: string;
    /** 버튼 글자(`openapi.json 내려받기`). 파일 이름이 들어가 번역기가 필요해 호출부가 만든다. */
    readonly action: string;
}

/** `/openapi.json` → `openapi.json`. 확장자가 없는 Skill 경로만 `SKILL.md`로 받는다. */
function downloadFileName(path: DownloadCardProps['path']): string {
    return path === PUBLIC_API_DOC_PATHS.skill
        ? SKILL_FILE_NAME
        : path.replace(/^\//, '');
}

function DownloadCard({ path, body, action }: DownloadCardProps) {
    const file = downloadFileName(path);
    return (
        <li className={cn(SURFACE_CARD, 'flex flex-col p-4 sm:p-5')}>
            <h3 className={cn(HEADING_SUBSECTION, 'font-mono')}>{file}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-secondary-300">
                {body}
            </p>
            {/* 같은 오리진 파일 다운로드라 next/link가 아니라 일반 앵커다(크롤러도 파일 링크로 읽는다).
                상대 경로(계정 화면의 Skill 링크와 같다) — 미리보기·로컬 환경에서도 그 서버의 파일을 받는다. */}
            <a
                href={`${PUBLIC_API_BASE_PATH}${path}`}
                download={file}
                className={cn(BUTTON_OUTLINE, 'mt-4 h-10 px-4 text-sm')}
            >
                {action}
            </a>
        </li>
    );
}

/**
 * `siglens.io/developers`: 공개 API(`/api/v1`)의 개발자 포털. 작은 레퍼런스 페이지다 — 카드와 표,
 * 코드 블록과 복사 버튼만 쓰고 전부 서버 렌더 텍스트라 크롤러가 본문 전체를 받는다(복사 버튼만 클라이언트).
 *
 * **같은 소스에서 나온 문서다.** 도구 목록·인자 표·curl 예시는 `/api/v1/openapi.json`, SKILL.md,
 * `GET /tools`와 같은 도구 스펙(`tools` props)에서 오고, 한도 숫자는 `PUBLIC_API_RATE_LIMITS`, 오류 코드는
 * `API_ERROR_DOCS`에서 온다 — 문구에 숫자를 따로 적지 않는다(ICU 인자). 카드에는 카탈로그의 사람용 요약
 * (`tools.summaries.<name>`)만 두고, 코어가 에이전트용으로 영어로 쓴 도구 설명은 이 페이지에 싣지 않는다 —
 * 그 원문은 OpenAPI JSON·YAML과 SKILL.md에만 있다. 인자 설명은 영어 그대로 `lang="en"`으로 보여 준다.
 */
export async function DevelopersPage({
    locale,
    title,
    baseUrl,
    tools,
    updatedAt,
}: Props) {
    const t = await getTranslations({
        locale,
        namespace: 'views.developers',
    });
    const apiBase = `${baseUrl}${PUBLIC_API_BASE_PATH}`;
    const docUrl = (path: string): string => `${apiBase}${path}`;

    // 제목을 id로 묶어 둔 표 — `Record`라 새 섹션 id를 추가하고 제목을 빠뜨리면 컴파일이 실패하고, 목차 순서는
    // `DEVELOPER_SECTION_IDS` 하나가 정한다.
    const sectionTitles: Record<DeveloperSectionId, string> = {
        quickstart: t('quickstart.title'),
        authentication: t('authentication.title'),
        'rate-limits': t('rateLimits.title'),
        responses: t('responses.title'),
        streaming: t('streaming.title'),
        locale: t('localeSection.title'),
        tools: t('tools.title'),
        downloads: t('downloads.title'),
    };
    const toc = DEVELOPER_SECTION_IDS.map(
        id => [id, sectionTitles[id]] as const
    );

    const rateLimitHeaders: readonly InfoRow[] = [
        {
            term: 'X-RateLimit-Limit',
            body: t('rateLimits.headerLimit'),
        },
        {
            term: 'X-RateLimit-Remaining',
            body: t('rateLimits.headerRemaining'),
        },
        { term: 'X-RateLimit-Reset', body: t('rateLimits.headerReset') },
        { term: 'X-RateLimit-AI-Limit', body: t('rateLimits.headerAiLimit') },
        {
            term: 'X-RateLimit-AI-Remaining',
            body: t('rateLimits.headerAiRemaining'),
        },
        { term: 'X-RateLimit-AI-Reset', body: t('rateLimits.headerAiReset') },
        { term: 'Retry-After', body: t('rateLimits.headerRetryAfter') },
    ];

    // 상태 코드 순으로, 같은 상태 안에서는 카탈로그 순서 그대로.
    const errorRows: readonly InfoRow[] = API_ERROR_DOCS.toSorted(
        (a, b) => a.status - b.status
    ).map(doc => ({
        term: `${doc.status} ${doc.code}`,
        body: doc.summary,
        // 카탈로그가 `streamed`로 표시한 코드(`run_fresh_analysis`가 스트림 안에서 낼 수 있는 것)에만 보충 문장을 붙인다.
        ...(doc.streamed === true ? { note: t('responses.streamedNote') } : {}),
    }));

    const freshTool = tools.find(tool => tool.byok);
    const quickstartTool = tools.find(tool => tool.name === QUICKSTART_TOOL);

    const quickstartSteps: readonly {
        readonly title: string;
        readonly body: string;
        readonly content: ReactNode;
    }[] = [
        {
            title: t('quickstart.step1Title'),
            body: t('quickstart.step1Body', {
                max: API_KEY_MAX_ACTIVE_PER_USER,
            }),
            content: (
                <LocaleLink
                    href={ACCOUNT_PATH}
                    prefetch={false}
                    className={TEXT_LINK}
                >
                    {t('quickstart.step1Link')}
                </LocaleLink>
            ),
        },
        {
            title: t('quickstart.step2Title'),
            body: t('quickstart.step2Body'),
            content: (
                <CodeBlock
                    code={`export ${API_KEY_ENV_NAME}=${API_KEY_PREFIX}…`}
                    language="bash"
                    label={t('quickstart.step2Label')}
                />
            ),
        },
        {
            title: t('quickstart.step3Title'),
            body: t('quickstart.step3Body'),
            content: (
                <div className="flex flex-col gap-3">
                    <CodeBlock
                        code={[
                            `curl -s ${apiBase}/me \\`,
                            `  -H "Authorization: Bearer $${API_KEY_ENV_NAME}"`,
                        ].join('\n')}
                        language="bash"
                        label={t('quickstart.meLabel')}
                    />
                    {quickstartTool ? (
                        <CodeBlock
                            code={quickstartTool.curl}
                            language="bash"
                            label={t('quickstart.toolLabel', {
                                name: quickstartTool.name,
                            })}
                        />
                    ) : null}
                </div>
            ),
        },
        {
            title: t('quickstart.skillTitle'),
            body: t('quickstart.skillBody', { env: API_KEY_ENV_NAME }),
            content: (
                <>
                    <CodeBlock
                        code={[
                            'mkdir -p ~/.claude/skills/siglens',
                            `curl -s ${docUrl(PUBLIC_API_DOC_PATHS.skill)} \\`,
                            '  -o ~/.claude/skills/siglens/SKILL.md',
                        ].join('\n')}
                        language="bash"
                        label={t('quickstart.skillLabel')}
                    />
                    <p className="mt-3 text-sm leading-6 text-secondary-300">
                        {t('quickstart.skillClaudeAi')}
                    </p>
                </>
            ),
        },
    ];

    const downloadOf = (
        path: DownloadCardProps['path'],
        body: string
    ): DownloadCardProps => ({
        path,
        body,
        action: t('downloads.action', { file: downloadFileName(path) }),
    });
    const downloads: readonly DownloadCardProps[] = [
        downloadOf(PUBLIC_API_DOC_PATHS.openapiJson, t('downloads.jsonBody')),
        downloadOf(PUBLIC_API_DOC_PATHS.openapiYaml, t('downloads.yamlBody')),
        downloadOf(PUBLIC_API_DOC_PATHS.skill, t('downloads.skillBody')),
    ];

    return (
        <main className="relative isolate flex-1 pb-16">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:pt-8">
                <Breadcrumb trail={[{ label: title }]} />

                <header className="max-w-3xl pb-8">
                    <p className="text-sm font-medium text-secondary-400">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                        {t('hero.title')}
                    </h1>
                    <p className="mt-4 text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.lede')}
                    </p>
                    <p className="mt-3 text-base leading-7 text-pretty text-secondary-300">
                        {t('hero.byok')}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <LocaleLink
                            href={ACCOUNT_PATH}
                            prefetch={false}
                            className={cn(BUTTON_PRIMARY, 'h-11 px-5 text-sm')}
                        >
                            {t('hero.createKey')}
                        </LocaleLink>
                        <a
                            href="#quickstart"
                            className={cn(BUTTON_OUTLINE, 'h-11 px-5 text-sm')}
                        >
                            {t('hero.quickstart')}
                        </a>
                    </div>
                </header>

                <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
                    <nav
                        aria-label={t('toc.label')}
                        className="mb-10 border-y border-secondary-700 py-2 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:mb-0 lg:self-start lg:border-y-0 lg:border-l lg:py-0"
                    >
                        <ul className="flex flex-wrap gap-x-1 lg:flex-col lg:gap-x-0">
                            {toc.map(([id, label]) => (
                                <li key={id} className="lg:w-full">
                                    <a
                                        href={`#${id}`}
                                        className={cn(TOC_LINK, 'lg:pl-4')}
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="min-w-0">
                        <Section
                            id="quickstart"
                            title={sectionTitles['quickstart']}
                            sub={t('quickstart.sub')}
                        >
                            <ol className="mt-6 flex flex-col gap-4">
                                {quickstartSteps.map(step => (
                                    <li
                                        key={step.title}
                                        className={cn(
                                            SURFACE_CARD,
                                            'p-4 sm:p-5'
                                        )}
                                    >
                                        <h3 className={HEADING_SUBSECTION}>
                                            {step.title}
                                        </h3>
                                        <p className="mt-1 mb-3 text-sm leading-6 text-secondary-300">
                                            {step.body}
                                        </p>
                                        {step.content}
                                    </li>
                                ))}
                            </ol>
                        </Section>

                        <Section
                            id="authentication"
                            title={sectionTitles['authentication']}
                            sub={t('authentication.sub')}
                        >
                            <div className="mt-4 max-w-2xl">
                                <CodeBlock
                                    code={`Authorization: Bearer ${API_KEY_PREFIX}…`}
                                    language="http"
                                    label={t('authentication.headerLabel')}
                                />
                            </div>
                            <ul className="mt-4 flex max-w-2xl list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                                <li>{t('authentication.failure')}</li>
                                <li>{t('authentication.cookies')}</li>
                                <li>{t('authentication.revoke')}</li>
                            </ul>
                            <div className="mt-6 rounded-lg border border-secondary-700 px-4 py-4 sm:px-5">
                                <h3 className="text-sm font-semibold text-secondary-100">
                                    {t('authentication.byokTitle')}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-secondary-300">
                                    {t('authentication.byokBody')}
                                </p>
                            </div>
                        </Section>

                        <Section
                            id="rate-limits"
                            title={sectionTitles['rate-limits']}
                            sub={t('rateLimits.sub')}
                        >
                            <p className={cn(BODY, 'mt-4')}>
                                {t('rateLimits.body', {
                                    dataPerMinute:
                                        PUBLIC_API_RATE_LIMITS.data.perMinute,
                                    dataPerDay:
                                        PUBLIC_API_RATE_LIMITS.data.perDay,
                                    aiPerMinute:
                                        PUBLIC_API_RATE_LIMITS.ai.perMinute,
                                    aiPerDay: PUBLIC_API_RATE_LIMITS.ai.perDay,
                                })}
                            </p>
                            <p className={cn(BODY, 'mt-3')}>
                                {t('rateLimits.over')}
                            </p>
                            <InfoTable
                                caption={t('rateLimits.tableCaption')}
                                termHeading={t('rateLimits.colHeader')}
                                bodyHeading={t('rateLimits.colMeaning')}
                                rows={rateLimitHeaders}
                            />
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary-400">
                                {t('rateLimits.unmetered')}
                            </p>
                        </Section>

                        <Section
                            id="responses"
                            title={sectionTitles['responses']}
                            sub={t('responses.sub')}
                        >
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-secondary-100">
                                        {t('responses.successTitle')}
                                    </p>
                                    <CodeBlock
                                        code={SUCCESS_RESPONSE_EXAMPLE}
                                        language="json"
                                        label={t('responses.successLabel')}
                                    />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-secondary-100">
                                        {t('responses.errorTitle')}
                                    </p>
                                    <CodeBlock
                                        code={ERROR_RESPONSE_EXAMPLE}
                                        language="json"
                                        label={t('responses.errorLabel')}
                                    />
                                </div>
                            </div>
                            <p className={cn(BODY, 'mt-4')}>
                                {t('responses.truncated')}
                            </p>
                            <p className={cn(BODY, 'mt-3')}>
                                {t('responses.errorAdvice')}
                            </p>
                            <h3 className={cn(HEADING_SUBSECTION, 'mt-8')}>
                                {t('responses.codesTitle')}
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary-400">
                                {t('responses.codesNote')}
                            </p>
                            <InfoTable
                                caption={t('responses.tableCaption')}
                                termHeading={t('responses.colCode')}
                                bodyHeading={t('responses.colMeaning')}
                                rows={errorRows}
                                bodyLang="en"
                            />
                        </Section>

                        <Section
                            id="streaming"
                            title={sectionTitles['streaming']}
                            sub={t('streaming.sub')}
                        >
                            <p className={cn(BODY, 'mt-4')}>
                                {t('streaming.how', {
                                    deadline: FRESH_ANALYSIS_DEADLINE_SECONDS,
                                })}
                            </p>
                            <p className={cn(BODY, 'mt-3')}>
                                {t('streaming.parse')}
                            </p>
                            <p className={cn(BODY, 'mt-3')}>
                                {t('streaming.disconnect')}
                            </p>
                            <p className={cn(BODY, 'mt-3')}>
                                {t('streaming.early')}
                            </p>
                            {freshTool ? (
                                <div className="mt-4">
                                    <CodeBlock
                                        code={[
                                            freshTool.curl,
                                            "  | jq 'if .error then {failed: .error} else .data end'",
                                        ].join('\n')}
                                        language="bash"
                                        label={t('streaming.exampleLabel')}
                                    />
                                </div>
                            ) : null}
                        </Section>

                        <Section
                            id="locale"
                            title={sectionTitles['locale']}
                            sub={t('localeSection.sub')}
                        >
                            <p className={cn(BODY, 'mt-4')}>
                                {t('localeSection.body', {
                                    header: LOCALE_HEADER_DOC_NAME,
                                })}
                            </p>
                            <div className="mt-4 max-w-2xl">
                                <CodeBlock
                                    code={`${LOCALE_HEADER_DOC_NAME}: en`}
                                    language="http"
                                    label={t('localeSection.exampleLabel')}
                                />
                            </div>
                        </Section>

                        <Section
                            id="tools"
                            title={sectionTitles['tools']}
                            sub={t('tools.sub')}
                        >
                            <p className={cn(BODY, 'mt-4')}>
                                {t('tools.note')}
                            </p>
                            <ul
                                aria-label={t('tools.indexLabel')}
                                className="mt-3 flex flex-wrap gap-x-1"
                            >
                                {tools.map(tool => (
                                    <li key={tool.name}>
                                        <a
                                            href={`#${toolAnchor(tool.name)}`}
                                            className={cn(
                                                TOC_LINK,
                                                'font-mono text-[13px]'
                                            )}
                                        >
                                            {tool.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-6 flex flex-col gap-4">
                                {tools.map(tool => (
                                    <ToolReference
                                        key={tool.name}
                                        t={t}
                                        tool={tool}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section
                            id="downloads"
                            title={sectionTitles['downloads']}
                            sub={t('downloads.sub')}
                        >
                            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                                {downloads.map(item => (
                                    <DownloadCard key={item.path} {...item} />
                                ))}
                            </ul>
                            <p className="mt-6 max-w-2xl text-sm leading-6 text-secondary-400">
                                {t('downloads.baseUrl')}{' '}
                                <code className={INLINE_CODE}>{apiBase}</code>
                            </p>
                        </Section>

                        <p className="mt-14 text-xs text-secondary-400">
                            {t('updatedAt', { date: updatedAt })}
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
