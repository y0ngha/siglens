import { LOCALE_HEADER_DOC_NAME } from '@/shared/config/publicApi';
import { cn } from '@/shared/lib/cn';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { LOCALE_HEADER_EXAMPLE } from '../../lib/codeSamples';
import type { DevelopersTranslator } from '../../types';
import { BODY_TEXT } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
}

/** 언어: 번역되는 텍스트의 언어를 고르는 헤더와 그 예시. */
export function LocaleSection({ t, title }: Props) {
    return (
        <DeveloperSection
            id="locale"
            title={title}
            sub={t('localeSection.sub')}
        >
            <p className={cn(BODY_TEXT, 'mt-4')}>
                {t('localeSection.body', { header: LOCALE_HEADER_DOC_NAME })}
            </p>
            <div className="mt-4 max-w-2xl">
                <CodeBlock
                    code={LOCALE_HEADER_EXAMPLE}
                    language="http"
                    label={t('localeSection.exampleLabel')}
                />
            </div>
        </DeveloperSection>
    );
}
