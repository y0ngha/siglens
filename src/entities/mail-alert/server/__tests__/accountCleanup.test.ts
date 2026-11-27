const repo = vi.hoisted(() => ({ deleteForAccount: vi.fn() }));
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzleMailAlertSubscriberRepository: vi.fn(function () {
        return repo;
    }),
}));

import { createMailAlertAccountCleanup } from '@/entities/mail-alert/server/accountCleanup';
import type { SiglensDatabase } from '@/shared/db/types';

const cleanup = () => createMailAlertAccountCleanup({} as SiglensDatabase);

beforeEach(() => {
    repo.deleteForAccount.mockReset();
});

describe('createMailAlertAccountCleanup', () => {
    it('저장소의 삭제 수를 그대로 돌려준다', async () => {
        repo.deleteForAccount.mockResolvedValue(2);

        await expect(cleanup().deleteForAccount('user-1')).resolves.toBe(2);
        expect(repo.deleteForAccount).toHaveBeenCalledWith('user-1');
    });

    it('테이블이 아직 없으면(42P01) 지울 것이 없는 것이라 0이다', async () => {
        repo.deleteForAccount.mockRejectedValue({ cause: { code: '42P01' } });

        await expect(cleanup().deleteForAccount('user-1')).resolves.toBe(0);
    });

    it('그 밖의 오류는 호출자(deleteAccount)가 로그만 남기도록 그대로 던진다', async () => {
        const boom = new Error('db');
        repo.deleteForAccount.mockRejectedValue(boom);

        await expect(cleanup().deleteForAccount('user-1')).rejects.toBe(boom);
    });
});
