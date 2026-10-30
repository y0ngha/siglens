import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import {
    ERROR_RESPONSE_EXAMPLE,
    SUCCESS_RESPONSE_EXAMPLE,
} from '../../lib/developersContent';
import { buildErrorRows } from '../../lib/errorRows';
import type { DevelopersTranslator } from '../../types';
import { BODY_TEXT, NOTE_TEXT } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';
import { InfoTable } from '../layout/InfoTable';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
}

/**
 * 응답과 오류: 성공·실패 본문 예시 한 쌍, 잘림·분기 안내, 오류 코드 표(카탈로그 영어 원문 그대로 `lang="en"`).
 */
export function ResponsesSection({ t, title }: Props) {
    const examples = [
        {
            heading: t('responses.successTitle'),
            code: SUCCESS_RESPONSE_EXAMPLE,
            label: t('responses.successLabel'),
        },
        {
            heading: t('responses.errorTitle'),
            code: ERROR_RESPONSE_EXAMPLE,
            label: t('responses.errorLabel'),
        },
    ] as const;
    return (
        <DeveloperSection id="responses" title={title} sub={t('responses.sub')}>
            {/* 좁은 화면의 한 열도 `grid-cols-1`(minmax(0, 1fr))로 명시한다 — 암묵 `auto` 열은 JSON 예시의 가장 긴 줄만큼
                넓어져, 320·390px 폭에서 복사 버튼이 화면 밖으로 밀려났다. */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {examples.map(example => (
                    <div key={example.label}>
                        <p className="mb-2 text-sm font-semibold text-secondary-100">
                            {example.heading}
                        </p>
                        <CodeBlock
                            code={example.code}
                            language="json"
                            label={example.label}
                        />
                    </div>
                ))}
            </div>
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('responses.truncated')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>
                {t('responses.errorAdvice')}
            </p>
            <h3 className={cn(HEADING_SUBSECTION, 'mt-8')}>
                {t('responses.codesTitle')}
            </h3>
            <p className={cn('mt-1', NOTE_TEXT)}>{t('responses.codesNote')}</p>
            <InfoTable
                caption={t('responses.tableCaption')}
                termHeading={t('responses.colCode')}
                bodyHeading={t('responses.colMeaning')}
                rows={buildErrorRows(t('responses.streamedNote'))}
                bodyLang="en"
            />
        </DeveloperSection>
    );
}
