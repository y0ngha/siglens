'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { SURFACE_LIFT_TRANSITION } from '@/shared/lib/cardStyles';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { useSkillDescription } from '@/shared/i18n/skillDescription';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';
import { useIsClamped } from '../../hooks/useIsClamped';
import { SKILL_TYPE_META } from '../../utils/skillTypeMeta';
import { ConfidenceBar } from './ConfidenceBar';

interface SkillCardProps {
    readonly skill: SkillShowcaseItem;
    readonly isExpanded: boolean;
    readonly onToggleExpand: (key: string) => void;
}

/**
 * 스킬 한 장 — 이름·타입 배지·한 줄 요약·신뢰도·가이드 링크.
 *
 * 요약이 2줄을 넘길 때만 펼침 가능(아코디언)해진다. 스킬명은 프롬프트·캐시 지문에
 * 쓰여 바꿀 수 없으므로(토글 키로도 쓰인다) **표시 시점에만** 카탈로그로 옮긴다.
 */
export function SkillCard({
    skill,
    isExpanded,
    onToggleExpand,
}: SkillCardProps) {
    const t = useTranslations('widgets.home');
    const skillLabel = useSkillLabel();
    // 본문은 front-matter `description`(영어 원문)이 아니라 이름으로 찾는 한 줄 요약이다.
    // 카탈로그에 없을 때만 원문으로 떨어진다.
    const skillDescription = useSkillDescription();
    // 클램프 측정은 접힘 상태에서만 유효(펼치면 판정이 뒤집힘) → enabled=!isExpanded.
    const { ref: descRef, isClamped } = useIsClamped(!isExpanded);

    const badge = skill.type != null ? SKILL_TYPE_META[skill.type] : null;
    const canExpand = isClamped || isExpanded;
    const guidePath = guidePathForSkill(skill.name);

    const handleToggle = (): void => {
        onToggleExpand(skill.name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
        // 카드 자체가 포커스됐을 때만 토글한다 — 카드 안 컨트롤의 Enter/Space가
        // 카드 펼침에 가로채이지 않게 하는 가드.
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

    // 카드 껍데기(테두리·호버)와 펼침 영역(`role="button"`)을 나눈다. 가이드 링크를
    // `role="button"` 안에 넣으면 버튼 속 링크가 되어 키보드·스크린리더 활성화가 모호해진다.
    // 링크는 펼침 영역의 **형제**로 둔다.
    return (
        <div
            className={cn(
                SURFACE_CARD,
                SURFACE_LIFT_TRANSITION,
                'duration-200 ease-out motion-reduce:transition-none',
                // 호버 lift는 마우스(hover 지원) 기기 + 펼침 가능 카드에만. 경계선 대신 면이
                // 밝아진다(`surface-raised-hover`는 스스로 `(hover: hover)`에서만 걸린다).
                canExpand &&
                    'surface-raised-hover [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:scale-[1.015]'
            )}
        >
            <div
                {...interactiveProps}
                className={cn(
                    'focus-visible:ring-primary-500 rounded-lg p-4 focus-visible:ring-1 focus-visible:outline-none',
                    canExpand && 'cursor-pointer'
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
                                badge.badgeClassName
                            )}
                        >
                            {t(badge.badgeLabelKey)}
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
                <ConfidenceBar weight={skill.confidenceWeight} />
            </div>
            {guidePath !== null && (
                <div className="px-4 pb-3">
                    <Link
                        href={guidePath}
                        prefetch={false}
                        aria-label={t('SkillsShowcase.guideLinkAria', {
                            name: skillLabel(skill.name),
                        })}
                        className="inline-flex min-h-6 items-center gap-1 rounded text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('SkillsShowcase.guideLink')}
                        <ArrowRightIcon className="size-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}
