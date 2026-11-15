interface CuratedXAccounts {
    company?: string;
    ceo?: { handle: string; name: string };
}

/**
 * 손으로 확인한 공식 계정. 여기 있는 역할은 위키데이터를 묻지 않고 이 값을 쓴다.
 *
 * 넣는 기준: (1) 위키데이터가 그 회사 항목에 같은 핸들을 싣고 있거나 운영자가 직접 확인했고, (2) 위키데이터만으로는
 * 틀린 계정이 골라지거나(META는 팔로워가 더 많은 `Facebook`이 걸려 있다) 회사 항목에 계정이 없는(GOOGL·NFLX·RKLB)
 * 종목이다. 확인하지 못한 핸들은 넣지 않는다 — 틀린 계정의 글을 "공식 계정"으로 전하는 것이 계정이 없다고 답하는
 * 것보다 나쁘다. CEO는 바뀌므로 꼭 필요한 경우만 넣고, 나머지는 위키데이터의 현 CEO 진술을 따른다.
 */
export const CURATED_X_ACCOUNTS: Readonly<Record<string, CuratedXAccounts>> = {
    TSLA: {
        company: 'Tesla',
        // 위키데이터는 이 인물에 계정을 둘 싣고 있다 — 팔로워로 가려지지만 고정해 둔다.
        ceo: { handle: 'elonmusk', name: 'Elon Musk' },
    },
    NVDA: { company: 'nvidia' },
    AMD: { company: 'AMD' },
    INTC: { company: 'intel' },
    ARM: { company: 'Arm' },
    CRWV: { company: 'CoreWeave' },
    META: { company: 'Meta' },
    GOOGL: { company: 'Google' },
    GOOG: { company: 'Google' },
    NFLX: { company: 'netflix' },
    RKLB: { company: 'RocketLab' },
};
