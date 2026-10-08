import { signReportValue } from '@/entities/email-report/lib/reportSignature';
import { unsubscribeWithSignature } from '@/entities/email-report/unsubscribeWithSignature';

const SECRET = 'unsub-secret-unsub-secret-unsub-secret';
const USER = '0b6f1c2e-6a8f-4f58-9d7a-0d1b2c3d4e5f';

describe('unsubscribeWithSignature', () => {
    it('서명이 맞으면 구독을 끄고 ok', async () => {
        const repo = { disable: vi.fn().mockResolvedValue(true) };

        const outcome = await unsubscribeWithSignature(
            repo,
            SECRET,
            USER,
            signReportValue(SECRET, 'unsubscribe', USER)
        );

        expect(outcome).toBe('ok');
        expect(repo.disable).toHaveBeenCalledWith(USER);
    });

    it('구독 행이 없어도 ok — 회원 존재 여부를 드러내지 않는다', async () => {
        const repo = { disable: vi.fn().mockResolvedValue(false) };

        await expect(
            unsubscribeWithSignature(
                repo,
                SECRET,
                USER,
                signReportValue(SECRET, 'unsubscribe', USER)
            )
        ).resolves.toBe('ok');
    });

    it.each([
        ['서명 불일치', SECRET, USER, 'bad'],
        ['비밀값 없음', null, USER, 'x'],
        ['UUID가 아닌 id', SECRET, 'not-a-uuid', 'x'],
    ])('%s면 invalid이고 끄지 않는다', async (_, secret, userId, sig) => {
        const repo = { disable: vi.fn() };

        await expect(
            unsubscribeWithSignature(repo, secret, userId, sig)
        ).resolves.toBe('invalid');
        expect(repo.disable).not.toHaveBeenCalled();
    });

    it('차트용 서명으로는 끌 수 없다', async () => {
        const repo = { disable: vi.fn() };

        await expect(
            unsubscribeWithSignature(
                repo,
                SECRET,
                USER,
                signReportValue(SECRET, 'chart', USER)
            )
        ).resolves.toBe('invalid');
    });
});
