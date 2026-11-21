/** siglens 레포 master의 raw 파일 주소 접두. 저장소 안 파일을 가리키는 URL은 모두 이 하나에서 만든다. */
export const REPO_RAW_MASTER_BASE =
    'https://raw.githubusercontent.com/y0ngha/siglens/master';

/** 백테스트 실행 결과 폴더. 실행마다 `<runId>/` 아래에 파일이 생긴다. */
export const BACKTEST_RESULTS_REPO_DIR = 'backtest-results';

/**
 * 공개 채점 기록의 원본 URL 접두. siglens 레포 master의 `backtest-results/<runId>/`를 가리킨다 —
 * 실행 결과 폴더는 실행마다 새로 만들고 덮어쓰지 않으므로 master 경로가 그 실행의 기록이다.
 */
export const BACKTEST_RESULTS_RAW_BASE = `${REPO_RAW_MASTER_BASE}/${BACKTEST_RESULTS_REPO_DIR}`;

export type BacktestResultsFile =
    | 'trades.csv'
    | 'decisions.csv'
    | 'README.ko.md';

/** 저장소 안 상대 경로. 링크 가드가 파일 존재를 확인한다. */
export function backtestResultsRepoPath(
    runId: string,
    file: BacktestResultsFile
): string {
    return `${BACKTEST_RESULTS_REPO_DIR}/${runId}/${file}`;
}

export function backtestResultsFileUrl(
    runId: string,
    file: BacktestResultsFile
): string {
    return `${BACKTEST_RESULTS_RAW_BASE}/${runId}/${file}`;
}
