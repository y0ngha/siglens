import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { AUTHORIZATION_HEADER_EXAMPLE } from '../../lib/codeSamples';
import type { DevelopersTranslator } from '../../types';
import { DeveloperSection } from '../layout/DeveloperSection';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
}

/** 인증: Bearer 헤더 예시, 실패·쿠키·폐기 규칙, 그리고 AI 분석이 내 키(BYOK)를 쓴다는 안내 카드. */
export function AuthenticationSection({ t, title }: Props) {
    return (
        <DeveloperSection
            id="authentication"
            title={title}
            sub={t('authentication.sub')}
        >
            <div className="mt-4 max-w-2xl">
                <CodeBlock
                    code={AUTHORIZATION_HEADER_EXAMPLE}
                    language="http"
                    label={t('authentication.headerLabel')}
                />
            </div>
            <ul className="mt-4 flex max-w-2xl list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                <li>{t('authentication.failure')}</li>
                <li>{t('authentication.cookies')}</li>
                <li>{t('authentication.revoke')}</li>
            </ul>
            <div className={cn(SURFACE_CARD, 'mt-6 px-4 py-4 sm:px-5')}>
                <h3 className={HEADING_SUBSECTION}>
                    {t('authentication.byokTitle')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-secondary-300">
                    {t('authentication.byokBody')}
                </p>
            </div>
        </DeveloperSection>
    );
}
