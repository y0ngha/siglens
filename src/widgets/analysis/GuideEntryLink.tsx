import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';

/**
 * 분석 패널 하단의 차트 가이드 진입 링크 — 패널에 한 줄만 둔다. 항목별 "뜻 보기"가 없는
 * 캔들 패턴(차트 캔버스 마커)이나 용어 전반을 찾아보려는 사람을 가이드 허브로 보낸다.
 */
export function GuideEntryLink() {
    const t = useTranslations('widgets.analysis');
    return (
        <Link
            href={GUIDE_PATH}
            prefetch={false}
            className="inline-flex min-h-6 w-fit items-center gap-1 rounded text-xs text-secondary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {t('GuideHintLink.entry')}
            <ArrowRightIcon className="size-3" />
        </Link>
    );
}
