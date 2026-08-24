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
 * 자릿수가 맞아야 하는 수치(가격·등락률·개수).
 * 모노 대신 본문 서체의 tabular 숫자를 쓴다 — 한글 단위(“개”, “종”)가 붙어도
 * 폰트가 갈리지 않고, 숫자 폭은 여전히 고정된다.
 */
export const NUM_TABULAR = cn('tabular-nums');
