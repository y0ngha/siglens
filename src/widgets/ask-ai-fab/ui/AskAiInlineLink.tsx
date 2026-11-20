import { useTranslations } from 'next-intl';
import { aiAskUrl } from '@/shared/config/aiHost';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { AiSparkIcon } from './AiSparkIcon';

interface AskAiInlineLinkProps {
    /** 질문에 끼울 종목 표시명. */
    name: string;
    /** `aiAskUrl`에 넘길 로케일 접두 경로(`localePath(locale, '/')`). */
    localePrefix: string;
}

/**
 * 고정 높이(`min-h-11`)라 나타나도 아래 내용이 밀리지 않는다. 폭은 부모를 채운다.
 */
const INLINE_LINK_CLASS_NAME = cn(
    BUTTON_OUTLINE,
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
);

/**
 * 차트 탭 AI 분석 패널 맨 위에 본문과 같이 흐르는 "시그렌즈 AI에게 물어보기" 링크.
 *
 * 떠 있는 `AskAiFab`과 같은 문구·같은 `ai.siglens.io/?q=…` 대상이다. 차트 탭에서는 이 링크가
 * 있으면 `globals.css`가 떠 있는 버튼을 숨긴다(`[data-ask-ai-inline]`). 모바일 시트의 PEEK 띠와
 * 데스크톱 패널 본문을 가리지 않으려는 것이다.
 *
 * 상호작용 상태가 없는 순수 링크라 `'use client'` 지시어를 두지 않는다. 접근성 이름은 보이는
 * 라벨 + 숨긴 "(새 탭)" 안내로 만든다(`AskAiFab`과 같은 이유).
 */
export function AskAiInlineLink({ name, localePrefix }: AskAiInlineLinkProps) {
    const t = useTranslations('widgets.ask-ai-fab');

    return (
        <a
            href={aiAskUrl(localePrefix, t('question', { name }))}
            target="_blank"
            // nofollow: 종목마다 질문이 다른 `ai.siglens.io/?q=…` URL로 크롤 예산이 새지 않게 한다.
            rel="nofollow noopener"
            data-ask-ai-inline
            className={INLINE_LINK_CLASS_NAME}
        >
            <AiSparkIcon />
            <span>{t('label')}</span>
            {/* 공백을 두어 이름이 "…물어보기 (새 탭)"으로 띄어 읽히게 한다. */}
            <span className="sr-only"> {t('newTab')}</span>
        </a>
    );
}
