import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  cart: [],
  resumingOrderId: null,
  originalOrderMetadata: null,

  setResumingOrderId: (id, metadata = null) => set({ resumingOrderId: id, originalOrderMetadata: metadata }),

  addToCart: (product) => {
    set((state) => {
      // Find item with same ID, variation, AND same selectedAddons
      const existingItem = state.cart.find((item) =>
        item.id === product.id &&
        item.variation_id === product.variation_id &&
        JSON.stringify(item.selectedAddons || []) === JSON.stringify(product.selectedAddons || [])
      );

      if (existingItem) {
        return {
          cart: state.cart.map((item) =>
            item.cartItemId === existingItem.cartItemId
              ? { ...item, quantity: item.quantity + (product.quantity || 1), total: (item.quantity + (product.quantity || 1)) * item.price }
              : item
          ),
        };
      }

      // Generate unique ID for this cart line
      const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        cart: [...state.cart, {
          ...product,
          cartItemId,
          quantity: product.quantity || 1,
          basePrice: product.basePrice || product.price,
          price: product.price,
          selectedAddons: product.selectedAddons || [],
          regular_price: product.regular_price || product.price,
          total: (product.quantity || 1) * product.price
        }],
      };
    });
  },

  removeFromCart: (cartItemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.cartItemId !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, quantity) => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, quantity, total: quantity * item.price }
          : item
      ),
    }));
  },

  updatePrice: (cartItemId, newPrice) => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, price: parseFloat(newPrice) || 0, total: item.quantity * (parseFloat(newPrice) || 0) }
          : item
      ),
    }));
  },

  updateItemDetails: (cartItemId, updates) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.cartItemId === cartItemId) {
          const newItem = { ...item, ...updates };
          // Recalculate total whenever price or quantity changes
          newItem.total = newItem.quantity * newItem.price;
          return newItem;
        }
        return item;
      }),
    }));
  },

  setCart: (items) => set({ cart: items }),

  clearCart: () => set({ cart: [], resumingOrderId: null, originalOrderMetadata: null }),

  getCartTotal: () => {
    const state = get();
    return state.cart.reduce((total, item) => total + item.total, 0);
  },
}));
