import { useTranslations } from 'next-intl';
import { FLOWS_DILUTION_SECTION_ID } from '@/entities/investor-flows/lib/flowsAnchors';
import type { RecentDilutionEvent } from '@/entities/investor-flows/lib/recentDilutionEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/** 한 페이지에 배지는 하나뿐이라(차트 탭 헤더) 고정 id로 설명을 잇는다 — 서버 렌더라 `useId`가 필요 없다. */
const NOTE_ID = 'dilution-risk-badge-note';

/** `YYYY-MM-DD` → `MM/DD`. 로케일·타임존과 무관하게 문자열에서 바로 만든다(신고일은 달력 날짜다). */
function monthDay(isoDate: string): string {
    return `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}`;
}

interface DilutionRiskBadgeProps {
    /** 대문자 티커. 링크 대상(`/{symbol}/flows`)에 쓴다. */
    readonly symbol: string;
    readonly event: RecentDilutionEvent;
}

/**
 * 차트 탭 헤더의 증자·희석 배지 — 최근 90일 안에 실제 공급 공시(ATM 424B5·가격이 정해진 공모)가 있을 때만 페이지가
 * 렌더한다. 수급 탭의 증자·희석 섹션으로 이어지고, 마우스 툴팁(`title`)과 스크린 리더 설명(`aria-describedby`)으로
 * 공시의 한계를 한 문장으로 밝힌다. 서버 컴포넌트라 첫 HTML에 바로 박혀 나타날 때 레이아웃이 밀리지 않는다.
 * 경고 톤은 수급 탭의 발행 공시 배지와 같다(`bg-ui-warning/10 text-ui-warning-text`).
 */
export function DilutionRiskBadge({ symbol, event }: DilutionRiskBadgeProps) {
    const t = useTranslations('views.symbol');
    const date = monthDay(event.filingDate);
    const label =
        event.kind === 'atm'
            ? t('DilutionRiskBadge.atm')
            : t('DilutionRiskBadge.priced');
    // 신고일은 문구와 따로 그린다 — 좁은 화면에서 문구만 말줄임되고 날짜는 항상 보인다(모바일에서 날짜가 먼저 잘리던 문제).
    // 접근 가능한 이름은 `aria-label`로 문구 전체 + 날짜를 그대로 준다(보이는 글자가 이름의 앞부분이라 WCAG 2.5.3 충족).
    const dateSuffix = ` | ${date}`;
    const note = t('DilutionRiskBadge.note');
    return (
        <>
            <Link
                href={`/${symbol}/flows#${FLOWS_DILUTION_SECTION_ID}`}
                // 보조 배지라 뷰포트 진입만으로 수급 탭 페이로드를 당길 이유가 없다.
                prefetch={false}
                title={note}
                aria-label={`${label}${dateSuffix}`}
                aria-describedby={NOTE_ID}
                className="tap-target inline-flex max-w-[50%] min-w-0 shrink items-center rounded bg-ui-warning/10 px-2 py-0.5 text-xs font-medium text-ui-warning-text transition-colors hover:bg-ui-warning/20 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:max-w-xs lg:max-w-md"
            >
                <span className="min-w-0 truncate">{label}</span>
                <span className="shrink-0 whitespace-pre tabular-nums">
                    {dateSuffix}
                </span>
            </Link>
            {/* 설명은 링크 밖 `hidden` 노드에 둔다 — 링크 안에 두면 접근 가능한 이름에 섞이고, `hidden`이어도
                `aria-describedby`는 그 텍스트를 읽는다. 화면에서는 `title` 툴팁이 같은 문장을 보인다. */}
            <span id={NOTE_ID} hidden>
                {note}
            </span>
        </>
    );
}
