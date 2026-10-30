const { mockAfter } = vi.hoisted(() => ({ mockAfter: vi.fn() }));

vi.mock('next/server', () => ({ after: mockAfter }));

vi.mock('../lock', () => ({ acquirePrewarmLock: vi.fn() }));

// 배치·정리·락 해제 본문은 자체 테스트(runSeoPrewarmJob.test.ts)가 덮는다 — 여기선 호출 배선만 본다.
vi.mock('../runSeoPrewarmJob', () => ({ runSeoPrewarmJob: vi.fn() }));

import { constants } from 'node:http2';
import { PATCH } from '@/app/api/cron/seo-prewarm/route';
import { acquirePrewarmLock } from '@/app/api/cron/seo-prewarm/lock';
import { runSeoPrewarmJob } from '@/app/api/cron/seo-prewarm/runSeoPrewarmJob';
import { isBatchWork } from '@/shared/lib/renderBudget';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

function makeRequest(authorization?: string): Request {
    return new Request('http://localhost/api/cron/seo-prewarm', {
        method: 'PATCH',
        headers: authorization ? { authorization } : undefined,
    });
}

/** `afterWithDrain`이 `after()`에 넘긴 콜백을 꺼내 실행한다. */
async function runScheduledCallback(): Promise<void> {
    const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await callback();
}

describe('PATCH /api/cron/seo-prewarm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('CRON_SECRET이 설정되지 않으면 401을 반환한다', async () => {
        delete process.env.CRON_SECRET;
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 틀리면 401을 반환한다', async () => {
        const res = await PATCH(makeRequest('Bearer wrong-secret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 길이는 같지만 내용이 틀리면 401을 반환한다(timingSafeEqual 경로, length 얼리리턴 아님)', async () => {
        // 'wrongsecret'은 'test-secret'과 동일하게 11자 — `Bearer <secret>` 전체 길이가
        // 같으므로 safeBearerCompare의 `a.length !== b.length` 얼리리턴을 우회하고
        // timingSafeEqual이 실제로 false를 반환하는 경로를 검증한다.
        const res = await PATCH(makeRequest('Bearer wrongsecret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
        const res = await PATCH(makeRequest());
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('Bearer 토큰이 맞아도 락 획득에 실패하면(null) 204를 반환하고 after는 예약되지 않는다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue(null);
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(mockAfter).not.toHaveBeenCalled();
    });

    describe('acquirePrewarmLock이 throw하면(Upstash 장애)', () => {
        beforeEach(() => {
            vi.mocked(acquirePrewarmLock).mockRejectedValue(
                new Error('upstash timeout')
            );
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        it('204를 반환한다', async () => {
            const res = await PATCH(makeRequest('Bearer test-secret'));
            expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        });

        it('after를 예약하지 않는다', async () => {
            await PATCH(makeRequest('Bearer test-secret'));
            expect(mockAfter).not.toHaveBeenCalled();
        });

        it('메트릭 필터 접두로 로그한다', async () => {
            await PATCH(makeRequest('Bearer test-secret'));
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] redis unavailable — lock acquire threw:',
                expect.any(Error)
            );
        });
    });

    describe('락을 획득하면', () => {
        beforeEach(() => {
            vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        });

        it('202를 즉시 반환한다', async () => {
            const res = await PATCH(makeRequest('Bearer test-secret'));
            expect(res.status).toBe(HTTP_STATUS_ACCEPTED);
        });

        it('after가 1회 예약되고 작업은 응답 전에 돌지 않는다', async () => {
            await PATCH(makeRequest('Bearer test-secret'));
            expect(mockAfter).toHaveBeenCalledTimes(1);
            expect(runSeoPrewarmJob).not.toHaveBeenCalled();
        });

        it('예약된 작업은 획득한 토큰과 획득 시각으로 job을 부른다', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-08-03T15:30:00.000Z'));
            await PATCH(makeRequest('Bearer test-secret'));
            vi.setSystemTime(new Date('2026-08-03T15:45:00.000Z'));
            await runScheduledCallback();
            expect(runSeoPrewarmJob).toHaveBeenCalledWith(
                'token-1',
                new Date('2026-08-03T15:30:00.000Z').getTime()
            );
        });

        it('락 획득은 배치 표식(runAsBatchWork) 안에서 돈다 — 렌더 예산을 물려받지 않는다', async () => {
            let seen: boolean | null = null;
            vi.mocked(acquirePrewarmLock).mockImplementation(async () => {
                seen = isBatchWork();
                return 'token-1';
            });
            await PATCH(makeRequest('Bearer test-secret'));
            expect(seen).toBe(true);
        });

        it('job은 배치 표식(runAsBatchWork) 안에서 돈다', async () => {
            let seen: boolean | null = null;
            vi.mocked(runSeoPrewarmJob).mockImplementation(async () => {
                seen = isBatchWork();
            });
            await PATCH(makeRequest('Bearer test-secret'));
            await runScheduledCallback();
            expect(seen).toBe(true);
        });
    });
});
