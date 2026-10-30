'use client';

import { useId } from 'react';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { useLocaleSwitch } from './hooks/useLocaleSwitch';
import { usePopoverDisclosure } from './hooks/usePopoverDisclosure';
import { LocaleRadioGroup } from './ui/locale/LocaleRadioGroup';
import { LocaleTrigger } from './ui/locale/LocaleTrigger';

interface LocaleSwitcherProps {
    readonly className?: string;
    /**
     * 현재 언어를 아이콘 옆에 글자로도 보인다.
     *
     * 기본값(`false`)은 **좁은 화면에서만** 숨긴다(`hidden sm:inline`) — 모바일
     * 헤더 한 줄에 로고·검색·언어·테마·계정·햄버거가 이미 서 있어 360px에서
     * 라벨까지 넣으면 넘친다. 드로어처럼 가로가 남는 자리는 `true`로 강제한다.
     */
    readonly showLabel?: boolean;
    /**
     * 팝오버를 트리거의 어느 쪽에 붙일지.
     *
     * 기본값 `end`(오른쪽 정렬)는 헤더 오른쪽 끝에 선 트리거용이다. 드로어처럼
     * 트리거가 **왼쪽**에 있는 자리에서 `end`를 쓰면 패널이 왼쪽으로 뻗어
     * 화면 밖으로 나간다.
     */
    readonly align?: 'start' | 'end';
}

/**
 * 언어 전환기 — 데스크톱 헤더·모바일 헤더·모바일 드로어가 **같은 컴포넌트를 쓴다**.
 *
 * 네이티브 `<select>`가 아니라 팝오버 라디오그룹이다. 바로 옆 `ThemeToggle`이 팝오버라
 * 같은 줄의 두 컨트롤이 상호작용도 같아야 하기 때문이다. 바깥 클릭·Esc 닫기, 단일 탭
 * 스톱 + 화살표 이동, 체크 도형 선택 표시는 직접 채운다(`LocaleRadioGroup`).
 *
 * 포털을 쓰지 않는다 — 사이트 헤더는 `sticky z-50`(최상위)이라 팝오버가 덮일 스택
 * 컨텍스트 함정이 없다. 컨테이너는 `inline-flex`여야 한다: 블록이면 flex 행이 아닌
 * 부모에서 폭을 통째로 먹어 팝오버의 `right-0`이 트리거가 아니라 부모 끝을 기준으로 붙는다.
 */
export function LocaleSwitcher({
    className,
    showLabel = false,
    align = 'end',
}: LocaleSwitcherProps) {
    const { locale, isPending, select } = useLocaleSwitch();
    const { containerRef, triggerRef, isOpen, close, toggle } =
        usePopoverDisclosure();
    const menuId = useId();

    const onSelect = (next: Locale) => {
        select(next);
        close();
    };

    return (
        <div
            ref={containerRef}
            className={cn('relative inline-flex shrink-0', className)}
        >
            <LocaleTrigger
                ref={triggerRef}
                locale={locale}
                isOpen={isOpen}
                isPending={isPending}
                menuId={menuId}
                showLabel={showLabel}
                onClick={toggle}
            />
            {isOpen && (
                <LocaleRadioGroup
                    id={menuId}
                    locale={locale}
                    align={align}
                    onSelect={onSelect}
                />
            )}
        </div>
    );
}
