import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { BacktestCaseCard } from './BacktestCaseCard';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

/**
 * `YYYY-MM`에서 표시용 연·월 조각을 뽑는다. 문장 조립은 번역자를 선언한
 * 컴포넌트가 한다 — 이 헬퍼가 `t('리터럴')`을 부르면 추출기가 파일을
 * 통째로 건너뛴다(§noTranslatorParamCall.test.ts).
 */
function monthParts(dateStr: string): { year: string; month: number } {
    const [year, month] = dateStr.split('-');
    return { year: year ?? '', month: parseInt(month ?? '1', 10) };
}

interface MonthGroup {
    label: string;
    items: BacktestCase[];
}

export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    const t = useTranslations('widgets.backtesting');
    const tMisc = useTranslations('shared.ui.misc');
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
        const { year, month } = monthParts(c.entryDate);
        const label = tMisc('backtestMonth', { v0: year, v1: month });
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
