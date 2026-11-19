/**
 * 미결제약정(OI) 툴팁 JSX — 옵션 탭과 SIGLENS AI 답변 안 옵션 블록(`OpenInterestChart`)이 같이 쓴다.
 *
 * `optionsTooltips`와 따로 둔 이유: 그 모듈은 시장 시간 안내(ATM IV·내재 변동폭)를 위해 core 값에 닿는데, 채팅 화면
 * 번들은 core를 끌어오면 안 된다(`aiChatCoreFree`). 이 모듈은 카탈로그 문단만 그려서 core 없이 import된다.
 */

import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';

export const OpenInterestTooltip = (
    <TooltipParagraphs namespace="widgets.options" tooltipKey="openInterest" />
);

export const CallOpenInterestTooltip = (
    <TooltipParagraphs
        namespace="widgets.options"
        tooltipKey="callOpenInterest"
    />
);

export const PutOpenInterestTooltip = (
    <TooltipParagraphs
        namespace="widgets.options"
        tooltipKey="putOpenInterest"
    />
);
