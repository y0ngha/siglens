import type { ApiToolReference } from '@/entities/siglens-api-key/model';
import { cn } from '@/shared/lib/cn';
import { toolAnchor } from '../../lib/toolReference';
import type { DevelopersTranslator } from '../../types';
import { BODY_TEXT, TOC_LINK } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';
import { ToolReference } from '../tools/ToolReference';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
    readonly tools: readonly ApiToolReference[];
}

/** 도구 레퍼런스: 도구 바로가기 칩 줄과, 주어진 순서대로 도구마다 카드 하나. */
export function ToolsSection({ t, title, tools }: Props) {
    return (
        <DeveloperSection id="tools" title={title} sub={t('tools.sub')}>
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('tools.note')}</p>
            <ul
                aria-label={t('tools.indexLabel')}
                className="mt-3 flex flex-wrap gap-x-1"
            >
                {tools.map(tool => (
                    <li key={tool.name}>
                        <a
                            href={`#${toolAnchor(tool.name)}`}
                            className={cn(TOC_LINK, 'font-mono text-[13px]')}
                        >
                            {tool.name}
                        </a>
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex flex-col gap-4">
                {tools.map(tool => (
                    <ToolReference key={tool.name} t={t} tool={tool} />
                ))}
            </div>
        </DeveloperSection>
    );
}
