import { useTranslations } from 'next-intl';
import { BACKTEST_RECORD_PATH } from '@/shared/lib/backtestRecordPath';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';

/**
 * 분석 패널 하단의 "분석 기록과 측정 방법" 링크 — 패턴·캔들·가격대 문구의 숫자가 어디서
 * 나왔는지 `/backtesting#record`에서 볼 수 있다. 툴팁 안이 아니라 패널 본문에 둔 링크라
 * 키보드와 스크린 리더가 바로 닿는다.
 */
export function RecordEntryLink() {
    const t = useTranslations('widgets.analysis');
    return (
        <Link
            href={BACKTEST_RECORD_PATH}
            prefetch={false}
            className="inline-flex min-h-6 w-fit items-center gap-1 rounded text-xs text-secondary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {t('RecordEntryLink.entry')}
            <ArrowRightIcon className="size-3" />
        </Link>
    );
}
