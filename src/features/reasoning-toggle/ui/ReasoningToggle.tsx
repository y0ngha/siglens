'use client';

/**
 * 상세 분석(reasoning) 스위치. 라벨·설명 툴팁·스위치를 한 줄로 그린다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { REASONING_FEATURE_LABEL_KEY } from '../model/reasoningFeature';
import {
    getReasoningSwitchMode,
    type ReasoningSwitchMode,
} from '../lib/reasoningSwitchMode';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

/**
 * 트랙 공통 클래스.
 *
 * 버튼 자체는 h-5 w-9 알약 그대로 두고, 터치 영역은 흐름 밖에 놓인 `before:`
 * 가상 요소로 넓힌다 — 버튼 크기를 키우면 종목 헤더의 줄바꿈된 컨트롤 행이 높아진다.
 * 헤더 행 간격이 `gap-y-2`(8px)라 위아래로 4px(`-inset-y-1`)까지만 넓힐 수 있다.
 * 그 이상이면 인접 행을 덮어 오탭이 난다. 그래도 ~28px로 WCAG 2.5.8(AA) 24px을 넘는다.
 *
 * 트랙·썸에 `border-control`을 두르는 이유: 라이트 테마에서 트랙(off `secondary-700`,
 * locked `secondary-800`)과 흰 썸이 페이지 배경에 사실상 묻힌다. WCAG 1.4.11은 상태를
 * 알리는 조작 요소에 3:1을 요구하고, 이 스위치는 locked일 때도 클릭 가능한 조작 요소다.
 */
const TRACK_BASE_CLASS =
    "focus-visible:ring-primary-500 relative inline-flex h-5 w-9 shrink-0 touch-manipulation items-center rounded-full border border-border-control transition-colors before:absolute before:-inset-x-1 before:-inset-y-1 before:content-[''] focus-visible:ring-1 focus-visible:outline-none";

/**
 * 모드별 트랙 클래스.
 *
 * `locked`에는 `opacity-*`를 넣지 않는다. opacity는 보더까지 흐리게 해, 라이트
 * 테마에서 흰 트랙 위 흰 썸을 식별하게 해 주는 유일한 단서(보더)가 3:1 아래로
 * 떨어진다. 그래서 흐림 대신 트랙·썸 색을 낮춰 "잠김"을 전한다. 클릭하면 가입
 * 넛지가 열리므로 커서는 `pointer`다.
 */
const TRACK_MODE_CLASS: Record<ReasoningSwitchMode, string> = {
    disabled: 'cursor-not-allowed opacity-60',
    locked: 'bg-secondary-800 cursor-pointer',
    interactive: '',
};

/** 모드별 썸 색. locked만 썸 색을 낮춰 잠김을 표시한다. */
const THUMB_MODE_CLASS: Record<ReasoningSwitchMode, string> = {
    disabled: 'bg-white',
    locked: 'bg-secondary-400',
    interactive: 'bg-white',
};

/**
 * 썸 공통 클래스. 썸도 트랙과 같은 보더를 둘러 흰 트랙 위에서 보이게 한다.
 * 켜짐 이동량이 16px인 이유: `border-box`라 좌우 보더 1px씩이 안쪽 폭을 34px로
 * 줄여, 좌측 여백 4px과 대칭이 되는 값이 16px이다.
 */
const THUMB_BASE_CLASS =
    'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full border border-border-control transition-transform';

interface ReasoningToggleProps {
    /** 회원이 저장해 둔 토글 값. */
    checked: boolean;
    /** 회원이 스위치를 뒤집을 때 새 값으로 부른다. */
    onChange: (value: boolean) => void;
    /**
     * 회원이라 기능을 쓸 수 있는지. `false`여도 스위치를 숨기지 않고 잠긴 모양으로
     * 그린다 — 툴팁과 가입 넛지로 기능을 알게 하려는 것이다.
     */
    canUse: boolean;
    /** 잠긴 스위치(`canUse=false`)를 누르면 `onChange` 대신 부른다. 호출자가 가입 넛지를 연다. */
    onLockedClick?: () => void;
    /** 조작이 무의미할 때(추론 미지원 모델). `canUse`보다 우선하며 클릭이 아무 일도 하지 않는다. */
    disabled?: boolean;
    /** 바깥 래퍼에 덧붙일 클래스. */
    className?: string;
}

/**
 * 상세 분석(reasoning) 토글. 종목 분석 요청마다 `reasoning` 값을 싣는다.
 * 등급과 무관하게 항상 그린다 — 회원은 자유롭게 켜고 끄고, 비회원은 잠긴 스위치를
 * 누르면 토글 대신 가입 넛지가 열린다.
 */
export function ReasoningToggle({
    checked,
    onChange,
    canUse,
    onLockedClick,
    disabled = false,
    className,
}: ReasoningToggleProps) {
    const t = useTranslations('features.reasoning-toggle');
    const tA11y = useTranslations('features.reasoning-toggle.a11y');
    const mode = getReasoningSwitchMode({ canUse, disabled });
    // 비회원은 서버에서도 추론이 꺼진다 — 회원 시절 저장값(`checked`)이 남아 있어도 OFF로 보인다.
    const effectiveChecked = canUse && checked;
    const featureLabel = tA11y(REASONING_FEATURE_LABEL_KEY);
    // locked는 눌러도 뒤집히지 않으므로 접근성 이름이 그 이유("가입하면 사용")를 말해야 한다.
    // disabled는 가입해도 열리지 않으므로 그 약속을 하지 않고 일반 이름을 쓴다.
    const ariaLabel =
        mode === 'locked'
            ? tA11y('signupPrompt', { v0: featureLabel })
            : tA11y('toggleAria', { v0: featureLabel });

    const clickByMode: Record<ReasoningSwitchMode, () => void> = {
        // `aria-disabled`를 알리는 상태라 가입 넛지조차 띄우지 않는다.
        disabled: () => {},
        locked: () => onLockedClick?.(),
        interactive: () => onChange(!checked),
    };

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <span className="text-xs whitespace-nowrap text-secondary-400">
                {featureLabel}
            </span>
            <InfoTooltip>
                <p className="mb-1">{t('ReasoningToggle.3592be')}</p>
                <p className="mb-1">{t('ReasoningToggle.ddf353')}</p>
                <p>{t('ReasoningToggle.c48ae3')}</p>
            </InfoTooltip>
            <button
                type="button"
                role="switch"
                aria-checked={effectiveChecked}
                aria-label={ariaLabel}
                // locked는 클릭하면 넛지가 열리는 조작 가능한 상태라 aria-disabled·native
                // disabled를 달지 않는다. native disabled는 탭 순서에서도 빠진다.
                aria-disabled={disabled || undefined}
                disabled={disabled}
                onClick={clickByMode[mode]}
                className={cn(
                    TRACK_BASE_CLASS,
                    effectiveChecked ? 'bg-primary-600' : 'bg-secondary-700',
                    TRACK_MODE_CLASS[mode]
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        THUMB_BASE_CLASS,
                        THUMB_MODE_CLASS[mode],
                        effectiveChecked
                            ? 'translate-x-[16px]'
                            : 'translate-x-1'
                    )}
                />
            </button>
        </div>
    );
}
