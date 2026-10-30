'use client';

/**
 * '원본' 카드의 차트 작도 켜기/끄기 스위치 — 차트 헤더 "차트 작도" 메뉴와 같은 상태다
 * (설계 2026-09-29). 카드 전체를 클릭 영역으로 만들면 텍스트 선택·아코디언 토글과
 * 인터랙션이 겹치므로 별도 버튼으로 둔다.
 *
 * 강조(굵게·나머지 흐리게)는 카드 hover와 이 버튼의 focus 동안만 건다 — 키보드
 * 사용자도 같은 미리보기를 받는다. 꺼진 작도는 강조해도 그려지지 않는다.
 */
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import type { OverlayCardControls } from '../model/types';

interface OverlayToggleButtonProps {
    /** 카드 제목(스킬명) — aria-label에 실어 어느 카드의 버튼인지 스크린리더에 알린다. */
    cardTitle: string;
    /** 이 카드의 작도 key(`overlayItemKey` — 패턴·전략은 결과 id). */
    overlayKey: string;
    overlay: OverlayCardControls;
}

export function OverlayToggleButton({
    cardTitle,
    overlayKey,
    overlay,
}: OverlayToggleButtonProps) {
    const t = useTranslations('widgets.analysis');
    const isOn = !overlay.hiddenKeys.has(overlayKey);

    /**
     * 언마운트 시 이 카드의 강조를 해제한다.
     *
     * `PlainAnalysisSwitch`는 쉽게보기로 전환되면 원본 트리(이 버튼을 포함한 카드
     * 전체)를 **마운트 해제**한다(조건부 렌더 — display:none이 아니다). hover·focus
     * 중에 카드가 사라지면 `mouseleave`/`blur`가 오지 않아 강조가 죽은 카드를 가리킨
     * 채 남는다. cleanup에서 최신 `onClearHighlight`를 ref로 읽어(deps에 넣으면 매
     * 렌더 재실행돼 진짜 unmount가 아닌 데도 발동한다) 마운트 해제 시점에만 한 번
     * 부른다. 멱등 해제라 다른 카드가 강조 중이면 건드리지 않는다.
     */
    const latestRef = useRef({ overlayKey, clear: overlay.onClearHighlight });
    useEffect(() => {
        latestRef.current = { overlayKey, clear: overlay.onClearHighlight };
    });
    useEffect(() => {
        return () => {
            const { overlayKey: key, clear } = latestRef.current;
            clear(key);
        };
    }, []);

    return (
        <button
            type="button"
            aria-pressed={isOn}
            aria-label={t('AnalysisPanel.f66b28', { v0: cardTitle })}
            onClick={() => overlay.onToggle(overlayKey)}
            // 키보드 포커스(`:focus-visible`)일 때만 강조한다 — 탭·클릭 포커스까지
            // 받으면 모바일에서 누른 뒤 강조가 풀리지 않는다(hover 핸들러와 같은 이유).
            onFocus={e => {
                if (e.currentTarget.matches(':focus-visible'))
                    overlay.onHighlight(overlayKey);
            }}
            onBlur={() => overlay.onClearHighlight(overlayKey)}
            className={cn(
                // 오른쪽 여백 — 바로 옆 신뢰도 배지(또는 카드 끝)와 붙지 않게 한다.
                // `before:-inset-2`로 탭 영역을 넓힌다(시각 크기는 그대로) — 헤더 행 높이를
                // 바꾸지 않고 형제 컨트롤과 같은 44px 급 터치 타깃을 준다.
                "relative mr-2 shrink-0 touch-manipulation rounded px-1.5 py-1 text-[10px] font-medium transition-colors before:absolute before:-inset-2 before:content-['']",
                'focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none',
                isOn
                    ? 'bg-primary-600 text-white'
                    : 'text-secondary-500 hover:bg-secondary-700 hover:text-secondary-200'
            )}
        >
            {t('AnalysisPanel.bcc718')}
        </button>
    );
}
