import type { ApiToolReference } from '@/entities/siglens-api-key/model';
import { FRESH_ANALYSIS_DEADLINE_SECONDS } from '@/shared/config/freshAnalysisDeadline';
import { cn } from '@/shared/lib/cn';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { streamingExampleCommand } from '../../lib/codeSamples';
import type { DevelopersTranslator } from '../../types';
import { BODY_TEXT } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
    readonly tools: readonly ApiToolReference[];
}

/**
 * 새 분석 생성과 스트리밍: 200 먼저·공백 keepalive·200 본문의 `error` 규칙과, BYOK 도구가 노출돼 있을 때만 그 도구의
 * curl에 jq 분기를 이은 예시.
 */
export function StreamingSection({ t, title, tools }: Props) {
    const freshTool = tools.find(tool => tool.byok);
    return (
        <DeveloperSection id="streaming" title={title} sub={t('streaming.sub')}>
            <p className={cn(BODY_TEXT, 'mt-4')}>
                {t('streaming.how', {
                    deadline: FRESH_ANALYSIS_DEADLINE_SECONDS,
                })}
            </p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('streaming.parse')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('streaming.disconnect')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('streaming.early')}</p>
            {freshTool ? (
                <div className="mt-4">
                    <CodeBlock
                        code={streamingExampleCommand(freshTool.curl)}
                        language="bash"
                        label={t('streaming.exampleLabel')}
                    />
                </div>
            ) : null}
        </DeveloperSection>
    );
}
