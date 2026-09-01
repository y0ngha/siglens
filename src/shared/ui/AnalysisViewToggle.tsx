'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { AnalysisViewMode } from '@/shared/model/analysisView';

interface AnalysisViewToggleProps {
    mode: AnalysisViewMode;
    onChange: (mode: AnalysisViewMode) => void;
    className?: string;
}

/**
 * **라벨을 `t(value)`로 조회하면 안 된다.** `extract.mjs`의 동적 키 탐지는 "이 파일
 * 안에서 번역자를 **리터럴로** 호출하는 패턴"만 본다 — 변수를 넘기면 그 키가 이
 * 라우트의 클라이언트 페이로드에서 빠지고, 화면에는 `widgets.analysis.viewToggle.plain`
 * 같은 원시 키가 그대로 렌더된다(실증으로 확인했다).
 * `symbolTabsConfig.ts`·`AnalysisPanel.tsx`가 같은 함정을 겪고 남긴 주석과 동일한 이유다.
 */
function useModeOptions(): ReadonlyArray<{
    value: AnalysisViewMode;
    label: string;
}> {
    const t = useTranslations('widgets.analysis.viewToggle');
    return [
        { value: 'plain', label: t('plain') },
        { value: 'raw', label: t('raw') },
    ];
}

/**
 * 쉽게보기 / 원본보기 세그먼트 컨트롤.
 *
 * 탭이 아니라 토글인 이유: 최상위 탭 9개가 이미 URL 라우트라 중첩 탭이 되고,
 * 무엇보다 쉽게/원본은 서로 다른 내용이 아니라 **같은 내용의 다른 표현**이다.
 * 탭 은유는 "다른 것들 사이 이동"이고 토글 은유는 "같은 것의 렌즈 교체"다.
 *
 * `role="radiogroup"`을 쓴다 — 두 값 중 하나를 고르는 단일 선택이고, 스크린 리더가
 * "2개 중 1번째 선택됨"을 읽어 준다. 탭 역할을 쓰면 패널 전환으로 안내되어
 * 실제 동작과 어긋난다.
 */
export function AnalysisViewToggle({
    mode,
    onChange,
    className,
}: AnalysisViewToggleProps) {
    const t = useTranslations('widgets.analysis.viewToggle');
    const options = useModeOptions();

    return (
        <div
            role="radiogroup"
            aria-label={t('label')}
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border border-border-control bg-secondary-900/60 p-1',
                className
            )}
        >
            {options.map(({ value, label }) => {
                const active = mode === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(value)}
                        className={cn(
                            /*
                             * `min-h-11`(44px)은 이 레포의 터치 타겟 표준이다
                             * (`error.tsx`·`not-found.tsx`·`ThemeToggle`의 `h-11`).
                             * 이 컨트롤은 `py-1 text-xs`라 24px였다 — iOS 44pt·
                             * Android 48dp 최소치의 절반이고, 두 버튼이 2px 간격으로
                             * 붙어 있어 오탭이 난다. 글자 크기는 그대로 두고 세로
                             * 여백만 키워 데스크톱 밀도를 유지한다.
                             */
                            'focus-visible:ring-primary-500 inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            active
                                ? 'bg-secondary-700 text-secondary-100'
                                : 'text-secondary-400 hover:text-secondary-200'
                        )}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
