import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import type { Toast, ConfirmConfig, Position, Order, Trade, Strategy, NewsItem } from './types';

interface StoreState {
  // Connection
  socket: Socket | null;
  isConnected: boolean;
  
  // User & Auth
  user: { id: string; email: string; name: string } | null;
  token: string | null;
  
  // Trading Data
  positions: Position[];
  orders: Order[];
  tradeHistory: Trade[];
  account: {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    unrealizedPnl: number;
  };
  
  // Market Data
  prices: Record<string, { bid: number; ask: number; change: number }>;
  candles: Record<string, { time: number; open: number; high: number; low: number; close: number; volume: number }[]>;
  
  // Strategies
  strategies: Strategy[];
  activeStrategy: string | null;
  
  // News
  news: NewsItem[];
  sentiment: Record<string, number>;
  
  // UI State
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  toasts: Toast[];
  confirmModal: ConfirmConfig | null;
  
  // Actions
  initialize: () => void;
  connect: (token: string) => void;
  disconnect: () => void;
  
  setUser: (user: { id: string; email: string; name: string } | null) => void;
  setToken: (token: string | null) => void;
  
  setPositions: (positions: Position[]) => void;
  setOrders: (orders: Order[]) => void;
  setTradeHistory: (history: Trade[]) => void;
  setAccount: (account: StoreState['account']) => void;
  
  updatePrice: (symbol: string, price: { bid: number; ask: number; change: number }) => void;
  setCandles: (symbol: string, candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]) => void;
  
  setStrategies: (strategies: Strategy[]) => void;
  setActiveStrategy: (id: string | null) => void;
  
  setNews: (news: NewsItem[]) => void;
  setSentiment: (symbol: string, sentiment: number) => void;
  
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  showConfirm: (config: ConfirmConfig) => void;
  hideConfirm: () => void;
  
  setTheme: (theme: 'dark' | 'light') => void;
}

let socketInstance: Socket | null = null;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial State
      socket: null,
      isConnected: false,
      
      user: null,
      token: null,
      
      positions: [],
      orders: [],
      tradeHistory: [],
      account: {
        balance: 0,
        equity: 0,
        margin: 0,
        freeMargin: 0,
        unrealizedPnl: 0,
      },
      
      prices: {},
      candles: {},
      
      strategies: [],
      activeStrategy: null,
      
      news: [],
      sentiment: {},
      
      theme: 'dark',
      sidebarOpen: false,
      toasts: [],
      confirmModal: null,
      
      // Actions
      initialize: () => {
        const token = get().token;
        if (token) {
          get().connect(token);
        }
      },
      
      connect: (token: string) => {
        if (socketInstance) {
          socketInstance.disconnect();
        }
        
        const socket = io('/', {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        
        socket.on('connect', () => {
          set({ isConnected: true, socket });
        });
        
        socket.on('disconnect', () => {
          set({ isConnected: false });
        });
        
        socket.on('price', (data: { symbol: string; bid: number; ask: number; change: number }) => {
          get().updatePrice(data.symbol, { bid: data.bid, ask: data.ask, change: data.change });
        });
        
        socket.on('position', (data: Position[]) => {
          set({ positions: data });
        });
        
        socket.on('account', (data: StoreState['account']) => {
          set({ account: data });
        });
        
        socket.on('order', (data: Order[]) => {
          set({ orders: data });
        });
        
        socket.on('news', (data: NewsItem[]) => {
          set({ news: data });
        });
        
        socketInstance = socket;
        set({ socket, token });
      },
      
      disconnect: () => {
        if (socketInstance) {
          socketInstance.disconnect();
          socketInstance = null;
        }
        set({ socket: null, isConnected: false, token: null, user: null });
      },
      
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      
      setPositions: (positions) => set({ positions }),
      setOrders: (orders) => set({ orders }),
      setTradeHistory: (tradeHistory) => set({ tradeHistory }),
      setAccount: (account) => set({ account }),
      
      updatePrice: (symbol, price) => set((state) => ({
        prices: { ...state.prices, [symbol]: price },
      })),
      
      setCandles: (symbol, candles) => set((state) => ({
        candles: { ...state.candles, [symbol]: candles },
      })),
      
      setStrategies: (strategies) => set({ strategies }),
      setActiveStrategy: (id) => set({ activeStrategy: id }),
      
      setNews: (news) => set({ news }),
      setSentiment: (symbol, sentiment) => set((state) => ({
        sentiment: { ...state.sentiment, [symbol]: sentiment },
      })),
      
      addToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 4000);
      },
      
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
      
      showConfirm: (config) => set({ confirmModal: config }),
      hideConfirm: () => set({ confirmModal: null }),
      
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ai-trading-station-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        theme: state.theme,
      }),
    }
  )
);
