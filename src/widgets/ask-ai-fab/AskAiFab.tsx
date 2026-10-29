/**
 * 오른쪽 아래에 떠 있는 "시그렌즈 AI에게 물어보기" 링크(`/[symbol]/*`·차트 가이드 항목).
 */
import { getTranslations } from 'next-intl/server';
import { aiAskUrl } from '@/shared/config/aiHost';
import { cn } from '@/shared/lib/cn';
import { AiSparkIcon } from './ui/AiSparkIcon';
import { resolveAskAiPrefill, type AskAiFabSource } from './utils/askAiPrefill';

/** 프리필 질문의 출처(`AskAiFabSource`)에 링크 대상 로케일을 더한 props. */
type AskAiFabProps = AskAiFabSource & {
    /** `aiAskUrl`에 넘길 로케일 접두 경로(`localePath(locale, '/')`). */
    localePrefix: string;
};

/*
 * 위치·z-index — `SearchOverlay`의 `z-70`은 이 FAB(`z-60`)보다 위에 뜨려고 고른 값이라
 * z-index를 올리면 검색 오버레이를 덮는다. 모바일 `bottom` 식은 `globals.css`의 PWA 배너
 * 들어올림 규칙(`[data-ask-ai-fab]`)이 그대로 되풀이하므로 함께 바꾼다.
 * 앱은 `viewportFit: 'cover'`라 가로 모드 노치·하단 홈 인디케이터를 env()로 비운다.
 */
const FAB_POSITION =
    'fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-60 md:right-[max(1.5rem,env(safe-area-inset-right))] md:bottom-6';
const FAB_SHAPE =
    'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg';
const FAB_COLOUR =
    'bg-primary-600 text-white transition-colors hover:bg-primary-700';
/*
 * 라이트 테마는 `primary-500`과 `primary-600`이 같은 값이라 버튼에 붙은 링이 버튼 면과
 * 구분되지 않는다 — 페이지 배경색 간격(`ring-offset`)을 두어 링이 보이게 한다.
 */
const FAB_FOCUS =
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none';

const FAB_CLASS_NAME = cn(FAB_POSITION, FAB_SHAPE, FAB_COLOUR, FAB_FOCUS);

/**
 * `ai.siglens.io`로 질문을 미리 채워 새 탭에서 여는 플로팅 링크.
 *
 * 패널을 열지 않는다 — 질문은 입력창에 채워질 뿐 자동 전송되지 않는다(`aiAskUrl` 계약).
 * 상호작용 상태가 없는 순수 링크라 서버 컴포넌트다.
 *
 * 접근성 이름은 보이는 라벨 + 숨긴 "(새 탭)" 안내로 만든다. 모바일은 짧은 라벨만 보이므로
 * `aria-label`로 긴 문구를 못박으면 보이는 글자가 이름에 들어가지 않아 음성 제어
 * ("AI에게 묻기 누르기")가 링크를 찾지 못한다.
 */
export async function AskAiFab(props: AskAiFabProps) {
    const t = await getTranslations('widgets.ask-ai-fab');
    const prefill = resolveAskAiPrefill(props, name => t('question', { name }));

    return (
        <a
            href={aiAskUrl(props.localePrefix, prefill)}
            target="_blank"
            // nofollow: 종목마다 질문 문구가 다른 `ai.siglens.io/?q=…` URL이 수천 개 생긴다.
            // 크롤러가 따라가면 색인 가치 없는 쿼리 URL에 크롤 예산을 쓴다.
            rel="nofollow noopener"
            // 모바일 분석 시트가 HALF/FULL로 펼쳐지거나 차트 팝오버·모달 시트가 열리면
            // globals.css가 이 속성으로 버튼을 숨긴다.
            data-ask-ai-fab
            className={FAB_CLASS_NAME}
        >
            <AiSparkIcon />
            <span className="sm:hidden">{t('shortLabel')}</span>
            <span className="hidden sm:inline">{t('label')}</span>
            {/* 공백을 두어 이름이 "…물어보기 (새 탭)"으로 띄어 읽히게 한다(sr-only 조각은 붙어 이어진다). */}
            <span className="sr-only"> {t('newTab')}</span>
        </a>
    );
}
