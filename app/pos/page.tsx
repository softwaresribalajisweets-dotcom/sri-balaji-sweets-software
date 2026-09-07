"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Receipt,
  Store,
  Package,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  User,
  Phone,
  CreditCard,
  Banknote,
  QrCode,
  SlidersHorizontal,
  X,
  Printer,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Calculator,
  RefreshCw,
  Clock,
  Calendar,
  Check,
} from "lucide-react";

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber?: string;
  address?: string;
  city?: string;
  isMainBranch?: boolean;
}

interface ItemProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: string;
  barcodeId: string;
  hsnCode?: string;
  gstPercent?: number;
  imageUrl?: string;
}

interface ItemBatch {
  id: string;
  itemId: string;
  itemName?: string;
  itemBarcodeId?: string;
  batchCode: number;
  batchCodeString?: string;
  manufacturedQuantity: number;
  manufacturingDate?: string;
  expiryDate?: string;
  expiryDays?: number;
  unallocatedQuantity?: number;
  storeAllocations?: Array<{
    storeId: string;
    storeName: string;
    quantity: number;
  }>;
  storeReceived?: boolean;
  createdAt?: any;
}

interface CustomerDoc {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  createdAt?: any;
}

interface BatchAllocationItem {
  batchId: string;
  batchCode: number;
  batchCodeString: string;
  availableInStore: number;
  allocatedQty: number;
  expiryDate?: string;
  manufacturingDate?: string;
}

interface CartItem {
  id: string; // unique cart line id
  itemId: string;
  itemName: string;
  barcodeId: string;
  category: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalAmount: number;
  batchAllocations: BatchAllocationItem[];
}

interface SettledSaleDoc {
  id: string;
  billNumber: string;
  storeId: string;
  storeName: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent?: number;
  taxAmount: number;
  grandTotal: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Split";
  splitDetails?: {
    cash: number;
    upi: number;
    card: number;
  };
  cashTendered?: number;
  changeDue?: number;
  createdAt: any;
}

export default function PosBillingPage() {
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Customer State
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDoc | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerMobile, setNewCustomerMobile] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Item Add / Batch Allocation Modal State
  const [activeItemForModal, setActiveItemForModal] = useState<ItemProduct | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number | "">(1);
  const [modalAllocations, setModalAllocations] = useState<BatchAllocationItem[]>([]);

  // Checkout & Payment State
  const [paymentMode, setPaymentMode] = useState<"Cash" | "UPI" | "Card" | "Split">("Cash");
  const [splitCash, setSplitCash] = useState<number | "">("");
  const [splitUpi, setSplitUpi] = useState<number | "">("");
  const [splitCard, setSplitCard] = useState<number | "">("");
  const [cashTendered, setCashTendered] = useState<number | "">("");
  const [settlingBill, setSettlingBill] = useState(false);

  // Completed Receipt Modal State
  const [completedSale, setCompletedSale] = useState<SettledSaleDoc | null>(null);

  // Subscribe to Stores, Items, Batches, and Customers
  useEffect(() => {
    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(qStores, (snapshot) => {
      const list: StoreBranch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StoreBranch);
      });
      setStores(list);
      if (list.length > 0 && !selectedStoreId) {
        const main = list.find((s) => s.isMainBranch) || list[0];
        setSelectedStoreId(main.id);
      }
    });

    const qItems = query(collection(db, "items"), orderBy("name", "asc"));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const list: ItemProduct[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ItemProduct);
      });
      setItems(list);
      setLoading(false);
    });

    const qBatches = query(collection(db, "batches"), orderBy("createdAt", "desc"));
    const unsubBatches = onSnapshot(qBatches, (snapshot) => {
      const list: ItemBatch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ItemBatch);
      });
      setBatches(list);
    });

    const qCustomers = query(collection(db, "customers"), orderBy("name", "asc"));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      const list: CustomerDoc[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CustomerDoc);
      });
      setCustomers(list);
    });

    return () => {
      unsubStores();
      unsubItems();
      unsubBatches();
      unsubCustomers();
    };
  }, []);

  const currentStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Helper: compute total available stock for an item in the currently selected store
  const getItemStoreStock = (itemId: string, barcodeId?: string): number => {
    if (!selectedStoreId) return 0;
    return batches
      .filter((b) => b.itemId === itemId || (barcodeId && b.itemBarcodeId === barcodeId))
      .reduce((sum, b) => {
        const alloc = (b.storeAllocations || []).find((a) => a.storeId === selectedStoreId);
        return sum + (alloc ? Number(alloc.quantity) || 0 : 0);
      }, 0);
  };

  // Helper: get all available store batches for an item sorted FIFO/FEFO
  const getStoreBatchesForItem = (itemId: string, barcodeId?: string): ItemBatch[] => {
    if (!selectedStoreId) return [];
    return batches
      .filter((b) => {
        const matches = b.itemId === itemId || (barcodeId && b.itemBarcodeId === barcodeId);
        if (!matches) return false;
        const alloc = (b.storeAllocations || []).find((a) => a.storeId === selectedStoreId);
        return alloc && Number(alloc.quantity) > 0;
      })
      .sort((a, b) => {
        // Sort by earliest expiry date first (FEFO) or oldest batch code (FIFO)
        if (a.expiryDate && b.expiryDate) {
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        }
        return (Number(a.batchCode) || 0) - (Number(b.batchCode) || 0);
      });
  };

  // Automatic multi-batch allocation function (fills oldest active batch, cascades to next if exceeded)
  const computeAutoBatchAllocation = (
    itemBatches: ItemBatch[],
    qtyNeeded: number
  ): BatchAllocationItem[] => {
    let remaining = qtyNeeded;
    const allocations: BatchAllocationItem[] = [];

    for (const b of itemBatches) {
      if (remaining <= 0) break;
      const alloc = (b.storeAllocations || []).find((a) => a.storeId === selectedStoreId);
      const avail = alloc ? Number(alloc.quantity) || 0 : 0;
      if (avail <= 0) continue;

      const take = Math.min(avail, remaining);
      allocations.push({
        batchId: b.id,
        batchCode: b.batchCode,
        batchCodeString: b.batchCodeString || `Batch #${b.batchCode}`,
        availableInStore: avail,
        allocatedQty: take,
        expiryDate: b.expiryDate,
        manufacturingDate: b.manufacturingDate,
      });
      remaining -= take;
    }

    return allocations;
  };

  // Open modal to add or edit an item
  const handleOpenItemModal = (product: ItemProduct, existingCartItem?: CartItem) => {
    setActiveItemForModal(product);
    const storeBatches = getStoreBatchesForItem(product.id, product.barcodeId);

    if (existingCartItem) {
      setEditingCartItemId(existingCartItem.id);
      setModalQuantity(existingCartItem.totalQuantity);
      setModalAllocations(existingCartItem.batchAllocations);
    } else {
      setEditingCartItemId(null);
      const defaultQty = product.unit?.toLowerCase() === "piece" ? 1 : 0.5;
      setModalQuantity(defaultQty);
      const initialAllocations = computeAutoBatchAllocation(storeBatches, defaultQty);
      setModalAllocations(initialAllocations);
    }
  };

  // When modal quantity changes, automatically re-allocate batches
  const handleModalQuantityChange = (val: number | "") => {
    setModalQuantity(val);
    if (!activeItemForModal || val === "" || Number(val) <= 0) {
      setModalAllocations([]);
      return;
    }
    const storeBatches = getStoreBatchesForItem(
      activeItemForModal.id,
      activeItemForModal.barcodeId
    );
    const updatedAllocations = computeAutoBatchAllocation(storeBatches, Number(val));
    setModalAllocations(updatedAllocations);
  };

  // Save item from modal to cart
  const handleSaveModalToCart = () => {
    if (!activeItemForModal || modalQuantity === "" || Number(modalQuantity) <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const qty = Number(modalQuantity);
    const unitPrice = activeItemForModal.price;
    const totalAmount = Math.round(qty * unitPrice * 100) / 100;

    const cartLine: CartItem = {
      id: editingCartItemId || `${activeItemForModal.id}_${Date.now()}`,
      itemId: activeItemForModal.id,
      itemName: activeItemForModal.name,
      barcodeId: activeItemForModal.barcodeId,
      category: activeItemForModal.category,
      unit: activeItemForModal.unit || "KG",
      unitPrice: unitPrice,
      totalQuantity: qty,
      totalAmount: totalAmount,
      batchAllocations: modalAllocations,
    };

    setCart((prev) => {
      if (editingCartItemId) {
        return prev.map((item) => (item.id === editingCartItemId ? cartLine : item));
      } else {
        return [...prev, cartLine];
      }
    });

    setActiveItemForModal(null);
    setEditingCartItemId(null);
  };

  // Remove item from cart
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== cartItemId));
  };

  // Cart financial calculations
  const cartSubtotal = cart.reduce((sum, it) => sum + it.totalAmount, 0);
  const discountAmount = Math.round(((cartSubtotal * discountPercent) / 100) * 100) / 100;
  const grandTotal = Math.max(0, Math.round(cartSubtotal - discountAmount));

  // Auto-fill split payment defaults
  useEffect(() => {
    if (paymentMode === "Split") {
      setSplitCash("");
      setSplitUpi("");
      setSplitCard("");
    }
  }, [paymentMode]);

  const totalSplitPaid =
    (Number(splitCash) || 0) + (Number(splitUpi) || 0) + (Number(splitCard) || 0);
  const splitRemaining = Math.max(0, grandTotal - totalSplitPaid);

  // Customer search filter
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.mobile.includes(customerSearchQuery)
  );

  // Create new customer
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerMobile.trim()) {
      alert("Please enter customer name and mobile number.");
      return;
    }

    try {
      setSavingCustomer(true);
      const docRef = await addDoc(collection(db, "customers"), {
        name: newCustomerName.trim(),
        mobile: newCustomerMobile.trim(),
        createdAt: serverTimestamp(),
      });

      const created: CustomerDoc = {
        id: docRef.id,
        name: newCustomerName.trim(),
        mobile: newCustomerMobile.trim(),
      };

      setSelectedCustomer(created);
      setIsAddCustomerOpen(false);
      setNewCustomerName("");
      setNewCustomerMobile("");
      setCustomerSearchQuery("");
    } catch (err: any) {
      alert(`Error saving customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  // Settle Bill / Checkout
  const handleSettleBill = async () => {
    if (!currentStore) {
      alert("Please select a store branch.");
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty! Please add items to bill.");
      return;
    }

    if (paymentMode === "Split" && totalSplitPaid !== grandTotal) {
      alert(
        `Split payment total (₹${totalSplitPaid}) does not match grand total (₹${grandTotal}). Balance remaining: ₹${splitRemaining}.`
      );
      return;
    }

    try {
      setSettlingBill(true);
      const billNumber = `INV-${currentStore.name
        .substring(0, 3)
        .toUpperCase()}-${Date.now().toString().slice(-6)}`;

      // 1. Deduct allocated quantities from batches in Firestore
      for (const cartItem of cart) {
        for (const alloc of cartItem.batchAllocations) {
          if (alloc.allocatedQty > 0) {
            const batchDoc = batches.find((b) => b.id === alloc.batchId);
            if (batchDoc) {
              const currentStoreAllocations = batchDoc.storeAllocations || [];
              const updatedAllocations = currentStoreAllocations.map((a) => {
                if (a.storeId === currentStore.id) {
                  return {
                    ...a,
                    quantity: Math.max(0, a.quantity - alloc.allocatedQty),
                  };
                }
                return a;
              });

              const newTotalAllocated = updatedAllocations.reduce(
                (sum, a) => sum + a.quantity,
                0
              );

              await updateDoc(doc(db, "batches", alloc.batchId), {
                storeAllocations: updatedAllocations,
                totalAllocated: newTotalAllocated,
              });
            }
          }
        }
      }

      // 2. Save sale record to store_sales
      const salePayload: any = {
        billNumber,
        storeId: currentStore.id,
        storeName: currentStore.name,
        storeAddress: currentStore.address || "",
        customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        customerMobile: selectedCustomer ? selectedCustomer.mobile : "",
        customerId: selectedCustomer?.id || null,
        items: cart,
        subtotal: cartSubtotal,
        discountAmount: discountAmount,
        discountPercent: discountPercent,
        grandTotal: grandTotal,
        paymentMode: paymentMode,
        createdAt: serverTimestamp(),
      };

      if (paymentMode === "Split") {
        salePayload.splitDetails = {
          cash: Number(splitCash) || 0,
          upi: Number(splitUpi) || 0,
          card: Number(splitCard) || 0,
        };
      }

      if (paymentMode === "Cash" && cashTendered !== "") {
        salePayload.cashTendered = Number(cashTendered);
        salePayload.changeDue = Math.max(0, Number(cashTendered) - grandTotal);
      }

      const saleRef = await addDoc(collection(db, "store_sales"), salePayload);

      // Set completed sale for receipt preview
      setCompletedSale({
        id: saleRef.id,
        ...salePayload,
        createdAt: new Date().toISOString(),
      });

      // Clear cart
      setCart([]);
      setSelectedCustomer(null);
      setDiscountPercent(0);
      setCashTendered("");
    } catch (err: any) {
      console.error("Error settling bill:", err);
      alert(`Error settling bill: ${err.message}`);
    } finally {
      setSettlingBill(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = items.filter((it) => {
    const matchesCategory =
      selectedCategory === "all" || it.category?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.barcodeId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Top Bar: Store Selection, Customer Badge & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-neutral-200/90 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <span>POS Billing & Counter Sale</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                  Live Active
                </span>
              </h1>
              <p className="text-xs text-neutral-500">
                Multi-batch automatic allocation (FIFO/FEFO), split payments, and instant receipt printing
              </p>
            </div>
          </div>

          {/* Store Branch Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-300 shadow-2xs">
              <Store className="w-4 h-4 text-neutral-600" />
              <div className="text-xs">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                  Active Billing Store
                </span>
                <select
                  value={selectedStoreId}
                  onChange={(e) => {
                    if (cart.length > 0) {
                      if (confirm("Changing store will reset the current cart. Continue?")) {
                        setSelectedStoreId(e.target.value);
                        setCart([]);
                      }
                    } else {
                      setSelectedStoreId(e.target.value);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-neutral-900 focus:outline-none cursor-pointer"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isMainBranch ? "⭐ (Main)" : ""} {s.city ? `• ${s.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column POS Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ==================== LEFT PANEL: PRODUCT CATALOG (7 Cols) ==================== */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Category Pills */}
            <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search sweet product name or barcode #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-neutral-900 shadow-2xs"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                    selectedCategory === "all"
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                  }`}
                >
                  All Items ({items.length})
                </button>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? "bg-neutral-900 text-white shadow-xs"
                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const storeStock = getItemStoreStock(p.id, p.barcodeId);
                const hasStock = storeStock > 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleOpenItemModal(p)}
                    className="bg-white border border-neutral-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-neutral-900 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-semibold">
                          #{p.barcodeId}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            hasStock
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {hasStock ? `${storeStock} ${p.unit || "KG"}` : "0 Stock"}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-neutral-900 group-hover:text-blue-600 line-clamp-2 leading-snug">
                        {p.name}
                      </h3>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{p.category}</p>
                    </div>

                    <div className="pt-2.5 mt-2 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-neutral-900">
                        ₹{p.price}{" "}
                        <span className="text-[10px] font-normal text-neutral-500">
                          /{p.unit || "KG"}
                        </span>
                      </span>
                      <span className="p-1 rounded-lg bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ==================== RIGHT PANEL: CART & CHECKOUT (5 Cols) ==================== */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
              {/* Customer Selector Header */}
              <div className="space-y-2 pb-3 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neutral-700" />
                    Customer Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerOpen(true)}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Customer</span>
                  </button>
                </div>

                {/* Selected Customer Pill or Search Input */}
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="text-xs text-blue-950 font-bold block">
                          {selectedCustomer.name}
                        </strong>
                        <span className="text-[10px] font-mono text-blue-700">
                          {selectedCustomer.mobile}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search customer by name or mobile #..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full bg-neutral-50 text-xs text-neutral-900 pl-8 pr-3 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white focus:border-neutral-900"
                      />
                    </div>

                    {customerSearchQuery && (
                      <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100 bg-white shadow-lg">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setCustomerSearchQuery("");
                              }}
                              className="w-full text-left p-2 hover:bg-neutral-50 flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="font-bold text-neutral-900">{c.name}</span>
                              <span className="font-mono text-neutral-500 text-[11px]">
                                {c.mobile}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-2.5 text-center text-xs text-neutral-500 flex items-center justify-between">
                            <span>No customer found.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCustomerMobile(customerSearchQuery);
                                setIsAddCustomerOpen(true);
                              }}
                              className="px-2 py-1 bg-neutral-900 text-white rounded text-[10px] font-bold"
                            >
                              + Add &apos;{customerSearchQuery}&apos;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                  <span>Current Cart ({cart.length} items)</span>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-red-600 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 space-y-2">
                    <ShoppingBag className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-bold text-neutral-700">Cart is Empty</p>
                    <p className="text-[11px] text-neutral-400">
                      Click any sweet product from catalog to allocate batches & add to bill
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 max-h-[280px] overflow-y-auto pr-1">
                    {cart.map((it) => (
                      <div key={it.id} className="py-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-neutral-900 truncate">
                            {it.itemName}
                          </h4>
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            {it.totalQuantity} {it.unit} × ₹{it.unitPrice} ={" "}
                            <strong className="text-neutral-900">₹{it.totalAmount}</strong>
                          </div>

                          {/* Batch breakdown badge */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {it.batchAllocations.map((a) => (
                              <span
                                key={a.batchId}
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-900 font-semibold border border-purple-200"
                              >
                                {a.batchCodeString}: {a.allocatedQty} {it.unit}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const product = items.find((p) => p.id === it.itemId);
                              if (product) handleOpenItemModal(product, it);
                            }}
                            className="p-1 text-neutral-400 hover:text-blue-600 rounded-md hover:bg-neutral-100 cursor-pointer"
                            title="Edit Quantity / Batches"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(it.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded-md hover:bg-neutral-100 cursor-pointer"
                            title="Remove from Cart"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Summary & Financials */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-neutral-900">₹{cartSubtotal}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <span>Discount:</span>
                    <select
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="bg-white border border-neutral-200 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={10}>10%</option>
                      <option value={15}>15%</option>
                    </select>
                  </div>
                  <span className="font-mono text-emerald-700 font-bold">
                    -₹{discountAmount}
                  </span>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-sm">
                  <span className="font-black text-neutral-900">Grand Total:</span>
                  <span className="font-mono font-black text-xl text-neutral-950">
                    ₹{grandTotal}
                  </span>
                </div>
              </div>

              {/* Payment Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-700">
                  Payment Mode:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["Cash", "UPI", "Card", "Split"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paymentMode === mode
                          ? "bg-neutral-900 text-white shadow-xs"
                          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Cash Tendered Calculator */}
                {paymentMode === "Cash" && (
                  <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500 font-medium">
                        Cash Tendered:
                      </span>
                      <input
                        type="number"
                        min={0}
                        placeholder={`₹${grandTotal}`}
                        value={cashTendered}
                        onChange={(e) =>
                          setCashTendered(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-28 bg-white text-xs font-bold font-mono text-neutral-900 p-1.5 rounded-md border border-neutral-300 text-right"
                      />
                    </div>
                    {cashTendered !== "" && Number(cashTendered) >= grandTotal && (
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800 pt-1 border-t border-neutral-200">
                        <span>Change to Return:</span>
                        <span className="font-mono text-sm">
                          ₹{(Number(cashTendered) - grandTotal).toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Split Payment Inputs */}
                {paymentMode === "Split" && (
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5">
                    <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                      Enter Split Amounts (Total: ₹{grandTotal}):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">
                          Cash (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={splitCash}
                          onChange={(e) =>
                            setSplitCash(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="w-full bg-white text-xs font-bold font-mono p-1.5 rounded-lg border border-neutral-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">
                          UPI (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={splitUpi}
                          onChange={(e) =>
                            setSplitUpi(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="w-full bg-white text-xs font-bold font-mono p-1.5 rounded-lg border border-neutral-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-neutral-600 block mb-0.5">
                          Card (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={splitCard}
                          onChange={(e) =>
                            setSplitCard(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="w-full bg-white text-xs font-bold font-mono p-1.5 rounded-lg border border-neutral-300"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200">
                      <span>Total Split: <strong className="font-mono">₹{totalSplitPaid}</strong></span>
                      <span
                        className={`font-mono font-bold ${
                          splitRemaining === 0 ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {splitRemaining === 0 ? "✓ Exact Match" : `Remaining: ₹${splitRemaining}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Settle Bill Button */}
              <button
                type="button"
                onClick={handleSettleBill}
                disabled={settlingBill || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {settlingBill
                    ? "Settling Bill..."
                    : `Settle Bill & Print (₹${grandTotal})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ITEM CLICK MODAL: QUANTITY & AUTO-BATCH ALLOCATION             */}
        {/* ============================================================== */}
        {activeItemForModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <span>{activeItemForModal.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-200 text-neutral-800 font-mono">
                      #{activeItemForModal.barcodeId}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Rate: ₹{activeItemForModal.price}/{activeItemForModal.unit || "KG"} • Available in store:{" "}
                    <strong>
                      {getItemStoreStock(activeItemForModal.id, activeItemForModal.barcodeId)}{" "}
                      {activeItemForModal.unit || "KG"}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveItemForModal(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* 1. Enter Quantity */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Enter Sale Quantity ({activeItemForModal.unit || "KG"}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.05}
                      step="any"
                      required
                      value={modalQuantity}
                      onChange={(e) =>
                        handleModalQuantityChange(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="w-full bg-white text-base font-bold font-mono text-neutral-900 p-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                      placeholder="e.g. 10"
                    />
                    <span className="font-bold text-neutral-500 text-sm shrink-0 px-2">
                      {activeItemForModal.unit || "KG"}
                    </span>
                  </div>

                  {/* Quick Quantity Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0.25, 0.5, 1, 2, 5, 10].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleModalQuantityChange(q)}
                        className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg border transition ${
                          modalQuantity === q
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200"
                        }`}
                      >
                        {q} {activeItemForModal.unit || "KG"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Automatic Multi-Batch Allocation Breakdown */}
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-purple-700" />
                      Automatic Multi-Batch Allocation (FIFO/FEFO)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold border border-purple-200">
                      Auto-Cascades
                    </span>
                  </div>

                  {modalAllocations.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                      No active batches found in <strong>{currentStore?.name}</strong> for this item.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {modalAllocations.map((a, idx) => (
                        <div
                          key={a.batchId}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-neutral-200 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="font-mono font-bold text-neutral-900">
                                {a.batchCodeString}
                              </strong>
                              {idx === 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                                  Primary (Earliest)
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-500 block">
                              Avail: {a.availableInStore} {activeItemForModal.unit} • Exp: {a.expiryDate || "N/A"}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-purple-950 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                              {a.allocatedQty} {activeItemForModal.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Allocation total vs requested warning */}
                  {modalQuantity !== "" &&
                    Number(modalQuantity) >
                      modalAllocations.reduce((acc, a) => acc + a.allocatedQty, 0) && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>
                          Requested {modalQuantity} {activeItemForModal.unit}, but only{" "}
                          {modalAllocations.reduce((acc, a) => acc + a.allocatedQty, 0)}{" "}
                          {activeItemForModal.unit} available in store batches.
                        </span>
                      </div>
                    )}
                </div>

                {/* Subtotal Preview */}
                <div className="flex items-center justify-between p-3 bg-neutral-900 text-white rounded-xl">
                  <span className="text-xs font-medium">Item Sale Total:</span>
                  <span className="font-mono font-bold text-base">
                    ₹{((Number(modalQuantity) || 0) * activeItemForModal.price).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setActiveItemForModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalToCart}
                  className="flex items-center gap-1.5 px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save to Cart</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADD CUSTOMER MODAL                                             */}
        {/* ============================================================== */}
        {isAddCustomerOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Add New Customer</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="text-neutral-400 hover:text-neutral-800 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewCustomer} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newCustomerMobile}
                    onChange={(e) => setNewCustomerMobile(e.target.value)}
                    className="w-full bg-white text-xs font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerOpen(false)}
                    className="px-3 py-2 text-neutral-600 hover:text-neutral-900 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCustomer}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    {savingCustomer ? "Saving..." : "Save & Select"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* COMPLETED SALE RECEIPT MODAL                                   */}
        {/* ============================================================== */}
        {completedSale && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-neutral-900">
                    Bill Settled - {completedSale.billNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thermal Bill Receipt Content */}
              <div className="p-6 overflow-y-auto font-mono text-xs text-neutral-900 space-y-3 bg-neutral-50/50">
                <div className="text-center pb-2 border-b border-dashed border-neutral-300">
                  <h2 className="text-sm font-black uppercase">SRI BALAJI SWEETS</h2>
                  <p className="text-[10px] text-neutral-500">{completedSale.storeName}</p>
                  <p className="text-[10px] text-neutral-400">
                    Bill #{completedSale.billNumber} • {new Date().toLocaleDateString()}{" "}
                    {new Date().toLocaleTimeString()}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Customer: {completedSale.customerName}{" "}
                    {completedSale.customerMobile ? `(${completedSale.customerMobile})` : ""}
                  </p>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 py-1 text-[11px]">
                  {completedSale.items.map((it, idx) => (
                    <div key={idx} className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold truncate">{it.itemName}</div>
                        <div className="text-[10px] text-neutral-500">
                          {it.totalQuantity} {it.unit} × ₹{it.unitPrice}
                          {it.batchAllocations.length > 0 && (
                            <span className="ml-1 text-purple-800">
                              (
                              {it.batchAllocations
                                .map((b) => `${b.batchCodeString}`)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold shrink-0">₹{it.totalAmount}</span>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-2 border-t border-dashed border-neutral-300 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{completedSale.subtotal}</span>
                  </div>
                  {completedSale.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({completedSale.discountPercent}%):</span>
                      <span>-₹{completedSale.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-neutral-300">
                    <span>Grand Total:</span>
                    <span>₹{completedSale.grandTotal}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-600 pt-1">
                    <span>Payment Mode:</span>
                    <span className="font-bold">{completedSale.paymentMode}</span>
                  </div>
                </div>

                <div className="text-center pt-3 border-t border-dashed border-neutral-300 text-[10px] text-neutral-400">
                  Thank You for visiting Sri Balaji Sweets!
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-neutral-100 bg-white flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Thermal Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Start New Sale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
