'use client';

import { useTranslations } from 'next-intl';
import type { TabKey } from '@/shared/config/marketProfile/types';

/**
 * 탭 키 → 현재 로케일의 탭 라벨.
 *
 * 키를 배열에서 꺼내 `t(tab.key)`로 부르면 추출기에는 동적 조회라 어떤 키가 쓰이는지
 * 보이지 않는다. 여기서 키마다 리터럴로 불러 `Record<TabKey, …>`로 묶으면 추출기가 키를
 * 그대로 읽고, 탭이 늘면 `TabKey` 유니온이 이 레코드의 누락을 컴파일 오류로 잡는다.
 */
export function useSymbolTabLabels(): Readonly<Record<TabKey, string>> {
    const t = useTranslations('shared.symbolTab');
    return {
        chart: t('chart'),
        news: t('news'),
        fundamental: t('fundamental'),
        financials: t('financials'),
        congress: t('congress'),
        flows: t('flows'),
        options: t('options'),
        'fear-greed': t('fear-greed'),
        overall: t('overall'),
        position: t('position'),
    };
}
