import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';
import { cn } from '@/shared/lib/cn';
import type { DevelopersTranslator, InfoRow } from '../../types';
import { BODY_TEXT, NOTE_TEXT } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';
import { InfoTable } from '../layout/InfoTable';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
}

/**
 * 사용 한도: 데이터·AI 두 한도(숫자는 `PUBLIC_API_RATE_LIMITS`에서 ICU 인자로), 초과 시 응답, 한도 응답 헤더 표.
 */
export function RateLimitsSection({ t, title }: Props) {
    const { data, ai } = PUBLIC_API_RATE_LIMITS;
    // 표에 보이는 순서다. 헤더 이름은 번역하지 않는 HTTP 식별자다.
    const headerRows: readonly InfoRow[] = [
        { term: 'X-RateLimit-Limit', body: t('rateLimits.headerLimit') },
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
    return (
        <DeveloperSection
            id="rate-limits"
            title={title}
            sub={t('rateLimits.sub')}
        >
            <p className={cn(BODY_TEXT, 'mt-4')}>
                {t('rateLimits.body', {
                    dataPerMinute: data.perMinute,
                    dataPerDay: data.perDay,
                    aiPerMinute: ai.perMinute,
                    aiPerDay: ai.perDay,
                })}
            </p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('rateLimits.over')}</p>
            <InfoTable
                caption={t('rateLimits.tableCaption')}
                termHeading={t('rateLimits.colHeader')}
                bodyHeading={t('rateLimits.colMeaning')}
                rows={headerRows}
            />
            <p className={cn('mt-3', NOTE_TEXT)}>{t('rateLimits.unmetered')}</p>
        </DeveloperSection>
    );
}
