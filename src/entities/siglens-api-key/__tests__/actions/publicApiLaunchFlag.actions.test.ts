/**
 * 공개 API 출시 플래그가 꺼져 있으면 키·기본 모델 서버 액션은 세션·DB를 건드리기 전에 거절한다
 * (서버 액션은 화면 밖에서도 직접 호출할 수 있다).
 */
const { getUser, getDb, revalidate } = vi.hoisted(() => ({
    getUser: vi.fn(),
    getDb: vi.fn(),
    revalidate: vi.fn(),
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: getUser,
}));
vi.mock('@/shared/db/client', () => ({ getDatabaseClient: getDb }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));

import { createSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/createSiglensApiKeyAction';
import { getApiDefaultModelAction } from '@/entities/siglens-api-key/actions/getApiDefaultModelAction';
import { listSiglensApiKeysAction } from '@/entities/siglens-api-key/actions/listSiglensApiKeysAction';
import { revokeSiglensApiKeyAction } from '@/entities/siglens-api-key/actions/revokeSiglensApiKeyAction';
import { setApiDefaultModelAction } from '@/entities/siglens-api-key/actions/setApiDefaultModelAction';

function form(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
}

describe('공개 API 출시 플래그 (꺼짐) - 서버 액션', () => {
    beforeEach(() => {
        vi.stubEnv('PUBLIC_API_ENABLED', '');
        getUser.mockClear();
        getDb.mockClear();
        revalidate.mockClear();
    });

    afterEach(() => {
        expect(getUser).not.toHaveBeenCalled();
        expect(getDb).not.toHaveBeenCalled();
        expect(revalidate).not.toHaveBeenCalled();
    });

    it('createSiglensApiKeyAction은 not_available로 거절한다', async () => {
        await expect(
            createSiglensApiKeyAction(
                { status: 'idle' },
                form({ name: '내 에이전트' })
            )
        ).resolves.toMatchObject({ status: 'error', code: 'not_available' });
    });

    it('revokeSiglensApiKeyAction은 not_available로 거절한다', async () => {
        await expect(
            revokeSiglensApiKeyAction(
                { status: 'idle' },
                form({ keyId: '33333333-3333-4333-8333-333333333333' })
            )
        ).resolves.toMatchObject({ status: 'error', code: 'not_available' });
    });

    it('setApiDefaultModelAction은 not_available로 거절한다', async () => {
        await expect(
            setApiDefaultModelAction({ status: 'idle' }, form({ model: '' }))
        ).resolves.toMatchObject({ status: 'error', code: 'not_available' });
    });

    it('listSiglensApiKeysAction은 빈 목록, getApiDefaultModelAction은 null이다', async () => {
        await expect(listSiglensApiKeysAction()).resolves.toEqual([]);
        await expect(getApiDefaultModelAction()).resolves.toBeNull();
    });
});
