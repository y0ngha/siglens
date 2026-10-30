import { useTranslations } from 'next-intl';
import { emptyAttrs } from '../../utils/caseListVisibility';

const EMPTY_CLASS = 'py-10 text-center text-sm text-secondary-500';

/** 데이터셋 자체에 케이스가 없을 때의 안내. */
export function DatasetEmptyMessage() {
    const t = useTranslations('widgets.backtesting');
    return <p className={EMPTY_CLASS}>{t('BacktestCaseList.emptyDataset')}</p>;
}

/**
 * 선택한 종목 탭에 보이는 카드가 하나도 없을 때의 안내. 서버 HTML에서는 숨겨 두고
 * `useCaseListVisibility`가 필터 결과에 따라 드러낸다. 동적으로 나타나므로 `role="status"`로
 * 스크린리더에 알린다(주변에 다른 라이브 리전은 없다).
 */
export function FilteredEmptyMessage() {
    const t = useTranslations('widgets.backtesting');
    return (
        <p hidden role="status" {...emptyAttrs()} className={EMPTY_CLASS}>
            {t('BacktestCaseList.emptyFiltered')}
        </p>
    );
}
