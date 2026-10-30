'use client';

/**
 * 잠금 업셀 카드의 제목·본문 문구를 고르는 훅.
 */
import { useTranslations } from 'next-intl';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import {
    selectLockedCardBodyKind,
    type LockedCardBodyKind,
} from '../utils/lockedCardCopy';
import { resolveMeterDailySymbols } from '../utils/meterDailySymbols';

interface LockedCardCopy {
    title: string;
    body: string;
}

/**
 * 미터 소진 여부·잠긴 스킬 수에 맞는 업셀 카드 문구를 돌려준다. 판정은
 * `selectLockedCardBodyKind`(순수)가, 번역은 이 훅이 한다.
 */
export function useLockedCardCopy(
    meter: MeterState | null,
    skillCount: number
): LockedCardCopy {
    const t = useTranslations('widgets.analysis');
    const tPanel = useTranslations('widgets.analysis.panel');
    const isMeterExhausted = meter === 'exhausted';
    // `Record`라 종류가 늘면 컴파일러가 잡는다.
    const bodyByKind: Record<LockedCardBodyKind, () => string> = {
        meterExhausted: () =>
            tPanel('meter.exhaustedBody', {
                count: resolveMeterDailySymbols(),
            }),
        skillUpsell: () => tPanel('signupSkillUpsell', { v0: skillCount }),
        default: () => t('AnalysisPanel.f0256c'),
    };
    return {
        title: isMeterExhausted
            ? tPanel('meter.exhaustedTitle')
            : t('AnalysisPanel.120a0a'),
        body: bodyByKind[
            selectLockedCardBodyKind({ isMeterExhausted, skillCount })
        ](),
    };
}
