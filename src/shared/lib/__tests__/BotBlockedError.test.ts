import { BotBlockedError } from '@/shared/lib/BotBlockedError';

describe('BotBlockedError', () => {
    it('extends Error', () => {
        const error = new BotBlockedError();
        expect(error).toBeInstanceOf(Error);
    });

    it('has name "BotBlockedError"', () => {
        const error = new BotBlockedError();
        expect(error.name).toBe('BotBlockedError');
    });

    it('has message "bot_blocked"', () => {
        const error = new BotBlockedError();
        expect(error.message).toBe('bot_blocked');
    });

    it('has isBotBlocked set to true', () => {
        const error = new BotBlockedError();
        expect(error.isBotBlocked).toBe(true);
    });

    it('can be caught with instanceof check', () => {
        try {
            throw new BotBlockedError();
        } catch (e) {
            expect(e).toBeInstanceOf(BotBlockedError);
            expect((e as BotBlockedError).isBotBlocked).toBe(true);
        }
    });
});
