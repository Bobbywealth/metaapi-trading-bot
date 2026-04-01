export interface Position {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
}

export interface Order {
  id: string;
  symbol: string;
  type: 'buylimit' | 'selllimit' | 'buystop' | 'sellstop' | 'buymarket' | 'sellmarket';
  volume: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  createdAt: string;
  filledAt?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  openTime: string;
  closeTime: string;
  strategy?: string;
  tags?: string[];
  notes?: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'trend' | 'mean_reversion' | 'breakout' | 'scalping' | 'custom';
  indicators: IndicatorConfig[];
  conditions: Condition[];
  riskManagement: RiskManagement;
  enabled: boolean;
  lastRun?: string;
  performance?: StrategyPerformance;
}

export interface IndicatorConfig {
  type: 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'atr' | 'stochastic' | 'adx';
  params: Record<string, number>;
  source: 'close' | 'open' | 'high' | 'low' | 'volume';
}

export interface Condition {
  indicator: string;
  operator: '>' | '<' | '>=' | '<=' | 'crosses_above' | 'crosses_below' | '==';
  value: number | string;
  logic?: 'and' | 'or';
}

export interface RiskManagement {
  stopLoss: number;
  takeProfit: number;
  maxPositions: number;
  maxDrawdown: number;
  riskPerTrade: number;
}

export interface StrategyPerformance {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalProfit: number;
  averageWin: number;
  averageLoss: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  impact: 'high' | 'medium' | 'low';
  category: 'earnings' | 'economic' | 'political' | 'technical' | 'general';
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface BacktestResult {
  strategyId: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  trades: BacktestTrade[];
  equityCurve: { time: string; equity: number }[];
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: 'trade' | 'order' | 'rebalance' | 'alert';
  schedule: string; // cron expression
  params: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'error';
}

export interface Alert {
  id: string;
  symbol: string;
  condition: 'price_above' | 'price_below' | 'percent_change' | 'volume_spike';
  value: number;
  message: string;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}
