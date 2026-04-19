import type { BacktestCase } from '@/domain/types';
import { BacktestCaseCard } from './BacktestCaseCard';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

function getMonthLabel(dateStr: string): string {
    const [year, month] = dateStr.split('-');
    return `${year}년 ${parseInt(month, 10)}월`;
}

export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    if (cases.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-secondary-500">
                해당 종목의 케이스가 없습니다.
            </p>
        );
    }

    const groups: Array<{ label: string; items: BacktestCase[] }> = [];
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
                    <div className="pb-1 pt-3 text-[10px] uppercase tracking-widest text-secondary-600">
                        {group.label}
                    </div>
                    <div className="flex flex-col gap-2">
                        {group.items.map((c, i) => (
                            <BacktestCaseCard key={`${c.ticker}-${c.entryDate}-${i}`} case_={c} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
