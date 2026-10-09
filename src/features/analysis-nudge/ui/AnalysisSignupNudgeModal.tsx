'use client';

import { useTranslations } from 'next-intl';
import { REASONING_FEATURE_LABEL_KEY } from '@/features/reasoning-toggle/model/reasoningFeature';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import type {
    ContextOf,
    FunnelNudgeKind,
} from '@/shared/lib/funnel/funnelEvents';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import { LayersIcon, MailIcon } from '@/shared/ui/StrokeIcons';

/** 이 모달을 여는 두 계기. 퍼널 이벤트의 `kind`로 그대로 기록된다. */
export type SignupNudgeKind = Extract<
    FunnelNudgeKind,
    'anon_auto' | 'reasoning_toggle'
>;

interface AnalysisSignupNudgeModalProps {
    /** 무엇이 열었나 — 자동 넛지(`anon_auto`)인지 잠긴 추론 토글 클릭(`reasoning_toggle`)인지. */
    kind: SignupNudgeKind;
    /**
     * 어떤 기능을 알릴지. `reasoning`은 상세 분석(추론 토글), `emailReport`는 보유 종목
     * 메일 리포트다. 잠금 토글 클릭은 늘 `reasoning`, 자동 넛지는 둘을 번갈아 쓴다.
     */
    variant: SignupNudgeVariant;
    onClose: () => void;
}

const TITLE_ID = 'analysis-signup-nudge-title';
const ACTION_SIZE = 'h-10 px-4 text-sm';

/**
 * Anonymous signup nudge modal (member-reasoning-toggle
 * spec Part B.3). Same shell as `PremiumModelGateModal` (focus-trap/escape/
 * backdrop close via `ModalShell`) but with its own copy — this modal is
 * purely informational (soft nudge), never blocking analysis.
 */
export function AnalysisSignupNudgeModal({
    kind,
    variant,
    onClose,
}: AnalysisSignupNudgeModalProps) {
    const t = useTranslations('features.analysis-nudge');
    const tA11y = useTranslations('features.reasoning-toggle.a11y');
    // `variant`는 자동 넛지에만 의미가 있다 — 문구를 번갈아 보여 주는 쪽. 잠금 토글
    // 클릭은 늘 `reasoning` 문구라 기록해도 정보가 늘지 않고, 이벤트 카탈로그도
    // `anon_auto`에만 허용한다.
    const funnelContext: ContextOf<'nudge_shown'> =
        kind === 'anon_auto' ? { kind, variant } : { kind };
    useFunnelNudgeShown(funnelContext);

    const handleSignupClick = (): void => {
        trackFunnelEvent('nudge_clicked', { ...funnelContext, cta: 'signup' });
        onClose();
    };

    // 문구 종류별 아이콘·제목·본문. `Record`라 종류가 늘면 여기서 컴파일 오류로 드러난다 —
    // 이분 분기였다면 새 종류가 조용히 한쪽 문구로 떨어진다.
    const content: Record<
        SignupNudgeVariant,
        { Icon: typeof MailIcon; title: string; body: string }
    > = {
        emailReport: {
            Icon: MailIcon,
            title: t('AnalysisSignupNudgeModal.7e84b8'),
            body: t('AnalysisSignupNudgeModal.ac43bc'),
        },
        reasoning: {
            Icon: LayersIcon,
            title: t('AnalysisSignupNudgeModal.84ff73'),
            // The object-particle `을` assumes REASONING_FEATURE_LABEL_KEY ends in a
            // consonant (batchim) — true for '상세 분석' (분석 ends in 석). Revisit the
            // particle (을/를) if the label ever changes to a vowel-final word.
            body: t('AnalysisSignupNudgeModal.486011', {
                v0: tA11y(REASONING_FEATURE_LABEL_KEY),
            }),
        },
    };
    const { Icon, title, body } = content[variant];

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <Icon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {title}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
                    {body}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href="/signup"
                    onClick={handleSignupClick}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('AnalysisSignupNudgeModal.2b8afd')}
                </Link>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('AnalysisSignupNudgeModal.94b7db')}
                </button>
            </div>
        </ModalShell>
    );
}
