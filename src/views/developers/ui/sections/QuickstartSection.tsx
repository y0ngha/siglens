import type { ReactNode } from 'react';
import type { ApiToolReference } from '@/entities/siglens-api-key/model';
import {
    API_KEY_ENV_NAME,
    API_KEY_MAX_ACTIVE_PER_USER,
} from '@/shared/config/publicApi';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import {
    ENV_EXPORT_COMMAND,
    meCurlCommand,
    skillInstallCommand,
} from '../../lib/codeSamples';
import { ACCOUNT_PATH, QUICKSTART_TOOL } from '../../lib/developersContent';
import type { DevelopersTranslator } from '../../types';
import { TEXT_LINK } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
    /** 예시 URL의 기준(`https://siglens.io/api/v1`). */
    readonly apiBase: string;
    readonly tools: readonly ApiToolReference[];
}

interface QuickstartStep {
    readonly title: string;
    readonly body: string;
    readonly content: ReactNode;
}

/**
 * 빠른 시작: 키 만들기 → 환경 변수 → 첫 호출 → Skill 설치의 번호 매긴 카드. 첫 호출 예시 도구는 목록 순서가 아니라
 * 이름(`QUICKSTART_TOOL`)으로 고르고, 그 도구가 노출 목록에 없으면 `/me` 예시만 남긴다.
 */
export function QuickstartSection({ t, title, apiBase, tools }: Props) {
    const quickstartTool = tools.find(tool => tool.name === QUICKSTART_TOOL);
    const steps: readonly QuickstartStep[] = [
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
                    code={ENV_EXPORT_COMMAND}
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
                        code={meCurlCommand(apiBase)}
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
                        code={skillInstallCommand(apiBase)}
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

    return (
        <DeveloperSection
            id="quickstart"
            title={title}
            sub={t('quickstart.sub')}
        >
            <ol className="mt-6 flex flex-col gap-4">
                {steps.map(step => (
                    <li
                        key={step.title}
                        className={cn(SURFACE_CARD, 'p-4 sm:p-5')}
                    >
                        <h3 className={HEADING_SUBSECTION}>{step.title}</h3>
                        <p className="mt-1 mb-3 text-sm leading-6 text-secondary-300">
                            {step.body}
                        </p>
                        {step.content}
                    </li>
                ))}
            </ol>
        </DeveloperSection>
    );
}
