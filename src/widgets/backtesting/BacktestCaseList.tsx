import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { BacktestCaseCard } from './BacktestCaseCard';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

function getMonthLabel(dateStr: string): string {
    const [year, month] = dateStr.split('-');
    return `${year}년 ${parseInt(month, 10)}월`;
}

interface MonthGroup {
    label: string;
    items: BacktestCase[];
}

export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    const t = useTranslations('widgets.backtesting');
    if (cases.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-secondary-500">
                {t('BacktestCaseList.9018e2')}
            </p>
        );
    }

    // 케이스마다 배열을 복제하지 않고 마지막 그룹에 밀어 넣는다(O(n)).
    const groups: MonthGroup[] = [];
    for (const c of cases) {
        const label = getMonthLabel(c.entryDate);
        const last = groups[groups.length - 1];
        if (!last || last.label !== label) {
            groups.push({ label, items: [c] });
        } else {
            last.items.push(c);
        }
    }

    return (
        <div className="flex flex-col gap-2 px-4 pb-6">
            {groups.map(group => (
                <div key={group.label}>
                    <div className="pt-3 pb-1 text-[10px] tracking-widest text-secondary-600 uppercase">
                        {group.label}
                    </div>
                    <div className="flex flex-col gap-2">
                        {group.items.map(c => (
                            <BacktestCaseCard
                                key={`${c.ticker}-${c.entryDate}`}
                                case_={c}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
