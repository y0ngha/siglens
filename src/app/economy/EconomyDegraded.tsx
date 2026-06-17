/**
 * /economy degrade UI — 전 축이 비어 있어 의미 있는 정보를 노출할 수 없을 때 200 + noindex로
 * 보여주는 안내. financials `FinancialsDegraded`와 동일 패턴.
 */
export function EconomyDegraded() {
    return (
        <main className="flex-1">
            <h1 className="text-secondary-100 px-6 pt-10 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:px-[15vw]">
                미국 경제 — 지표·캘린더 한눈에
            </h1>
            <section className="border-secondary-700 bg-secondary-800 mx-6 my-8 rounded-xl border p-6 lg:mx-[15vw]">
                <h2 className="text-secondary-100 mb-3 text-lg font-semibold">
                    잠시 후 다시 시도해 주세요
                </h2>
                <p className="text-secondary-300 text-sm leading-relaxed">
                    현재 미국 거시 경제 데이터를 불러오지 못했어요. 지표
                    제공처에 일시적인 문제가 있을 수 있어요. 잠시 후 다시 방문해
                    주세요.
                </p>
            </section>
        </main>
    );
}
