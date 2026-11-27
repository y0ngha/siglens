/**
 * `/backtesting`의 "분석 기록과 측정 방법" 구역 앵커. 구역(`widgets/backtesting`)과
 * 분석 패널 하단 링크(`widgets/analysis`)가 같은 id를 가리켜야 해서 위젯 둘이 함께 쓰는
 * 값을 shared에 둔다. 로케일 접두사는 `LocaleLink`가 붙인다.
 */
export const BACKTEST_RECORD_ID = 'record';

export const BACKTEST_RECORD_PATH = `/backtesting#${BACKTEST_RECORD_ID}`;
