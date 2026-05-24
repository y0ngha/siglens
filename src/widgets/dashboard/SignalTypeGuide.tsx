const ENTRIES = [
    {
        term: '골든크로스',
        desc: '단기 이동평균선이 장기 이동평균선을 위로 뚫고 올라가는 순간이에요. 상승 추세 시작의 대표적인 신호로 봐요.',
    },
    {
        term: '데드크로스',
        desc: '단기 이동평균선이 장기 이동평균선을 아래로 뚫고 내려가는 순간이에요. 하락 추세 시작의 대표적인 신호로 봐요.',
    },
    {
        term: 'RSI 과매도/과매수',
        desc: 'RSI가 30 아래로 내려가면(과매도) 반등, 70 위로 올라가면(과매수) 조정 가능성을 살펴봐요.',
    },
    {
        term: '볼린저 하단 반등 / 상단 돌파',
        desc: '가격이 볼린저 하단을 찍고 반등하거나 상단을 뚫고 올라가요. 추세가 이어지거나 과열되었다는 신호일 수 있어요.',
    },
    {
        term: 'RSI 다이버전스',
        desc: '가격은 새 고점·저점을 찍는데 RSI가 따라가지 못해요. 추세가 바뀔 수 있다는 전조 신호예요.',
    },
    {
        term: 'MACD 히스토그램 수렴',
        desc: 'MACD 히스토그램의 막대 크기가 연속해서 줄어들고 있어요. 곧 교차가 일어날 수 있다는 신호예요.',
    },
    {
        term: '볼린저 스퀴즈',
        desc: '볼린저 밴드 폭이 최근 6개월 중 가장 좁아진 상태예요. 곧 한 방향으로 큰 움직임이 나올 가능성이 높아요.',
    },
    {
        term: '지지선/저항선 근접',
        desc: '가격이 MA50이나 MA200 근처에 와 있어요. 반등할지 반락할지 지켜봐야 하는 구간이에요.',
    },
];

export function SignalTypeGuide() {
    return (
        <section
            className="px-6 py-10 lg:px-[15vw]"
            aria-labelledby="signal-guide-heading"
        >
            <h2
                id="signal-guide-heading"
                className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase"
            >
                신호 유형 가이드
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {ENTRIES.map(e => (
                    <div key={e.term}>
                        <dt className="text-secondary-300 text-sm font-semibold">
                            {e.term}
                        </dt>
                        <dd className="text-secondary-500 text-xs leading-relaxed">
                            {e.desc}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
