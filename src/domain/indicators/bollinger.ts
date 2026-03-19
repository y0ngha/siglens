export type BollingerResult = {
  upper: number;
  middle: number;
  lower: number;
  timestamp: string;
};

export function calculateBollinger(
  closes: number[],
  period = 20,
  stdDev = 2,
): BollingerResult[] {
  // TODO: implement
  void closes;
  void period;
  void stdDev;
  return [];
}