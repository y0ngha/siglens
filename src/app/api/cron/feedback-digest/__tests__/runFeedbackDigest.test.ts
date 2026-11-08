import { runFeedbackDigest } from '@/app/api/cron/feedback-digest/runFeedbackDigest';
import type { FeedbackDigestRow } from '@/entities/feedback/lib/types';

const NOW = new Date('2026-11-09T00:05:00Z');
const DAY = 24 * 60 * 60 * 1000;

const row: FeedbackDigestRow = {
    surface: 'siglens',
    vote: 'down',
    reasons: ['inaccurate'],
    comment: 'c',
    targetType: 'technical',
    symbol: 'AAPL',
    createdAt: new Date('2026-11-08T10:00:00Z'),
};

function makeDeps(rows: FeedbackDigestRow[] = [row]) {
    const listAiFeedbackSince = vi.fn().mockResolvedValue(rows);
    const deleteOlderThan = vi.fn().mockResolvedValue(3);
    const notifier = vi.fn().mockResolvedValue(true);
    return {
        deps: {
            repository: { listAiFeedbackSince, deleteOlderThan },
            notifier,
        },
        listAiFeedbackSince,
        deleteOlderThan,
        notifier,
    };
}

describe('runFeedbackDigest', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('지난 24시간 행을 조회해 요약 메일을 보낸다', async () => {
        const { deps, listAiFeedbackSince, notifier } = makeDeps();

        await runFeedbackDigest(NOW, deps);

        expect(listAiFeedbackSince).toHaveBeenCalledWith(
            new Date(NOW.getTime() - DAY)
        );
        expect(notifier).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: expect.stringContaining('AI 응답 피드백 요약'),
            })
        );
    });

    it('행이 0건이면 메일을 보내지 않는다', async () => {
        const { deps, notifier } = makeDeps([]);

        await runFeedbackDigest(NOW, deps);

        expect(notifier).not.toHaveBeenCalled();
    });

    it('요약 뒤 365일이 지난 행을 삭제하고 로그를 남긴다', async () => {
        const { deps, deleteOlderThan } = makeDeps();

        await runFeedbackDigest(NOW, deps);

        expect(deleteOlderThan).toHaveBeenCalledWith(
            new Date(NOW.getTime() - 365 * DAY)
        );
        expect(console.log).toHaveBeenCalledWith(
            '[feedback-digest] purged 3 rows past retention'
        );
    });

    it('행이 0건이어도 파기는 실행한다', async () => {
        const { deps, deleteOlderThan } = makeDeps([]);

        await runFeedbackDigest(NOW, deps);

        expect(deleteOlderThan).toHaveBeenCalledTimes(1);
    });

    it('메일 단계가 실패해도 파기를 계속한다', async () => {
        const { deps, deleteOlderThan, notifier } = makeDeps();
        notifier.mockRejectedValue(new Error('resend down'));

        await runFeedbackDigest(NOW, deps);

        expect(console.error).toHaveBeenCalledWith(
            '[feedback-digest] digest failed:',
            expect.any(Error)
        );
        expect(deleteOlderThan).toHaveBeenCalledTimes(1);
    });

    it('파기가 실패하면 로그만 남기고 던지지 않는다', async () => {
        const { deps, deleteOlderThan } = makeDeps();
        deleteOlderThan.mockRejectedValue(new Error('db lost'));

        await expect(runFeedbackDigest(NOW, deps)).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            '[feedback-digest] purge failed:',
            expect.any(Error)
        );
    });
});
