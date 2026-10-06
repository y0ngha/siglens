'use client';

import { useTranslations } from 'next-intl';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { useSkillDescription } from '@/shared/i18n/skillDescription';
import React, { useId, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';
import { TabsPill } from '@/shared/ui/tabs/TabsPill';
import {
    type SkillsActiveTab,
    useSkillsShowcase,
} from './hooks/useSkillsShowcase';
import { useIsClamped } from './hooks/useIsClamped';

const INITIAL_VISIBLE_COUNT = 12;

/**
 * `HIGH_CONFIDENCE_WEIGHT` 로컬 미러 — `@y0ngha/siglens-core`의
 * `domain/indicators/constants.js`에서 동일 상수를 그대로 들고 와도 되지만,
 * 그 모듈은 RSI/MACD/BOLLINGER/STOCHASTIC/KELTNER/ICHIMOKU/SMC/SQUEEZE 등
 * 60+ 개 indicator 상수를 한 파일에 묶어둔 barrel이라 Turbopack tree-shaking이
 * 실패하면서 ~33 KB unused JS가 landing chunk에 끌려와 PSI unused-javascript
 * audit이 0.5점, lcp-discovery에 영향. 단일 0.8 상수를 인라인해 의존성 절단.
 *
 * 추적 이슈: #468 — siglens-core가 indicator constants barrel을 관심사별 파일로
 * 분리하면 본 미러를 제거하고 직접 import로 복귀. 그때까지는 siglens-core의
 * `HIGH_CONFIDENCE_WEIGHT`와 함께 일관되게 갱신할 것 (현재 양쪽 모두 0.8).
 */
const HIGH_CONFIDENCE_WEIGHT = 0.8;
// 등급 경계는 @y0ngha/siglens-core의 confidence helper와 동일 값(0.5/0.8).
// SkillsShowcase는 client component이고 lcp-discovery 의존성 절단을 위해 인라인 유지.
// 제거 조건: core가 client entrypoint(index.client)에 confidence 경계/helper를
// 노출하면 이 미러를 삭제하고 import로 통합한다. `HIGH_CONFIDENCE_WEIGHT`와 함께 갱신.
const MEDIUM_CONFIDENCE_WEIGHT = 0.5;

interface TabConfig {
    value: SkillsActiveTab;
    /** 메시지 키 — `TabsPill`에는 번역된 `label`로 바꿔서 넘긴다. */
    labelKey: string;
}

const TABS: readonly TabConfig[] = [
    { value: 'all', labelKey: 'skillFilter.all' },
    { value: 'indicator_guide', labelKey: 'skillFilter.indicator_guide' },
    { value: 'pattern', labelKey: 'skillFilter.pattern' },
    { value: 'strategy', labelKey: 'skillFilter.strategy' },
    { value: 'candlestick', labelKey: 'skillFilter.candlestick' },
    { value: 'support_resistance', labelKey: 'skillFilter.support_resistance' },
];

interface TypeBadgeConfig {
    labelKey: string;
    className: string;
}

const TYPE_BADGE: Record<SkillType, TypeBadgeConfig> = {
    indicator_guide: {
        labelKey: 'skillBadge.indicator_guide',
        className:
            'bg-primary-600/15 text-primary-400 border border-primary-600/30',
    },
    pattern: {
        labelKey: 'skillBadge.pattern',
        className:
            'bg-ui-danger/10 text-ui-danger-text border border-ui-danger/30',
    },
    strategy: {
        labelKey: 'skillBadge.strategy',
        className:
            'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    },
    candlestick: {
        labelKey: 'skillBadge.candlestick',
        className:
            'bg-ui-success/10 text-ui-success-text border border-ui-success/30',
    },
    support_resistance: {
        labelKey: 'skillBadge.support_resistance',
        className:
            'bg-secondary-700/30 text-secondary-300 border border-secondary-600/50',
    },
};

// 툴팁 카피용 경계 퍼센트 — 모듈 레벨에서 1회 계산(컴포넌트 내 매 렌더 재생성 방지).
// Math.round로 0.8 * 100 = 80.00000000000001 같은 부동소수점 잔차를 흡수.
const MEDIUM_PCT = Math.round(MEDIUM_CONFIDENCE_WEIGHT * 100);
const HIGH_PCT = Math.round(HIGH_CONFIDENCE_WEIGHT * 100);

function barColorClass(weight: number): string {
    if (weight >= HIGH_CONFIDENCE_WEIGHT) return 'bg-chart-bullish';
    if (weight >= MEDIUM_CONFIDENCE_WEIGHT) return 'bg-ui-warning';
    return 'bg-secondary-500';
}

/**
 * 신뢰도 점수 설명 ⓘ — 섹션 제목 옆에 **한 번만** 렌더한다.
 *
 * 예전엔 카드마다 달았는데, 툴팁 본문이 hover용으로 항상 DOM에 있어서 숨은 탭
 * 패널까지 합쳐 홈 HTML에 같은 3문장이 56번 찍혔다(2026-09 실측). 그 결과 홈에서
 * 가장 자주 나오는 문구가 핵심 키워드가 아니라 이 안내문이 됐다. 설명은 모든 카드에
 * 공통이라 한 곳이면 충분하다 — 카드 안으로 되돌리지 말 것.
 *
 * 앵커는 ⓘ 버튼이 아니라 헤더 행(`SkillsShowcase`의 `mb-6 flex items-center
 * gap-1` div)이다 — ⓘ가 제목 텍스트 뒤(모바일 기준 뷰포트 좌측에서 ~130px)에
 * 오는데 툴팁 박스가 224px(`w-56`)라, 버튼에 `relative`를 주고 `left-0`을
 * 쓰면 320px 뷰포트 오른쪽으로 넘친다. 헤더 행에 `relative`를 주면 `left-0`이
 * 섹션 좌측 여백(page-container 패딩)에서 시작해 16px + 224px가 320px 안에 들어온다.
 */
function ConfidenceInfoTooltip() {
    const t = useTranslations('widgets.home');
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipId = useId();
    const { isOpen, toggle } = usePopoverToggle(containerRef);

    return (
        <div ref={containerRef} className="group">
            <button
                type="button"
                aria-label={t('SkillsShowcase.7e6540')}
                aria-describedby={tooltipId}
                onClick={toggle}
                // 글리프만 두면 모바일에서 10.4×12로 잡힌다(실측) — WCAG 2.2
                // SC 2.5.8의 24×24 최소치 미달이고, 같은 ⓘ가 옵션 페이지에서는
                // `InfoTooltip`을 통해 24×24다. 같은 기호가 화면마다 다른 크기인
                // 것이 문제이므로 그쪽과 같은 최소 크기를 준다.
                className="inline-flex min-h-6 min-w-6 cursor-help items-center justify-center rounded text-xs leading-none text-secondary-500 transition-colors hover:text-secondary-400 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                ⓘ
            </button>
            <div
                id={tooltipId}
                role="tooltip"
                className={cn(
                    'bg-secondary-800 border-secondary-600 absolute left-0 bottom-full z-10 mb-1.5 w-56 rounded border p-2 text-xs shadow-lg transition-opacity',
                    'group-hover:opacity-100',
                    isOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0 sm:pointer-events-none sm:opacity-0'
                )}
            >
                <div className="leading-relaxed text-secondary-300">
                    <p>{t('SkillsShowcase.ebff92')}</p>
                    <p>
                        {t('SkillsShowcase.e20b1b', {
                            v0: MEDIUM_PCT,
                            v1: MEDIUM_PCT,
                        })}
                        ~
                        {t('SkillsShowcase.c266ba', {
                            v0: HIGH_PCT,
                            v1: HIGH_PCT,
                        })}
                    </p>
                    <p>{t('SkillsShowcase.e0f5c5')}</p>
                </div>
            </div>
        </div>
    );
}

interface SkillCardProps {
    skill: SkillShowcaseItem;
    isExpanded: boolean;
    onToggleExpand: (key: string) => void;
}

export function SkillCard({
    skill,
    isExpanded,
    onToggleExpand,
}: SkillCardProps) {
    const t = useTranslations('widgets.home');
    // 스킬명은 `skills/**.md` front-matter `name`이고 프롬프트·캐시 지문에 들어가므로
    // 바꿀 수 없다(dedupe·토글 키로도 쓰인다). **표시 시점**에만 카탈로그로 옮긴다
    // (`AnalysisPanel`과 같은 훅) — 영문 이름 54종도 한국어 표시명을 갖는다.
    // 홈은 이 표시명의 최대 노출 지점이다.
    const skillLabel = useSkillLabel();
    // 카드 본문은 front-matter `description`(영어 원문·내부 용어 섞임)이 아니라 **이름으로
    // 찾는 한 줄 요약**이다. 카탈로그에 없으면 그때만 원문으로 떨어진다.
    const skillDescription = useSkillDescription();
    // 클램프 측정은 접힘 상태에서만 유효(펼치면 판정이 뒤집힘) → enabled=!isExpanded.
    const { ref: descRef, isClamped } = useIsClamped(!isExpanded);

    const badge = skill.type != null ? TYPE_BADGE[skill.type] : null;
    const barColor = barColorClass(skill.confidenceWeight);
    const canExpand = isClamped || isExpanded;

    const handleToggle = (): void => {
        onToggleExpand(skill.name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
        // 카드 자체가 포커스됐을 때만 토글한다 — 나중에 카드 안에 컨트롤이 다시
        // 생기면 그 Enter/Space가 카드 펼침에 가로채이지 않게 하는 가드.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Space의 페이지 스크롤 방지
            onToggleExpand(skill.name);
        }
    };

    // 카드 내부가 <div>/<p> 블록 구조라 루트를 진짜 <button>(phrasing content만
    // 허용)으로 만들 수 없으므로 role="button"+tabIndex로 처리한다.
    const interactiveProps = canExpand
        ? {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': isExpanded,
              onClick: handleToggle,
              onKeyDown: handleKeyDown,
          }
        : {};

    return (
        <div
            {...interactiveProps}
            className={cn(
                'bg-secondary-800/50 border-secondary-700 rounded-lg border p-4',
                'transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out motion-reduce:transition-none',
                'focus-visible:ring-primary-500 focus-visible:ring-1 focus-visible:outline-none',
                // 호버 lift는 마우스(hover 지원) 기기 + 펼침 가능 카드에만.
                canExpand &&
                    '[@media(hover:hover)]:hover:border-secondary-600 [@media(hover:hover)]:hover:bg-secondary-800/70 cursor-pointer [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:shadow-lg'
            )}
        >
            <div className="mb-2 flex items-start gap-2">
                <span className="min-w-0 text-sm font-medium text-secondary-200">
                    {skillLabel(skill.name)}
                </span>
                {badge != null && (
                    <span
                        className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
                            badge.className
                        )}
                    >
                        {t(badge.labelKey)}
                    </span>
                )}
            </div>
            {/* max-h는 펼침 트랜지션 상한일 뿐 — 시각적 클램프는 내부 <p>의 line-clamp-2가 담당.
                접힘값 3rem은 2줄 높이(text-sm × leading-relaxed ≈ 2.85rem)에 서브픽셀 여유를
                둬 글자/말줄임 잘림을 막는다. line-clamp 줄 수를 바꾸면 이 값도 함께 조정. */}
            <div
                className={cn(
                    'mb-3 overflow-hidden transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
                    isExpanded ? 'max-h-[40rem]' : 'max-h-[3rem]'
                )}
            >
                <p
                    ref={descRef}
                    className={cn(
                        'text-secondary-400 text-sm leading-relaxed',
                        !isExpanded && 'line-clamp-2'
                    )}
                >
                    {skillDescription(skill.name, skill.description)}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary-700">
                    <div
                        data-testid="confidence-bar"
                        className={cn(
                            'h-full w-(--confidence-w) rounded-full',
                            barColor
                        )}
                        style={
                            {
                                '--confidence-w': `${skill.confidenceWeight * 100}%`,
                            } as React.CSSProperties
                        }
                        aria-hidden="true"
                    />
                </div>
                <span className="font-mono text-xs text-secondary-400">
                    {Math.round(skill.confidenceWeight * 100)}%
                </span>
            </div>
        </div>
    );
}

interface SkillsShowcaseProps {
    skills: SkillShowcaseItem[];
}

export function SkillsShowcase({ skills }: SkillsShowcaseProps) {
    const t = useTranslations('widgets.home');
    const tMisc = useTranslations('shared.ui.misc');
    const {
        activeTab,
        showAll,
        expandedKey,
        baseId,
        handleTabSelect,
        toggleShowAll,
        toggleExpanded,
    } = useSkillsShowcase();

    return (
        <section className="page-container py-10">
            {/* 같은 위계의 h2는 `HEADING_SECTION` 한 곳에서만 정의한다 —
                여기와 `CategoryCardGrid`가 각자 리터럴을 복제하고 있었고, 그
                복제본이 토큰(18px)과 어긋난 16px로 굳어 있었다. */}
            <div className="relative mb-6 flex items-center gap-1">
                <h2 className={HEADING_SECTION}>
                    {t('SkillsShowcase.158954')}
                </h2>
                <ConfidenceInfoTooltip />
            </div>
            <TabsPill
                tabs={TABS.map(tab => ({
                    value: tab.value,
                    label: t(tab.labelKey),
                }))}
                activeTab={activeTab}
                onChange={handleTabSelect}
                ariaLabel={t('SkillsShowcase.c78b79')}
                idPrefix={baseId}
                className="mb-6"
            />
            {TABS.map(tab => {
                const isActive = activeTab === tab.value;
                const panelSkills =
                    tab.value === 'all'
                        ? skills
                        : skills.filter(s => s.type === tab.value);
                const visibleSkills = showAll
                    ? panelSkills
                    : panelSkills.slice(0, INITIAL_VISIBLE_COUNT);
                const hasMore = panelSkills.length > INITIAL_VISIBLE_COUNT;

                return (
                    <div
                        key={tab.value}
                        id={buildPanelId(baseId, tab.value)}
                        role="tabpanel"
                        aria-labelledby={buildTabId(baseId, tab.value)}
                        hidden={!isActive}
                    >
                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleSkills.map(skill => (
                                <SkillCard
                                    key={skill.name}
                                    skill={skill}
                                    isExpanded={expandedKey === skill.name}
                                    onToggleExpand={toggleExpanded}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    type="button"
                                    onClick={toggleShowAll}
                                    className="rounded-full border border-border-control px-6 py-2 text-xs font-medium text-secondary-400 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {showAll
                                        ? t('SkillsShowcase.0d2c24')
                                        : tMisc('showMore', {
                                              v0:
                                                  panelSkills.length -
                                                  INITIAL_VISIBLE_COUNT,
                                          })}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
