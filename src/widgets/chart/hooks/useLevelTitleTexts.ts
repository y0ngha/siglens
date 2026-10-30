'use client';

/**
 * 작도 레벨선 제목의 화면 문구 묶음 — core가 언어 중립 키로 내보내는 레벨 라벨(돌파·피보나치·
 * 무효화·목표·엘리어트 구조)을 로케일 문구로 바꾸는 번역 함수들을 만든다.
 */
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { LevelTitleContext } from '../utils/levelTitle';

/** 패턴명(`cardName`)을 뺀 레벨 제목 문맥 — 패턴명은 오버레이마다 다르다. */
export type LevelTitleTexts = Omit<LevelTitleContext, 'cardName'>;

// A-B-C 표기는 언어 중립이라 번역하지 않는다.
const ABC_STRUCTURE_NAME = 'A-B-C';

/** 레벨 제목 번역 함수 묶음 — 번역자가 바뀔 때만 다시 만든다. */
export function useLevelTitleTexts(): LevelTitleTexts {
    const t = useTranslations('widgets.chart');
    return useMemo(
        () => ({
            // 어느 패턴의 선인지 붙인다("원형 바닥 돌파") — 패턴명을 모르면 "돌파 기준".
            breakoutTitle: patternName =>
                patternName === undefined
                    ? t('StockChart.57fdbb')
                    : t('StockChart.6c577b', { v0: patternName }),
            // 피보나치 레벨(`61.8%`, `ext 127.2%`, `ABC 127.2%`)은 다리 방향에 따라
            // 역할(반등·눌림·목표)로 읽히게 한다.
            fibTexts: {
                retracement: {
                    down: percent => t('StockChart.87cc60', { v0: percent }),
                    up: percent => t('StockChart.545536', { v0: percent }),
                },
                extension: {
                    down: percent => t('StockChart.3784c9', { v0: percent }),
                    up: percent => t('StockChart.693f7c', { v0: percent }),
                },
                abcExtension: {
                    down: percent => t('StockChart.fd8510', { v0: percent }),
                    up: percent => t('StockChart.37cc7e', { v0: percent }),
                },
            },
            // 무효화·목표·5파 상한 선은 어느 패턴·엘리어트 구조의 선인지 붙인다
            // ("이중천장 무효화", "삼각형 목표"). 주인을 모르면 종류만.
            outcomeTexts: {
                invalidation: owner =>
                    owner === undefined
                        ? t('StockChart.b7de20')
                        : t('StockChart.c70cbe', { v0: owner }),
                target: owner =>
                    owner === undefined
                        ? t('StockChart.2fbea4')
                        : t('StockChart.3322f9', { v0: owner }),
                wave5Cap: owner =>
                    owner === undefined
                        ? t('StockChart.b3fa71')
                        : t('StockChart.6c1313', { v0: owner }),
                elliottStructure: {
                    impulse: t('StockChart.216f1f'),
                    triangle: t('StockChart.6e96f3'),
                    diagonal: t('StockChart.2751c7'),
                    abc: ABC_STRUCTURE_NAME,
                    combination: t('StockChart.a8aa4c'),
                },
            },
            reachedTitle: title => t('StockChart.reachedLevel', { v0: title }),
        }),
        [t]
    );
}
