"use client";

import React, { useState, useEffect, useMemo } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  ShoppingBag,
  Store,
  Calendar,
  Search,
  Filter,
  Receipt,
  Printer,
  X,
  CreditCard,
  Banknote,
  QrCode,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Phone,
  User,
  Package,
  Layers,
} from "lucide-react";

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber?: string;
  address?: string;
  city?: string;
  isMainBranch?: boolean;
}

interface CartItem {
  id: string;
  itemId: string;
  itemName: string;
  barcodeId: string;
  category: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalAmount: number;
  batchAllocations?: Array<{
    batchId: string;
    batchCode: number;
    batchCodeString: string;
    allocatedQty: number;
  }>;
}

interface StoreSaleRecord {
  id: string;
  billNumber: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  customerName: string;
  customerMobile?: string;
  customerId?: string | null;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
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

type DateFilterType = "all" | "today" | "yesterday" | "week" | "month" | "custom";

export default function WalkInSalesPage() {
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [sales, setSales] = useState<StoreSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<StoreSaleRecord | null>(null);

  // 1. Fetch stores
  useEffect(() => {
    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsub = onSnapshot(qStores, (snap) => {
      const list: StoreBranch[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as StoreBranch));
      setStores(list);
      if (list.length > 0 && !selectedStoreId) {
        // Default to main branch or first store
        const main = list.find((s) => s.isMainBranch) || list[0];
        setSelectedStoreId(main.id);
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch sales for selected store
  useEffect(() => {
    if (!selectedStoreId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Realtime query for sales in this store
    const qSales = query(
      collection(db, "store_sales"),
      where("storeId", "==", selectedStoreId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qSales,
      (snap) => {
        const list: StoreSaleRecord[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as StoreSaleRecord);
        });
        setSales(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching store sales:", err);
        // Fallback without orderBy in case index is pending
        const qFallback = query(
          collection(db, "store_sales"),
          where("storeId", "==", selectedStoreId)
        );
        onSnapshot(qFallback, (fallbackSnap) => {
          const list: StoreSaleRecord[] = [];
          fallbackSnap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as StoreSaleRecord);
          });
          // Sort client-side
          list.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
          });
          setSales(list);
          setLoading(false);
        });
      }
    );

    return () => unsub();
  }, [selectedStoreId]);

  const currentStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId);
  }, [stores, selectedStoreId]);

  // Helper to parse date
  const getSaleDate = (sale: StoreSaleRecord): Date => {
    if (!sale.createdAt) return new Date(0);
    if (sale.createdAt.toDate) return sale.createdAt.toDate();
    if (typeof sale.createdAt === "string") return new Date(sale.createdAt);
    if (sale.createdAt.seconds) return new Date(sale.createdAt.seconds * 1000);
    return new Date(0);
  };

  // Filter sales
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const yesterdayEnd = todayStart - 1;

    const oneWeekAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return sales.filter((sale) => {
      // Payment mode filter
      if (paymentModeFilter !== "all" && sale.paymentMode !== paymentModeFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesBill = sale.billNumber?.toLowerCase().includes(queryLower);
        const matchesCust = sale.customerName?.toLowerCase().includes(queryLower);
        const matchesMobile = sale.customerMobile?.includes(queryLower);
        const matchesItem = sale.items?.some((it) =>
          it.itemName.toLowerCase().includes(queryLower)
        );

        if (!matchesBill && !matchesCust && !matchesMobile && !matchesItem) {
          return false;
        }
      }

      // Date filter
      const saleTime = getSaleDate(sale).getTime();
      if (dateFilter === "today") {
        return saleTime >= todayStart && saleTime <= todayEnd;
      } else if (dateFilter === "yesterday") {
        return saleTime >= yesterdayStart && saleTime <= yesterdayEnd;
      } else if (dateFilter === "week") {
        return saleTime >= oneWeekAgo;
      } else if (dateFilter === "month") {
        return saleTime >= startOfMonth;
      } else if (dateFilter === "custom") {
        if (customStartDate) {
          const cStart = new Date(customStartDate).getTime();
          if (saleTime < cStart) return false;
        }
        if (customEndDate) {
          const cEnd = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          if (saleTime > cEnd) return false;
        }
      }

      return true;
    });
  }, [sales, paymentModeFilter, searchQuery, dateFilter, customStartDate, customEndDate]);

  // Analytics computed from filtered sales and store totals
  const analytics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    let todayRev = 0;
    let todayOrdersCount = 0;
    let totalStoreRev = 0;

    let filteredRev = 0;
    let cashSum = 0;
    let upiSum = 0;
    let cardSum = 0;
    let splitSum = 0;

    let cashCount = 0;
    let upiCount = 0;
    let cardCount = 0;
    let splitCount = 0;

    // All sales for store (for all-time & today KPIs)
    sales.forEach((s) => {
      const t = getSaleDate(s).getTime();
      const amount = s.grandTotal || 0;
      totalStoreRev += amount;
      if (t >= todayStart && t <= todayEnd) {
        todayRev += amount;
        todayOrdersCount++;
      }
    });

    // Breakdown for currently filtered range
    filteredSales.forEach((s) => {
      const amount = s.grandTotal || 0;
      filteredRev += amount;

      if (s.paymentMode === "Cash") {
        cashSum += amount;
        cashCount++;
      } else if (s.paymentMode === "UPI") {
        upiSum += amount;
        upiCount++;
      } else if (s.paymentMode === "Card") {
        cardSum += amount;
        cardCount++;
      } else if (s.paymentMode === "Split") {
        splitSum += amount;
        splitCount++;
        // If splitDetails present, attribute proportionally to channels as well
        if (s.splitDetails) {
          cashSum += s.splitDetails.cash || 0;
          upiSum += s.splitDetails.upi || 0;
          cardSum += s.splitDetails.card || 0;
        }
      }
    });

    const avgOrderValue =
      filteredSales.length > 0 ? Math.round(filteredRev / filteredSales.length) : 0;

    return {
      todayRev,
      todayOrdersCount,
      totalStoreRev,
      totalStoreOrders: sales.length,
      filteredRev,
      filteredOrders: filteredSales.length,
      avgOrderValue,
      cashSum,
      upiSum,
      cardSum,
      splitSum,
      cashCount,
      upiCount,
      cardCount,
      splitCount,
    };
  }, [sales, filteredSales]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header: Title, Live Status & Store Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-white border border-neutral-200/90 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500 text-white shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                  Walk-in Sales & Store Analytics
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                  Real-time
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Monitor counter receipts, sales throughput, and thermal invoices by branch
              </p>
            </div>
          </div>

          {/* Store Branch Switcher */}
          <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200/90 rounded-xl p-2 px-3 self-start lg:self-auto">
            <Store className="w-4 h-4 text-neutral-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider">
                Active Branch
              </span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="text-xs font-bold text-neutral-900 bg-transparent border-none outline-none focus:ring-0 cursor-pointer pr-4"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isMainBranch ? "(Main Branch)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Analytics KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Sales */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Today&apos;s Revenue
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-neutral-900 tracking-tight">
                ₹{analytics.todayRev.toLocaleString("en-IN")}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500">
                <span className="font-bold text-emerald-600">
                  {analytics.todayOrdersCount} orders
                </span>{" "}
                completed today
              </div>
            </div>
          </div>

          {/* Card 2: Filtered Total Revenue */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-neutral-400 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {dateFilter === "all"
                  ? "All-Time Revenue"
                  : dateFilter === "today"
                  ? "Today Selected"
                  : "Period Revenue"}
              </span>
              <div className="p-2 rounded-xl bg-neutral-100 text-neutral-700 border border-neutral-200">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-neutral-900 tracking-tight">
                ₹{analytics.filteredRev.toLocaleString("en-IN")}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500">
                <span className="font-bold text-neutral-800">
                  {analytics.filteredOrders} bills
                </span>{" "}
                in this period
              </div>
            </div>
          </div>

          {/* Card 3: Average Order Value */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Average Bill Value
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-neutral-900 tracking-tight">
                ₹{analytics.avgOrderValue.toLocaleString("en-IN")}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500">
                <span>Total store bills: </span>
                <span className="font-bold text-neutral-800">
                  {analytics.totalStoreOrders}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Channel Split Summary */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Payment Mix
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <QrCode className="w-4 h-4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center mt-2">
              <div className="p-1.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <div className="text-[10px] font-bold text-emerald-800">UPI</div>
                <div className="text-xs font-black text-emerald-950">
                  ₹{analytics.upiSum >= 1000 ? `${(analytics.upiSum / 1000).toFixed(1)}k` : analytics.upiSum}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-amber-50/60 border border-amber-100">
                <div className="text-[10px] font-bold text-amber-800">Cash</div>
                <div className="text-xs font-black text-amber-950">
                  ₹{analytics.cashSum >= 1000 ? `${(analytics.cashSum / 1000).toFixed(1)}k` : analytics.cashSum}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-blue-50/60 border border-blue-100">
                <div className="text-[10px] font-bold text-blue-800">Card</div>
                <div className="text-xs font-black text-blue-950">
                  ₹{analytics.cardSum >= 1000 ? `${(analytics.cardSum / 1000).toFixed(1)}k` : analytics.cardSum}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Bill #, Customer Name, Phone, or Item..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter Tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl overflow-x-auto text-xs font-semibold">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "week", label: "This Week" },
                  { id: "month", label: "This Month" },
                  { id: "all", label: "All Time" },
                  { id: "custom", label: "Custom" },
                ] as { id: DateFilterType; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDateFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    dateFilter === tab.id
                      ? "bg-white text-neutral-900 shadow-xs font-bold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Payment Mode Filter */}
            <div className="flex items-center gap-2">
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
              >
                <option value="all">All Payment Modes</option>
                <option value="Cash">Cash Only</option>
                <option value="UPI">UPI Only</option>
                <option value="Card">Card Only</option>
                <option value="Split">Split Payments</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Picker (shown when custom is selected) */}
          {dateFilter === "custom" && (
            <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-neutral-600">From Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-neutral-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <span className="font-semibold text-neutral-600">To Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-neutral-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-neutral-900"
              />
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                >
                  Reset Dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sales Table */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 px-6 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-neutral-600" />
              <h2 className="text-sm font-bold text-neutral-900">
                Sales Transactions ({filteredSales.length})
              </h2>
            </div>
            <span className="text-xs text-neutral-400">
              Showing receipts for {currentStore?.name || "Selected Branch"}
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-3 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-neutral-500">Loading store transactions...</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-neutral-700">No Sales Records Found</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                No billing transactions match the selected criteria or branch. Create new bills
                from POS Billing to view them here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-100 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Bill #</th>
                    <th className="py-3 px-5">Date & Time</th>
                    <th className="py-3 px-5">Customer</th>
                    <th className="py-3 px-5">Items Summary</th>
                    <th className="py-3 px-5">Payment Mode</th>
                    <th className="py-3 px-5 text-right">Grand Total</th>
                    <th className="py-3 px-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSales.map((sale) => {
                    const saleDate = getSaleDate(sale);
                    const formattedDate =
                      saleDate.getTime() > 0
                        ? saleDate.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A";
                    const formattedTime =
                      saleDate.getTime() > 0
                        ? saleDate.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                    const totalItemsCount = sale.items?.reduce(
                      (sum, it) => sum + (it.totalQuantity || 1),
                      0
                    );

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-neutral-50/60 transition-colors group"
                      >
                        {/* Bill Number */}
                        <td className="py-3.5 px-5 font-mono font-bold text-neutral-900">
                          <span className="px-2 py-1 bg-neutral-100 rounded-md border border-neutral-200">
                            {sale.billNumber}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-5 text-neutral-600">
                          <div className="font-semibold text-neutral-800">{formattedDate}</div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formattedTime}</span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{sale.customerName || "Walk-in Customer"}</span>
                          </div>
                          {sale.customerMobile && (
                            <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-neutral-400" />
                              <span>{sale.customerMobile}</span>
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-neutral-800">
                            {sale.items?.length || 0} product(s)
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate max-w-xs">
                            {sale.items?.map((it) => it.itemName).join(", ") || "—"}
                          </div>
                        </td>

                        {/* Payment Mode */}
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              sale.paymentMode === "UPI"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : sale.paymentMode === "Cash"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : sale.paymentMode === "Card"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}
                          >
                            {sale.paymentMode === "UPI" && <QrCode className="w-3 h-3" />}
                            {sale.paymentMode === "Cash" && <Banknote className="w-3 h-3" />}
                            {sale.paymentMode === "Card" && <CreditCard className="w-3 h-3" />}
                            {sale.paymentMode === "Split" && <Layers className="w-3 h-3" />}
                            <span>{sale.paymentMode}</span>
                          </span>
                          {sale.paymentMode === "Split" && sale.splitDetails && (
                            <div className="text-[9px] text-neutral-400 mt-1 space-x-1">
                              {sale.splitDetails.cash > 0 && <span>C: ₹{sale.splitDetails.cash}</span>}
                              {sale.splitDetails.upi > 0 && <span>U: ₹{sale.splitDetails.upi}</span>}
                              {sale.splitDetails.card > 0 && <span>D: ₹{sale.splitDetails.card}</span>}
                            </div>
                          )}
                        </td>

                        {/* Grand Total */}
                        <td className="py-3.5 px-5 text-right font-black text-neutral-900 text-sm">
                          ₹{sale.grandTotal?.toLocaleString("en-IN")}
                          {sale.discountAmount > 0 && (
                            <div className="text-[10px] font-medium text-emerald-600">
                              -₹{sale.discountAmount} ({sale.discountPercent}%)
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(sale)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>View Slip</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* REPRINT / VIEW RECEIPT MODAL */}
        {activeReceipt && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-neutral-700" />
                  <h3 className="text-sm font-bold text-neutral-900">
                    Thermal Bill - {activeReceipt.billNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thermal Slip Content */}
              <div className="p-6 overflow-y-auto font-mono text-xs text-neutral-900 space-y-3 bg-neutral-50/50">
                <div className="text-center pb-2 border-b border-dashed border-neutral-300">
                  <h2 className="text-sm font-black uppercase tracking-tight">SRI BALAJI SWEETS</h2>
                  <p className="text-[10px] text-neutral-600 font-bold">{activeReceipt.storeName}</p>
                  {activeReceipt.storeAddress && (
                    <p className="text-[9px] text-neutral-500">{activeReceipt.storeAddress}</p>
                  )}
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Bill #{activeReceipt.billNumber} •{" "}
                    {getSaleDate(activeReceipt).toLocaleDateString("en-IN")}{" "}
                    {getSaleDate(activeReceipt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Customer: {activeReceipt.customerName}{" "}
                    {activeReceipt.customerMobile ? `(${activeReceipt.customerMobile})` : ""}
                  </p>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 py-1 text-[11px]">
                  {activeReceipt.items?.map((it, idx) => (
                    <div key={idx} className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold truncate">{it.itemName}</div>
                        <div className="text-[10px] text-neutral-500">
                          {it.totalQuantity} {it.unit} × ₹{it.unitPrice}
                          {it.batchAllocations && it.batchAllocations.length > 0 && (
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

                {/* Financial Totals */}
                <div className="pt-2 border-t border-dashed border-neutral-300 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{activeReceipt.subtotal}</span>
                  </div>
                  {activeReceipt.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({activeReceipt.discountPercent}%):</span>
                      <span>-₹{activeReceipt.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-neutral-300">
                    <span>Grand Total:</span>
                    <span>₹{activeReceipt.grandTotal}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-600 pt-1">
                    <span>Payment Mode:</span>
                    <span className="font-bold">{activeReceipt.paymentMode}</span>
                  </div>
                  {activeReceipt.paymentMode === "Split" && activeReceipt.splitDetails && (
                    <div className="text-[10px] text-neutral-500 pl-2 space-y-0.5 pt-0.5">
                      {activeReceipt.splitDetails.cash > 0 && (
                        <div className="flex justify-between">
                          <span>Cash:</span>
                          <span>₹{activeReceipt.splitDetails.cash}</span>
                        </div>
                      )}
                      {activeReceipt.splitDetails.upi > 0 && (
                        <div className="flex justify-between">
                          <span>UPI:</span>
                          <span>₹{activeReceipt.splitDetails.upi}</span>
                        </div>
                      )}
                      {activeReceipt.splitDetails.card > 0 && (
                        <div className="flex justify-between">
                          <span>Card:</span>
                          <span>₹{activeReceipt.splitDetails.card}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {activeReceipt.paymentMode === "Cash" && activeReceipt.cashTendered && (
                    <div className="text-[10px] text-neutral-500 space-y-0.5 pt-0.5">
                      <div className="flex justify-between">
                        <span>Cash Tendered:</span>
                        <span>₹{activeReceipt.cashTendered}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Change Due:</span>
                        <span>₹{activeReceipt.changeDue || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center pt-3 border-t border-dashed border-neutral-300 text-[10px] text-neutral-400">
                  Thank You for visiting Sri Balaji Sweets!
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 px-6 border-t border-neutral-100 bg-white flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
