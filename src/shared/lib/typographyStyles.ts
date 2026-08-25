/**
 * 라벨·아이브로 타이포그래피.
 *
 * 이 파일이 존재하는 이유는 하나다: **한글에 모노와 uppercase를 쓰면 안 된다.**
 *
 * 리디자인 전에는 "투자의 확신을 더하는 AI 분석"(홈 히어로 첫 줄), "일시 오류"
 * (에러 페이지 8곳) 같은 한글 라벨이 `font-mono tracking-[0.18em] uppercase`로
 * 조판돼 있었다. 세 가지가 동시에 잘못이다:
 *
 *  1. 모노 — Geist Mono에 한글 글리프가 없어 OS 폰트로 조용히 폴백된다.
 *     맥은 Apple SD Gothic Neo, 윈도는 맑은 고딕이 모노 메트릭 위에 얹혀
 *     자간이 벌어지고 기기마다 다르게 보인다.
 *  2. uppercase — 한글에는 대소문자가 없어 아무 효과가 없다. 라틴 라벨만
 *     터미널 느낌을 얻고 한글 라벨은 그냥 작은 굵은 글씨가 되어, 같은 역할의
 *     라벨이 언어에 따라 다른 물건으로 보인다.
 *  3. 넓은 자간 — 0.18em은 라틴 소문자 기준이다. 한글은 이미 정사각 프레임에
 *     내부 여백을 갖고 있어 같은 값을 주면 글자가 흩어진다.
 *
 * 대시보드의 "Terminal Editorial" 라벨 언어(추적 대문자 모노)는 유지할 가치가
 * 있으므로 버리지 않고 **문자 체계로 분기**한다. 라틴 라벨은 그대로 두고,
 * 한글 라벨은 크기와 굵기로 같은 위계를 만든다.
 */
import { cn } from '@/shared/lib/cn';

/**
 * 한글 라벨·아이브로. 모노·uppercase 없이 크기와 굵기로 위계를 만든다.
 * 자간은 한글 가독을 해치지 않는 범위(0.01em)로만 준다.
 */
export const LABEL_KO = cn(
    'text-xs font-semibold tracking-[0.01em] text-secondary-400'
);

/**
 * 라틴 전용 라벨(티커, `PRIVACY POLICY` 같은 영문 표제).
 * 여기서만 모노·추적 대문자를 쓴다 — 한글이 섞이면 LABEL_KO를 쓸 것.
 */
export const LABEL_LATIN = cn(
    'font-mono text-[0.6875rem] font-semibold tracking-[0.14em] text-secondary-400 uppercase'
);

/**
 * 페이지 안 섹션 제목(h2).
 *
 * 이 상수가 생긴 이유: 같은 역할의 h2가 네 파일에 각자 하드코딩돼 있었고,
 * 한 곳만 손대자 곧바로 위계가 뒤집혔다 — `SignalSubsection`의 h3를 16px로
 * 올렸더니 그 h3를 담고 있는 `SectorSignalPanel`의 h2가 14px로 남아 소제목이
 * 상위 제목보다 크고 밝아졌다. 같은 위계는 한 곳에서만 정의한다.
 *
 * 한글 제목이므로 uppercase·넓은 자간을 쓰지 않는다([[LABEL_KO]] 주석 참조).
 *
 * 값은 제품의 우세 h2 톤을 따른다 — `SnapshotSummarySection`이 이미
 * `text-lg font-semibold tracking-tight`를 쓰고 그 테스트가 이를 회귀 가드로
 * 고정해 두고 있다. 18px이라 소제목(h3, 16px)과 한 단계 벌어진다.
 */
export const HEADING_SECTION = cn(
    'text-lg font-semibold tracking-tight text-secondary-100'
);

/**
 * 섹션 안의 소제목(h3). 여러 카드를 묶는 그룹 라벨.
 *
 * 이 상수가 생긴 이유도 [[HEADING_SECTION]]과 같다. 미국 지표 그리드는
 * `text-base font-medium text-secondary-200`, 한국 지표 그리드는
 * `text-sm font-medium text-secondary-400`으로 갈려 있었고, 한국 쪽은 자기가
 * 묶는 카드 제목(h4, `text-sm text-secondary-400`)과 **크기·색이 완전히 같아**
 * 굵기 한 단계만 남았다 — 라이트 테마에서는 하위 h4가 오히려 대비가 높았다.
 * 두 그리드가 같은 h2 토큰을 쓰는 이상 소제목도 같은 값이어야 한다.
 */
export const HEADING_SUBSECTION = cn(
    'text-base font-medium text-secondary-200'
);

/**
 * 자릿수가 맞아야 하는 수치(가격·등락률·개수).
 * 모노 대신 본문 서체의 tabular 숫자를 쓴다 — 한글 단위(“개”, “종”)가 붙어도
 * 폰트가 갈리지 않고, 숫자 폭은 여전히 고정된다.
 */
export const NUM_TABULAR = cn('tabular-nums');
