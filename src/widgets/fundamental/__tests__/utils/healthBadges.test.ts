import {
    altmanBadge,
    piotroskiBadge,
} from '@/widgets/fundamental/utils/healthBadges';

const t = (key: string) => key;

describe('altmanBadge', () => {
    it.each([
        [null, undefined],
        [3.5, { text: 'financialHealthZone.safe', variant: 'good' }],
        [2.99, { text: 'financialHealthZone.caution', variant: 'warn' }],
        [2.0, { text: 'financialHealthZone.caution', variant: 'warn' }],
        [1.81, { text: 'financialHealthZone.danger', variant: 'bad' }],
    ])('z=%s', (z, expected) => {
        expect(altmanBadge(z, t)).toEqual(expected);
    });
});

describe('piotroskiBadge', () => {
    it.each([
        [null, undefined],
        [9, { text: 'financialHealthZone.strong', variant: 'good' }],
        [8, { text: 'financialHealthZone.strong', variant: 'good' }],
        [5, { text: 'riskLevel.medium', variant: 'neutral' }],
        [4, { text: 'financialHealthZone.weak', variant: 'bad' }],
    ])('p=%s', (p, expected) => {
        expect(piotroskiBadge(p, t)).toEqual(expected);
    });
});
