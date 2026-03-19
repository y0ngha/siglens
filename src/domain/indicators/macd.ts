export type MACDResult = {
  macd: number;
  signal: number;
  histogram: number;
  timestamp: string;
};

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult[] {
  // TODO: implement
  void closes;
  void fastPeriod;
  void slowPeriod;
  void signalPeriod;
  return [];
}