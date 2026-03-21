import { create } from "zustand";

export interface CartItem {
  listingId: string;
  quantity: number;
}

interface ShopCartStore {
  items: CartItem[];
  addItem: (listingId: string) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, qty: number) => void;
  clearCart: () => void;
}

export const useShopCartStore = create<ShopCartStore>((set) => ({
  items: [],

  addItem: (listingId) =>
    set((s) => {
      const existing = s.items.find((i) => i.listingId === listingId);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.listingId === listingId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        };
      }
      return { items: [...s.items, { listingId, quantity: 1 }] };
    }),

  removeItem: (listingId) =>
    set((s) => ({
      items: s.items.filter((i) => i.listingId !== listingId),
    })),

  updateQuantity: (listingId, qty) =>
    set((s) => {
      if (qty <= 0) {
        return { items: s.items.filter((i) => i.listingId !== listingId) };
      }
      return {
        items: s.items.map((i) =>
          i.listingId === listingId ? { ...i, quantity: qty } : i,
        ),
      };
    }),

  clearCart: () => set({ items: [] }),
}));
