import type { BacktestCase } from '@/domain/types';
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
    if (cases.length === 0) {
        return (
            <p className="text-secondary-500 py-10 text-center text-sm">
                해당 종목의 케이스가 없습니다.
            </p>
        );
    }

    const groups = cases.reduce<MonthGroup[]>((acc, c) => {
        const label = getMonthLabel(c.entryDate);
        const last = acc[acc.length - 1];
        if (!last || last.label !== label) {
            return [...acc, { label, items: [c] }];
        }
        return [...acc.slice(0, -1), { label, items: [...last.items, c] }];
    }, []);

    return (
        <div className="flex flex-col gap-2 px-4 pb-6">
            {groups.map(group => (
                <div key={group.label}>
                    <div className="text-secondary-600 pt-3 pb-1 text-[10px] tracking-widest uppercase">
                        {group.label}
                    </div>
                    <div className="flex flex-col gap-2">
                        {group.items.map((c, i) => (
                            <BacktestCaseCard
                                key={`${c.ticker}-${c.entryDate}-${i}`}
                                case_={c}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
