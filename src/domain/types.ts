export type Bar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';