/**
 * `/methodology` "AI가 하는 일과 하지 않는 일" — AI의 역할, 쉽게 보기 검사, 가격대, 벤치마크.
 */
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { BENCHMARK_PATH, BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BODY_TEXT, BULLET_LIST, TEXT_LINK } from '../methodologyStyles';

interface Props extends MethodologySectionProps {
    /** 벤치마크 링크(ai 호스트)의 로케일 경로. */
    readonly locale: Locale;
}

interface RoleListProps {
    readonly title: string;
    readonly items: readonly string[];
}

/** "하는 일"·"하지 않는 일" 목록 한 열. */
function RoleList({ title, items }: RoleListProps) {
    return (
        <div>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <ul className={cn(BULLET_LIST, 'mt-2')}>
                {items.map(item => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

/**
 * 하는 일·하지 않는 일 두 열, 쉽게 보기 검사, 가격대 안내, 벤치마크.
 *
 * 벤치마크의 정본은 ai 호스트에 있어 절대 URL의 일반 앵커다. 공개 전에는 그 주소가
 * 404라 블록 전체를 내지 않는다.
 */
export function AiSection({ t, title, locale }: Props) {
    const does = [t('ai.do1'), t('ai.do2'), t('ai.do3'), t('ai.do4')];
    const doesNot = [
        t('ai.dont1'),
        t('ai.dont2'),
        t('ai.dont3'),
        t('ai.dont4'),
    ];
    return (
        <MethodologySection id="ai" title={title} sub={t('ai.sub')}>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <RoleList title={t('ai.doTitle')} items={does} />
                <RoleList title={t('ai.dontTitle')} items={doesNot} />
            </div>
            <h3 className={cn(HEADING_SUBSECTION, 'mt-8')}>
                {t('ai.checkTitle')}
            </h3>
            <p className={cn(BODY_TEXT, 'mt-2')}>{t('ai.check')}</p>
            <h3 className={cn(HEADING_SUBSECTION, 'mt-6')}>
                {t('ai.levelsTitle')}
            </h3>
            <p className={cn(BODY_TEXT, 'mt-2')}>{t('ai.levels')}</p>
            {BENCHMARK_PUBLISHED ? (
                <>
                    <h3 className={cn(HEADING_SUBSECTION, 'mt-6')}>
                        {t('ai.benchmarkTitle')}
                    </h3>
                    <p className={cn(BODY_TEXT, 'mt-2')}>{t('ai.benchmark')}</p>
                    <a
                        href={`${AI_SITE_URL}${localePath(locale, BENCHMARK_PATH)}`}
                        className={cn(TEXT_LINK, 'mt-2 text-sm')}
                    >
                        {t('ai.benchmarkLink')}
                    </a>
                </>
            ) : null}
        </MethodologySection>
    );
}
