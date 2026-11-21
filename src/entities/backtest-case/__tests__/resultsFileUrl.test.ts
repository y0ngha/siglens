import {
    BACKTEST_RESULTS_RAW_BASE,
    REPO_RAW_MASTER_BASE,
    backtestResultsFileUrl,
    backtestResultsRepoPath,
    type BacktestResultsFile,
} from '@/entities/backtest-case/lib/resultsFileUrl';

const RUN_ID = '2026-11-daily-ai';
const FILES: readonly BacktestResultsFile[] = [
    'trades.csv',
    'decisions.csv',
    'README.ko.md',
];

describe('resultsFileUrl', () => {
    it('raw 접두는 레포 master의 backtest-results 폴더다', () => {
        expect(REPO_RAW_MASTER_BASE).toBe(
            'https://raw.githubusercontent.com/y0ngha/siglens/master'
        );
        expect(BACKTEST_RESULTS_RAW_BASE).toBe(
            'https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results'
        );
    });

    it.each(FILES)(
        '%s의 저장소 경로와 URL은 같은 실행 폴더를 가리킨다',
        file => {
            expect(backtestResultsRepoPath(RUN_ID, file)).toBe(
                `backtest-results/${RUN_ID}/${file}`
            );
            expect(backtestResultsFileUrl(RUN_ID, file)).toBe(
                `https://raw.githubusercontent.com/y0ngha/siglens/master/backtest-results/${RUN_ID}/${file}`
            );
        }
    );
});
