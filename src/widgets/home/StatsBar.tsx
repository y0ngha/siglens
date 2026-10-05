import { useTranslations } from 'next-intl';
import { Fragment } from 'react';

import type { SkillCounts } from '@y0ngha/siglens-core';
import { DotSeparator } from '@/shared/ui/DotSeparator';
import { buildSkillStats } from '@/shared/lib/skillStats';

interface StatsBarProps {
    /** `countSkillFiles()` 결과 — 종목 페이지 진행 문구·가입 업셀과 같은 소스다. */
    counts: SkillCounts;
}

// 시맨틱 list 래퍼로 분석 통계 그룹을 한 묶음으로 표현 — 스크린 리더가
// "list, 6 items"로 안내해 단순 텍스트 나열보다 구조 인식이 명확해진다.
// 시각 표현(가운뎃점 구분자, 가로 정렬)은 그대로 유지하기 위해 list-none 적용.
export function StatsBar({ counts }: StatsBarProps) {
    const t = useTranslations('widgets.home');
    // `shared.lib.skillStats.count`는 카운트+라벨이 한 ICU 문자열로 합쳐져
    // 있다(예: `{count}종 보조지표`) — extract.mjs의 동적 키 탐지는 이 파일
    // 안에서 번역자를 직접 호출하는 패턴만 보므로, `stat.key`를 그대로
    // `tStats(...)`에 넣어야 이 네임스페이스가 클라이언트 번들에 실린다.
    const tStats = useTranslations('shared.lib.skillStats');
    const stats = buildSkillStats(counts);

    return (
        <ul
            aria-label={t('StatsBar.deac8e')}
            className="mt-6 flex list-none flex-wrap items-center justify-center gap-x-2 p-0 text-xs text-secondary-400 tabular-nums lg:justify-start"
        >
            {stats.map((stat, i) => (
                <Fragment key={stat.key}>
                    {i > 0 && (
                        // 구분자는 시각 장식 — DotSeparator 내부에서 aria-hidden 처리되어 있어도
                        // 의미 단위가 아니므로 list item 바깥에 둔다.
                        <li aria-hidden="true" className="contents">
                            <DotSeparator />
                        </li>
                    )}
                    <li>
                        {tStats(`count.${stat.key}`, { count: stat.value })}
                    </li>
                </Fragment>
            ))}
        </ul>
    );
}
