"use client";

import React, { useState, useEffect, useMemo } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import {
  Store,
  Package,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Building2,
  Tag,
  TrendingUp,
  Barcode,
  ArrowRight,
  ClipboardList,
  Truck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber?: string;
  address?: string;
  city?: string;
  isMainBranch?: boolean;
  status?: string;
}

interface ItemProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: string;
  barcodeId: string;
  stockCount?: number;
  bufferStockCount?: number;
  imageUrl?: string;
}

interface StoreAllocation {
  storeId: string;
  storeName: string;
  quantity: number;
}

interface ItemBatch {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemBarcodeId: string;
  itemUnit: string;
  batchCode: number;
  batchCodeString: string;
  manufacturedQuantity: number;
  manufacturingDate: string;
  expiryDays: number;
  expiryDate: string;
  notes?: string;
  storeAllocations?: StoreAllocation[];
  totalAllocated?: number;
  unallocatedQuantity?: number;
  storeRequestId?: string;
  requestNumber?: string;
  storeReceived?: boolean;
  status?: string;
}

const DEFAULT_ITEM_IMAGE = "/default-img.png";

export default function StoreStockPage() {
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"active_stock" | "in_transit">("active_stock");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Real-time Firestore Subscriptions
  useEffect(() => {
    let storesLoaded = false;
    let itemsLoaded = false;
    let batchesLoaded = false;

    const checkAllLoaded = () => {
      if (storesLoaded && itemsLoaded && batchesLoaded) {
        setLoading(false);
      }
    };

    const unsubStores = onSnapshot(collection(db, "stores"), (snapshot) => {
      const list: StoreBranch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      list.sort((a, b) => (b.isMainBranch ? 1 : 0) - (a.isMainBranch ? 1 : 0));
      setStores(list);
      storesLoaded = true;
      checkAllLoaded();
    });

    const unsubItems = onSnapshot(collection(db, "items"), (snapshot) => {
      const list: ItemProduct[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setItems(list);
      itemsLoaded = true;
      checkAllLoaded();
    });

    const unsubBatches = onSnapshot(
      query(collection(db, "batches"), orderBy("manufacturingDate", "desc")),
      (snapshot) => {
        const list: ItemBatch[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setBatches(list);
        batchesLoaded = true;
        checkAllLoaded();
      }
    );

    return () => {
      unsubStores();
      unsubItems();
      unsubBatches();
    };
  }, []);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Days remaining to expiry
  const getDaysLeft = (expiryDate: string) => {
    const today = new Date(todayStr);
    const exp = new Date(expiryDate);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Active batches (received by store & not expired)
  const activeBatches = useMemo(() => {
    return batches.filter(
      (b) => b.expiryDate >= todayStr && b.storeReceived !== false
    );
  }, [batches, todayStr]);

  // In-transit batches (awaiting confirmation in store requests)
  const inTransitBatches = useMemo(() => {
    return batches.filter(
      (b) => b.expiryDate >= todayStr && b.storeReceived === false
    );
  }, [batches, todayStr]);

  // Aggregate stock per item and store (both active received and in-transit)
  const activeStockData = useMemo(() => {
    const result: Array<{
      item: ItemProduct;
      activeBatches: Array<{
        batch: ItemBatch;
        storeId: string;
        storeName: string;
        quantity: number;
        daysLeft: number;
        isInTransit: boolean;
      }>;
      totalActiveQuantity: number;
      totalInTransitQuantity: number;
      totalValue: number;
      expiringSoonBatches: number;
    }> = [];

    items.forEach((item) => {
      const matchingBatches: Array<{
        batch: ItemBatch;
        storeId: string;
        storeName: string;
        quantity: number;
        daysLeft: number;
        isInTransit: boolean;
      }> = [];

      let totalActive = 0;
      let totalInTransit = 0;
      let expiringSoonCount = 0;

      const itemBatches = batches.filter(
        (b) => (b.itemId === item.id || b.itemBarcodeId === item.barcodeId) && b.expiryDate >= todayStr
      );

      itemBatches.forEach((batch) => {
        const daysLeft = getDaysLeft(batch.expiryDate);
        const isInTransit = batch.storeReceived === false;
        if (!isInTransit && daysLeft <= 2) expiringSoonCount++;

        if (batch.storeAllocations && batch.storeAllocations.length > 0) {
          batch.storeAllocations.forEach((alloc) => {
            if (alloc.quantity > 0) {
              if (selectedStoreId === "all" || alloc.storeId === selectedStoreId) {
                matchingBatches.push({
                  batch,
                  storeId: alloc.storeId,
                  storeName: alloc.storeName,
                  quantity: alloc.quantity,
                  daysLeft,
                  isInTransit,
                });
                if (isInTransit) {
                  totalInTransit += alloc.quantity;
                } else {
                  totalActive += alloc.quantity;
                }
              }
            }
          });
        }
      });

      // Sort: active received first, then by days left
      matchingBatches.sort((a, b) => {
        if (a.isInTransit !== b.isInTransit) return a.isInTransit ? 1 : -1;
        return a.daysLeft - b.daysLeft;
      });

      if (matchingBatches.length > 0 || selectedStoreId === "all") {
        result.push({
          item,
          activeBatches: matchingBatches,
          totalActiveQuantity: totalActive,
          totalInTransitQuantity: totalInTransit,
          totalValue: totalActive * (item.price || 0),
          expiringSoonBatches: expiringSoonCount,
        });
      }
    });

    return result;
  }, [items, batches, todayStr, selectedStoreId]);

  // Filtered active data by search and category
  const filteredData = useMemo(() => {
    return activeStockData.filter((entry) => {
      const matchesSearch =
        searchQuery === "" ||
        entry.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.item.barcodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        categoryFilter === "all" || entry.item.category === categoryFilter;

      const hasStock = entry.totalActiveQuantity > 0 || entry.totalInTransitQuantity > 0;
      return matchesSearch && matchesCat && (selectedStoreId === "all" || hasStock);
    });
  }, [activeStockData, searchQuery, categoryFilter, selectedStoreId]);

  // Filtered in-transit batches
  const filteredInTransitBatches = useMemo(() => {
    return inTransitBatches.filter((b) => {
      const matchesStore =
        selectedStoreId === "all" ||
        b.storeAllocations?.some((a) => a.storeId === selectedStoreId && a.quantity > 0);

      const matchesSearch =
        searchQuery === "" ||
        b.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.requestNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.batchCodeString || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        categoryFilter === "all" || b.itemCategory === categoryFilter;

      return matchesStore && matchesSearch && matchesCat;
    });
  }, [inTransitBatches, selectedStoreId, searchQuery, categoryFilter]);

  // Overall KPIs
  const overallKPIs = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    let activeBatchCount = 0;
    let expiringSoonCount = 0;

    filteredData.forEach((entry) => {
      totalQty += entry.totalActiveQuantity;
      totalValue += entry.totalValue;
      activeBatchCount += entry.activeBatches.length;
      expiringSoonCount += entry.expiringSoonBatches;
    });

    const inTransitQty = filteredInTransitBatches.reduce((sum, b) => {
      if (selectedStoreId === "all") {
        return sum + (Number(b.manufacturedQuantity) || 0);
      }
      const storeAlloc = b.storeAllocations?.find((a) => a.storeId === selectedStoreId);
      return sum + (storeAlloc ? Number(storeAlloc.quantity) || 0 : 0);
    }, 0);

    return {
      totalQty,
      totalValue,
      activeBatchCount,
      expiringSoonCount,
      stockedItemsCount: filteredData.filter((e) => e.totalActiveQuantity > 0).length,
      inTransitBatchCount: filteredInTransitBatches.length,
      inTransitQty,
    };
  }, [filteredData, filteredInTransitBatches, selectedStoreId]);

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredData.forEach((d) => {
      next[d.item.id] = true;
    });
    setExpandedItems(next);
  };

  const collapseAll = () => {
    setExpandedItems({});
  };

  const selectedStoreName = useMemo(() => {
    if (selectedStoreId === "all") return "All Outlets & Stores";
    const st = stores.find((s) => s.id === selectedStoreId);
    return st ? st.name : "Selected Outlet";
  }, [selectedStoreId, stores]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Store Stock & Inventory
              </h1>
              <p className="text-xs text-neutral-500">
                Active store inventory with fresh batch traceability. Expired items route to wastage.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Store Outlet Selector */}
            <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-lg px-3 py-1.5 shadow-2xs">
              <Store className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[11px] font-medium text-neutral-500">Outlet:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-transparent text-xs font-bold text-neutral-900 outline-none cursor-pointer pr-1"
              >
                <option value="all">🏢 All Outlets (Consolidated)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.isMainBranch ? "⭐ " : "📍 "}
                    {s.name} {s.city ? `(${s.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/store-requests"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Store Requests</span>
            </Link>

            <Link
              href="/batches"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Batches</span>
            </Link>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Active Stock */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Store Stock</span>
              <span className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700">
                <Boxes className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              {overallKPIs.totalQty.toLocaleString()} <span className="text-xs font-normal text-neutral-500 font-sans">units</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              In {selectedStoreName}
            </div>
          </div>

          {/* Inventory Valuation */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Inventory Valuation</span>
              <span className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              ₹{overallKPIs.totalValue.toLocaleString("en-IN")}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              Standard retail value
            </div>
          </div>

          {/* Active Batches */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Batches</span>
              <span className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700">
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              {overallKPIs.activeBatchCount} <span className="text-xs font-normal text-neutral-500 font-sans">batches</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              Across {overallKPIs.stockedItemsCount} products
            </div>
          </div>

          {/* Expiring Soon / In-Transit */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Expiring Soon (≤ 2d)</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-amber-700 font-mono">
              {overallKPIs.expiringSoonCount} <span className="text-xs font-normal text-amber-600 font-sans">batches</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              {overallKPIs.inTransitBatchCount > 0
                ? `${overallKPIs.inTransitBatchCount} batches in transit`
                : "Priority sale alerts"}
            </div>
          </div>
        </div>

        {/* View Tabs & Filters Container */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            {/* View Tabs */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("active_stock")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === "active_stock"
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Active Store Stock</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === "active_stock" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700"
                }`}>
                  {overallKPIs.stockedItemsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("in_transit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === "in_transit"
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>In-Transit Batches</span>
                {overallKPIs.inTransitBatchCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-mono font-bold">
                    {overallKPIs.inTransitBatchCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions */}
            {activeTab === "active_stock" && (
              <div className="flex items-center gap-1.5 text-xs self-end sm:self-auto">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium text-[11px] transition cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium text-[11px] transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {/* Search Input and Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search sweet product, barcode, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-900 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-[10px] text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  categoryFilter === "all"
                    ? "bg-neutral-900 text-white font-bold"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-neutral-900 text-white font-bold"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center shadow-2xs">
            <div className="inline-block animate-spin w-7 h-7 border-3 border-neutral-900 border-t-transparent rounded-full mb-3" />
            <p className="text-xs font-medium text-neutral-600">
              Loading store stock and batch inventory...
            </p>
          </div>
        ) : activeTab === "in_transit" ? (
          /* ============================================================== */
          /* IN-TRANSIT BATCHES TAB                                         */
          /* ============================================================== */
          <div className="space-y-4">
            {filteredInTransitBatches.length === 0 ? (
              <div className="bg-white border border-neutral-200/90 rounded-xl p-10 text-center shadow-2xs">
                <Truck className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-neutral-800">
                  No Batches Currently In Transit
                </h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                  All dispatched batches have been received at stores, or no transfer orders are pending delivery.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-neutral-900">
                      Dispatched Batches Waiting for Store Confirmation ({filteredInTransitBatches.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    Will be added to store stock once marked &quot;Received at Store&quot;
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3.5">Batch Code</th>
                        <th className="py-2.5 px-3.5">Sweet Product</th>
                        <th className="py-2.5 px-3.5">Destination Store</th>
                        <th className="py-2.5 px-3.5">Transfer Order #</th>
                        <th className="py-2.5 px-3.5">Mfg Date</th>
                        <th className="py-2.5 px-3.5">Expiry Date</th>
                        <th className="py-2.5 px-3.5 text-right">In-Transit Qty</th>
                        <th className="py-2.5 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {filteredInTransitBatches.map((b) => {
                        const targetAlloc = b.storeAllocations?.[0];
                        const daysLeft = getDaysLeft(b.expiryDate);

                        return (
                          <tr key={b.id} className="hover:bg-neutral-50/60 transition">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-neutral-900">
                              {b.batchCodeString || `Batch #${b.batchCode}`}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <strong className="text-neutral-900 block">{b.itemName}</strong>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                #{b.itemBarcodeId} • {b.itemCategory}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-neutral-800">
                                <Store className="w-3.5 h-3.5 text-neutral-400" />
                                {targetAlloc?.storeName || "Branch Outlet"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-semibold text-blue-700">
                              {b.requestNumber || "—"}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-neutral-700">
                              {b.manufacturingDate}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-neutral-700">
                              {b.expiryDate}
                              <span className="text-[10px] text-neutral-400 block font-sans">
                                ({daysLeft}d shelf life)
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-neutral-900 text-sm">
                              {b.manufacturedQuantity}{" "}
                              <span className="text-xs font-normal text-neutral-500 font-sans">
                                {b.itemUnit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <Link
                                href="/store-requests"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold rounded-md shadow-2xs transition"
                              >
                                <span>Receive in Store Requests</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* ACTIVE STORE STOCK TAB                                         */
          /* ============================================================== */
          <div className="space-y-3">
            {filteredData.length === 0 ? (
              <div className="bg-white border border-neutral-200/90 rounded-xl p-10 text-center shadow-2xs">
                <Package className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-neutral-800">
                  No Active Stock Found
                </h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                  No active fresh batches are currently recorded for{" "}
                  <strong>{selectedStoreName}</strong>. Expired batches are automatically moved to wastage.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStoreId("all");
                      setSearchQuery("");
                      setCategoryFilter("all");
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-lg cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <Link
                    href="/wastage"
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-lg"
                  >
                    Check Wastage
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3.5">Product</th>
                        <th className="py-2.5 px-3.5">Category</th>
                        <th className="py-2.5 px-3.5">Price</th>
                        <th className="py-2.5 px-3.5">Active Batches</th>
                        <th className="py-2.5 px-3.5 text-right">Active Stock</th>
                        <th className="py-2.5 px-3.5 text-right">Valuation</th>
                        <th className="py-2.5 px-3.5 text-center">Batch Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {filteredData.map(({ item, activeBatches: itemActiveBatches, totalActiveQuantity, totalInTransitQuantity, totalValue }) => {
                        const isExpanded = !!expandedItems[item.id];
                        const hasStock = totalActiveQuantity > 0 || totalInTransitQuantity > 0;

                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              onClick={() => toggleExpand(item.id)}
                              className="hover:bg-neutral-50/70 transition-colors cursor-pointer select-none group"
                            >
                              {/* Product Thumbnail & Name */}
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                                    <img
                                      src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <strong className="text-neutral-900 block group-hover:text-blue-700 transition-colors">
                                      {item.name}
                                    </strong>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      #{item.barcodeId}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Category */}
                              <td className="py-2.5 px-3.5">
                                <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-neutral-200">
                                  {item.category || "General"}
                                </span>
                              </td>

                              {/* Price */}
                              <td className="py-2.5 px-3.5 font-mono text-neutral-700">
                                ₹{item.price || 0} <span className="text-[10px] text-neutral-400 font-sans">/ {item.unit || "KG"}</span>
                              </td>

                              {/* Active Batches Badge */}
                              <td className="py-2.5 px-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                    itemActiveBatches.length > 0
                                      ? "bg-neutral-100 text-neutral-800 border-neutral-200"
                                      : "bg-neutral-50 text-neutral-400 border-neutral-200"
                                  }`}
                                >
                                  <Boxes className="w-3 h-3 text-neutral-500" />
                                  <span>
                                    {itemActiveBatches.length} {itemActiveBatches.length === 1 ? "Batch" : "Batches"}
                                  </span>
                                </span>
                              </td>

                              {/* Active Stock Qty */}
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-sm">
                                <div className="flex flex-col items-end">
                                  <span className={totalActiveQuantity > 0 ? "text-neutral-900" : "text-neutral-400"}>
                                    {totalActiveQuantity.toLocaleString()}{" "}
                                    <span className="text-xs font-normal text-neutral-500 font-sans">
                                      {item.unit || "KG"}
                                    </span>
                                  </span>
                                  {totalInTransitQuantity > 0 && (
                                    <span className="text-[10px] font-semibold text-blue-700 font-sans flex items-center gap-1 mt-0.5">
                                      <Truck className="w-3 h-3 text-blue-600" />
                                      +{totalInTransitQuantity} in transit
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Total Value */}
                              <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-neutral-700">
                                ₹{totalValue.toLocaleString("en-IN")}
                              </td>

                              {/* Expand Toggle */}
                              <td className="py-2.5 px-3.5 text-center">
                                <button
                                  type="button"
                                  className="p-1 hover:bg-neutral-200 rounded text-neutral-500 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Nested Accordion for Batches */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="p-0 bg-neutral-50/70 border-b border-neutral-200">
                                  <div className="p-3 px-6 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600">
                                      <span className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                        Batch Inventory Breakdown for {item.name}
                                      </span>
                                      <span className="text-neutral-400">
                                        Outlet: {selectedStoreName}
                                      </span>
                                    </div>

                                    {itemActiveBatches.length === 0 ? (
                                      <div className="bg-white rounded-lg border border-neutral-200 p-3 text-center text-neutral-500 text-xs">
                                        No batches allocated to {selectedStoreName}.
                                      </div>
                                    ) : (
                                      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="bg-neutral-100/70 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                              <th className="py-2 px-3">Batch Code</th>
                                              <th className="py-2 px-3">Store Outlet</th>
                                              <th className="py-2 px-3">Mfg Date</th>
                                              <th className="py-2 px-3">Expiry Date</th>
                                              <th className="py-2 px-3">Status / Freshness</th>
                                              <th className="py-2 px-3 text-right">Batch Qty</th>
                                              <th className="py-2 px-3 text-right">Batch Value</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-neutral-200/60">
                                            {itemActiveBatches.map((entry, idx) => {
                                              const isExpiringSoon = entry.daysLeft <= 2;
                                              return (
                                                <tr
                                                  key={`${entry.batch.id}-${entry.storeId}-${idx}`}
                                                  className={`hover:bg-neutral-50/60 transition ${
                                                    entry.isInTransit
                                                      ? "bg-blue-50/25"
                                                      : isExpiringSoon
                                                      ? "bg-amber-50/30"
                                                      : ""
                                                  }`}
                                                >
                                                  <td className="py-2 px-3 font-mono font-bold text-neutral-900">
                                                    {entry.batch.batchCodeString || `Batch #${entry.batch.batchCode}`}
                                                  </td>
                                                  <td className="py-2 px-3 text-neutral-700">
                                                    {entry.storeName}
                                                  </td>
                                                  <td className="py-2 px-3 font-mono text-neutral-600">
                                                    {entry.batch.manufacturingDate || "—"}
                                                  </td>
                                                  <td className="py-2 px-3 font-mono text-neutral-600">
                                                    {entry.batch.expiryDate || "—"}
                                                  </td>
                                                  <td className="py-2 px-3">
                                                    {entry.isInTransit ? (
                                                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                                                        <Truck className="w-3 h-3 text-blue-600" />
                                                        In Transit ({entry.batch.requestNumber || "Warehouse TO"})
                                                      </span>
                                                    ) : isExpiringSoon ? (
                                                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                                                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                                                        Expiring ({entry.daysLeft === 0 ? "Today" : `${entry.daysLeft}d left`})
                                                      </span>
                                                    ) : (
                                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Fresh ({entry.daysLeft}d left)
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                                                    {entry.quantity}{" "}
                                                    <span className="text-[10px] font-normal text-neutral-500 font-sans">
                                                      {item.unit || "KG"}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-mono font-semibold text-neutral-700">
                                                    ₹{(entry.quantity * (item.price || 0)).toLocaleString("en-IN")}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
