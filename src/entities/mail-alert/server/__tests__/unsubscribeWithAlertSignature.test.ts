vi.mock('server-only', () => ({}));

import {
    buildMailAlertUnsubscribeApiUrl,
    buildMailAlertManageUrl,
} from '../../lib/mailAlertLinks';
import { unsubscribeWithAlertSignature } from '../unsubscribeWithAlertSignature';

const SECRET = 'unsub-secret-unsub-secret-unsub-secret';
const SITE = 'https://siglens.io';
const ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';

function signatureOf(url: string): string {
    return new URL(url).searchParams.get('sig') ?? '';
}

describe('unsubscribeWithAlertSignature', () => {
    const validSig = signatureOf(
        buildMailAlertUnsubscribeApiUrl(SITE, SECRET, ID, 'ko')
    );

    it('서명이 맞으면 링크 소유자로 구독자 행을 지우고 ok다(회원 연결 행도 같다)', async () => {
        const deleteByOwner = vi.fn().mockResolvedValue(true);

        await expect(
            unsubscribeWithAlertSignature(
                { deleteByOwner },
                SECRET,
                ID,
                validSig
            )
        ).resolves.toBe('ok');

        expect(deleteByOwner).toHaveBeenCalledWith({
            kind: 'link',
            subscriberId: ID,
        });
    });

    it('이미 지워진 구독자도 ok다(존재 여부를 흘리지 않는다)', async () => {
        const deleteByOwner = vi.fn().mockResolvedValue(false);

        await expect(
            unsubscribeWithAlertSignature(
                { deleteByOwner },
                SECRET,
                ID,
                validSig
            )
        ).resolves.toBe('ok');
    });

    it('서명이 틀리면 지우지 않는다', async () => {
        const deleteByOwner = vi.fn();

        await expect(
            unsubscribeWithAlertSignature(
                { deleteByOwner },
                SECRET,
                ID,
                'forged'
            )
        ).resolves.toBe('invalid');
        expect(deleteByOwner).not.toHaveBeenCalled();
    });

    it('설정 링크의 서명은 수신거부 서명으로 통하지 않는다', async () => {
        const deleteByOwner = vi.fn();
        const manageSig = signatureOf(
            buildMailAlertManageUrl(SITE, SECRET, 'ko', ID)
        );

        await expect(
            unsubscribeWithAlertSignature(
                { deleteByOwner },
                SECRET,
                ID,
                manageSig
            )
        ).resolves.toBe('invalid');
        expect(deleteByOwner).not.toHaveBeenCalled();
    });

    it('다른 구독자 id의 서명은 통하지 않는다', async () => {
        const deleteByOwner = vi.fn();

        await expect(
            unsubscribeWithAlertSignature(
                { deleteByOwner },
                SECRET,
                '00000000-0000-4000-8000-000000000000',
                validSig
            )
        ).resolves.toBe('invalid');
        expect(deleteByOwner).not.toHaveBeenCalled();
    });

    it('비밀이 없으면 지우지 않는다', async () => {
        const deleteByOwner = vi.fn();

        await expect(
            unsubscribeWithAlertSignature({ deleteByOwner }, null, ID, validSig)
        ).resolves.toBe('invalid');
        expect(deleteByOwner).not.toHaveBeenCalled();
    });
});
