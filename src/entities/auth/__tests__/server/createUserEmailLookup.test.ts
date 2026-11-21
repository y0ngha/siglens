const repo = vi.hoisted(() => ({ findByEmail: vi.fn() }));
vi.mock('@/entities/auth/api', () => ({
    DrizzleUserRepository: vi.fn(function () {
        return repo;
    }),
}));

import { createUserEmailLookup } from '@/entities/auth/server/createUserEmailLookup';
import type { SiglensDatabase } from '@/shared/db/types';

describe('createUserEmailLookup', () => {
    it('이메일 조회만 위임하고 그 밖의 저장소 메서드는 내밀지 않는다', async () => {
        repo.findByEmail.mockResolvedValue({ id: 'u-1' });
        const lookup = createUserEmailLookup({} as SiglensDatabase);

        await expect(lookup.findByEmail('a@example.com')).resolves.toEqual({
            id: 'u-1',
        });
        expect(repo.findByEmail).toHaveBeenCalledWith('a@example.com');
        expect(Object.keys(lookup)).toEqual(['findByEmail']);
    });
});
