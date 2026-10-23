'use client';

import { useTranslations } from 'next-intl';
import type {
    BenchmarkLabel,
    BenchmarkMarket,
} from '@/entities/benchmark/types';

interface BenchmarkEnumText {
    readonly label: Readonly<Record<BenchmarkLabel, string>>;
    readonly market: Readonly<Record<BenchmarkMarket, string>>;
}

/**
 * 판정·시장 이름. 키를 `t('label.' + x)`로 조립하면 카탈로그 스캐너가 참조를 못 봐 키를
 * 지우므로, 리터럴 키로 맵을 만들어 둔다.
 */
export function useBenchmarkEnumText(): BenchmarkEnumText {
    const t = useTranslations('views.benchmark.explorer');
    return {
        label: {
            correct: t('label.correct'),
            incorrect: t('label.incorrect'),
            not_attempted: t('label.not_attempted'),
            excluded: t('label.excluded'),
            pending: t('label.pending'),
        },
        market: { us: t('market.us'), kr: t('market.kr') },
    };
}
