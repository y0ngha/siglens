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
    if (cases.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-secondary-500">
                해당 종목의 케이스가 없습니다.
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
        <div className="page-container flex flex-col gap-2 pb-6">
            {groups.map(group => (
                <div key={group.label}>
                    {/* `2024년 11월` 같은 한글 라벨이라 uppercase는 무효고
                        `tracking-widest`(0.1em)는 한글을 흩뜨린다. 10px도 작아
                        12px로 올린다. */}
                    <div className="pt-3 pb-1 text-xs font-semibold text-secondary-400">
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
