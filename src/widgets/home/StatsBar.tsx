/**
 * 홈 히어로 아래 분석 통계(지표·패턴·스킬 수) 한 줄.
 */

import { useTranslations } from 'next-intl';

import type { SkillCounts } from '@y0ngha/siglens-core';
import { DotSeparator } from '@/shared/ui/DotSeparator';
import { buildSkillStats } from '@/shared/lib/skillStats';

interface StatsBarProps {
    /** `countSkillFiles()` 결과 — 종목 페이지 진행 문구·가입 업셀과 같은 소스다. */
    counts: SkillCounts;
}

/**
 * 분석 통계 한 줄 — 시맨틱 list로 한 묶음임을 스크린 리더에 알린다("list, 6 items").
 *
 * `list-none`은 Safari/VoiceOver에서 list 의미를 지우므로 `role="list"`를 명시한다.
 * 가운뎃점 구분자(`DotSeparator`)는 장식이라 스스로 `aria-hidden`이며, 항목 수를 흔들지 않도록 별도
 * `<li>`가 아니라 각 통계 항목 **안**(앞쪽)에 둔다.
 */
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
            role="list"
            aria-label={t('StatsBar.deac8e')}
            className="mt-6 flex list-none flex-wrap items-center justify-center gap-x-2 p-0 text-xs text-secondary-400 tabular-nums lg:justify-start"
        >
            {stats.map((stat, i) => (
                <li key={stat.key} className="flex items-center gap-x-2">
                    {i > 0 && <DotSeparator />}
                    {tStats(`count.${stat.key}`, { count: stat.value })}
                </li>
            ))}
        </ul>
    );
}
