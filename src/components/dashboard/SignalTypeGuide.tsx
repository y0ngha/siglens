const ENTRIES = [
    { term: '골든크로스', desc: '단기 이동평균선이 장기 이동평균선을 상향 교차. 상승 추세 진입의 대표적 신호.' },
    { term: '데드크로스', desc: '단기 이동평균선이 장기 이동평균선을 하향 교차. 하락 추세 진입의 대표적 신호.' },
    { term: 'RSI 과매도/과매수', desc: 'RSI 지표가 30 미만(과매도) 또는 70 초과(과매수)일 때. 반등 혹은 조정 가능성.' },
    { term: '볼린저 하단 반등 / 상단 돌파', desc: '가격이 볼린저 하단 터치 후 반등 / 상단 돌파. 추세 지속 또는 과열 신호.' },
    { term: 'RSI 다이버전스', desc: '가격은 새로운 극값을 만드는데 RSI가 따라가지 못함. 추세 전환 전조.' },
    { term: 'MACD 히스토그램 수렴', desc: 'MACD 히스토그램의 크기가 연속 감소. 교차 임박 신호.' },
    { term: '볼린저 스퀴즈', desc: '볼린저 밴드 폭이 최근 6개월 최저 수준으로 축소. 방향성 돌파 임박.' },
    { term: '지지선/저항선 근접', desc: '가격이 MA50 또는 MA200에 근접하면서 반등 혹은 반락 여부를 관찰할 구간.' },
];

export function SignalTypeGuide() {
    return (
        <section className="px-6 py-10 lg:px-[15vw]" aria-labelledby="signal-guide-heading">
            <h2
                id="signal-guide-heading"
                className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase"
            >
                신호 유형 가이드
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {ENTRIES.map(e => (
                    <div key={e.term}>
                        <dt className="text-secondary-300 text-sm font-semibold">{e.term}</dt>
                        <dd className="text-secondary-500 text-xs leading-relaxed">{e.desc}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
