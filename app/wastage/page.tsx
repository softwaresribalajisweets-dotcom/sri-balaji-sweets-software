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
  AlertOctagon,
  Trash2,
  TrendingDown,
  Store,
  Package,
  Calendar,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Building2,
  Tag,
  ArrowRight,
  Boxes,
  PieChart,
  BarChart3,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

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
}

interface WastageRecord {
  id: string;
  batchId: string;
  batchCodeString: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemBarcodeId: string;
  itemUnit: string;
  imageUrl?: string;
  storeId: string;
  storeName: string;
  manufacturingDate: string;
  expiryDate: string;
  daysExpired: number;
  quantity: number;
  unitPrice: number;
  totalLoss: number;
  locationType: "Store" | "Central Factory Buffer";
}

const DEFAULT_ITEM_IMAGE = "/default-img.png";

export default function WastageAnalyticsPage() {
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewTab, setViewTab] = useState<"audit_log" | "store_breakdown" | "item_breakdown">("store_breakdown");

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

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Compute Wastage Records: All batches where expiryDate < todayStr AND quantity > 0
  const wastageRecords = useMemo(() => {
    const records: WastageRecord[] = [];
    const today = new Date(todayStr);

    // Map item by ID or Barcode for quick lookup of price/image
    const itemMap = new Map<string, ItemProduct>();
    items.forEach((it) => {
      itemMap.set(it.id, it);
      if (it.barcodeId) itemMap.set(it.barcodeId, it);
    });

    // Filter expired batches
    const expiredBatches = batches.filter((b) => b.expiryDate < todayStr);

    expiredBatches.forEach((batch) => {
      const itemInfo = itemMap.get(batch.itemId) || itemMap.get(batch.itemBarcodeId);
      const unitPrice = itemInfo?.price || 0;
      const imageUrl = itemInfo?.imageUrl || DEFAULT_ITEM_IMAGE;

      const expDate = new Date(batch.expiryDate);
      const daysExpired = Math.max(
        1,
        Math.floor((today.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Check Store Allocations
      if (batch.storeAllocations && batch.storeAllocations.length > 0) {
        batch.storeAllocations.forEach((alloc) => {
          if (alloc.quantity > 0) {
            records.push({
              id: `${batch.id}-${alloc.storeId}`,
              batchId: batch.id,
              batchCodeString: batch.batchCodeString || `Batch #${batch.batchCode}`,
              itemId: batch.itemId,
              itemName: batch.itemName,
              itemCategory: batch.itemCategory,
              itemBarcodeId: batch.itemBarcodeId,
              itemUnit: batch.itemUnit || "KG",
              imageUrl,
              storeId: alloc.storeId,
              storeName: alloc.storeName,
              manufacturingDate: batch.manufacturingDate,
              expiryDate: batch.expiryDate,
              daysExpired,
              quantity: alloc.quantity,
              unitPrice,
              totalLoss: alloc.quantity * unitPrice,
              locationType: "Store",
            });
          }
        });
      }

      // Check unallocated buffer remaining at factory
      if (batch.unallocatedQuantity && batch.unallocatedQuantity > 0) {
        records.push({
          id: `${batch.id}-factory`,
          batchId: batch.id,
          batchCodeString: batch.batchCodeString || `Batch #${batch.batchCode}`,
          itemId: batch.itemId,
          itemName: batch.itemName,
          itemCategory: batch.itemCategory,
          itemBarcodeId: batch.itemBarcodeId,
          itemUnit: batch.itemUnit || "KG",
          imageUrl,
          storeId: "factory",
          storeName: "Central Factory / Warehouse Buffer",
          manufacturingDate: batch.manufacturingDate,
          expiryDate: batch.expiryDate,
          daysExpired,
          quantity: batch.unallocatedQuantity,
          unitPrice,
          totalLoss: batch.unallocatedQuantity * unitPrice,
          locationType: "Central Factory Buffer",
        });
      }
    });

    // Sort by expiry date descending (most recent expiry first)
    return records.sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
  }, [batches, items, todayStr]);

  // Filtered Wastage Records based on user inputs
  const filteredRecords = useMemo(() => {
    return wastageRecords.filter((rec) => {
      const matchStore =
        selectedStoreId === "all" || rec.storeId === selectedStoreId;
      const matchCategory =
        selectedCategory === "all" || rec.itemCategory === selectedCategory;
      const matchQuery =
        searchQuery === "" ||
        rec.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.batchCodeString.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.itemBarcodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.storeName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStore && matchCategory && matchQuery;
    });
  }, [wastageRecords, selectedStoreId, selectedCategory, searchQuery]);

  // Overall Wastage KPIs
  const kpis = useMemo(() => {
    const totalLoss = filteredRecords.reduce((sum, r) => sum + r.totalLoss, 0);
    const totalQty = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const uniqueBatches = new Set(filteredRecords.map((r) => r.batchId)).size;

    // Find highest loss store
    const storeLossMap: Record<string, { name: string; loss: number }> = {};
    filteredRecords.forEach((r) => {
      if (!storeLossMap[r.storeId]) {
        storeLossMap[r.storeId] = { name: r.storeName, loss: 0 };
      }
      storeLossMap[r.storeId].loss += r.totalLoss;
    });

    let highestStore = "None";
    let maxStoreLoss = 0;
    Object.values(storeLossMap).forEach((st) => {
      if (st.loss > maxStoreLoss) {
        maxStoreLoss = st.loss;
        highestStore = st.name;
      }
    });

    return {
      totalLoss,
      totalQty,
      uniqueBatches,
      highestStore,
      maxStoreLoss,
    };
  }, [filteredRecords]);

  // Store-wise Wastage Analytics
  const storeAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        totalQty: number;
        totalLoss: number;
        recordCount: number;
        uniqueBatches: Set<string>;
        topItem: string;
      }
    >();

    wastageRecords.forEach((r) => {
      if (!map.has(r.storeId)) {
        map.set(r.storeId, {
          storeId: r.storeId,
          storeName: r.storeName,
          totalQty: 0,
          totalLoss: 0,
          recordCount: 0,
          uniqueBatches: new Set<string>(),
          topItem: "",
        });
      }
      const cur = map.get(r.storeId)!;
      cur.totalQty += r.quantity;
      cur.totalLoss += r.totalLoss;
      cur.recordCount += 1;
      cur.uniqueBatches.add(r.batchId);
    });

    const list = Array.from(map.values()).sort((a, b) => b.totalLoss - a.totalLoss);
    return list;
  }, [wastageRecords]);

  // Item-wise Wastage Analytics
  const itemAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        itemCategory: string;
        itemBarcodeId: string;
        imageUrl?: string;
        unit: string;
        unitPrice: number;
        totalQty: number;
        totalLoss: number;
        batchCount: number;
      }
    >();

    wastageRecords.forEach((r) => {
      if (!map.has(r.itemId)) {
        map.set(r.itemId, {
          itemId: r.itemId,
          itemName: r.itemName,
          itemCategory: r.itemCategory,
          itemBarcodeId: r.itemBarcodeId,
          imageUrl: r.imageUrl,
          unit: r.itemUnit,
          unitPrice: r.unitPrice,
          totalQty: 0,
          totalLoss: 0,
          batchCount: 0,
        });
      }
      const cur = map.get(r.itemId)!;
      cur.totalQty += r.quantity;
      cur.totalLoss += r.totalLoss;
      cur.batchCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.totalLoss - a.totalLoss);
  }, [wastageRecords]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Export CSV Audit Report
  const downloadCSV = () => {
    const headers = [
      "Location",
      "Item Name",
      "Category",
      "Barcode",
      "Batch Number",
      "Manufacturing Date",
      "Expiry Date",
      "Days Expired",
      "Wasted Quantity",
      "Unit",
      "Unit Price (INR)",
      "Total Financial Loss (INR)",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.storeName}"`,
      `"${r.itemName}"`,
      `"${r.itemCategory}"`,
      `"${r.itemBarcodeId}"`,
      `"${r.batchCodeString}"`,
      r.manufacturingDate,
      r.expiryDate,
      r.daysExpired,
      r.quantity,
      r.itemUnit,
      r.unitPrice,
      r.totalLoss,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Sri_Balaji_Sweets_Wastage_Report_${todayStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Banner */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                Automatic Expiry &amp; Loss Tracking
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-zinc-900 tracking-tight">
                Wastage &amp; Expired Stock Analytics
              </h1>
              <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                Automated detection of expired sweets and batches across retail branches.
                Calculates quantity wasted, unit prices, and financial damage in ₹.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={downloadCSV}
                disabled={filteredRecords.length === 0}
                className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition border border-zinc-300"
              >
                <Download className="w-4 h-4" />
                Export CSV Audit
              </button>

              <Link
                href="/store-stock"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
              >
                <Store className="w-4 h-4" />
                View Active Store Stock
              </Link>
            </div>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
            <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
              <span>Total Wastage Loss</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl lg:text-3xl font-bold text-rose-600">
                ₹{kpis.totalLoss.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 truncate">
              Financial damage from expired batches
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <span>Total Quantity Wasted</span>
              <Trash2 className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-zinc-900">
                {kpis.totalQty.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 font-medium">units / KG</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              Across stores and buffer
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <span>Expired Batches</span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-bold text-zinc-900">
                {kpis.uniqueBatches}
              </span>
              <span className="text-xs text-zinc-500 font-medium">batches</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              Expiry date &lt; {todayStr}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
              <span>Highest Loss Location</span>
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 truncate">
              <span className="text-lg lg:text-xl font-bold text-zinc-900 truncate block">
                {kpis.highestStore}
              </span>
            </div>
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              ₹{kpis.maxStoreLoss.toLocaleString("en-IN")} loss recorded
            </p>
          </div>
        </div>

        {/* Tab Navigation: Store Breakdown | Item Breakdown | Audit Log */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewTab("store_breakdown")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                viewTab === "store_breakdown"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Store-wise Breakdown
              <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-300">
                {storeAnalytics.length}
              </span>
            </button>

            <button
              onClick={() => setViewTab("item_breakdown")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                viewTab === "item_breakdown"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              Item-wise Breakdown
              <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-300">
                {itemAnalytics.length}
              </span>
            </button>

            <button
              onClick={() => setViewTab("audit_log")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                viewTab === "audit_log"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Detailed Wastage Audit Log
              <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-300">
                {filteredRecords.length}
              </span>
            </button>
          </div>

          {/* Quick Search & Store Dropdown */}
          <div className="flex items-center gap-3">
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-700 outline-none"
            >
              <option value="all">🏢 All Stores &amp; Buffer</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="factory">Central Factory / Warehouse Buffer</option>
            </select>

            <div className="relative w-48 lg:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sweet / batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Content View 1: STORE-WISE BREAKDOWN */}
        {viewTab === "store_breakdown" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeAnalytics.length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-zinc-800">
                    Zero Wastage Detected!
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    No stores currently have expired stock. All active batches are within their shelf life.
                  </p>
                </div>
              ) : (
                storeAnalytics.map((st) => {
                  const totalLossAll = kpis.totalLoss || 1;
                  const lossShare = Math.round((st.totalLoss / totalLossAll) * 100);

                  return (
                    <div
                      key={st.storeId}
                      className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-sm hover:border-rose-300 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                            <Store className="w-5 h-5 text-rose-600" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-zinc-900 truncate">
                              {st.storeName}
                            </h4>
                            <span className="text-[11px] text-zinc-400">
                              {st.recordCount} expired sweet entries
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg shrink-0">
                          {lossShare}% loss
                        </span>
                      </div>

                      {/* Store Loss & Qty Metrics */}
                      <div className="grid grid-cols-2 gap-2 bg-zinc-50 rounded-xl p-3 my-3">
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                            Wasted Quantity
                          </span>
                          <div className="text-base font-bold text-zinc-900 mt-0.5">
                            {st.totalQty.toLocaleString()}{" "}
                            <span className="text-xs font-normal text-zinc-500">KG/Units</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                            Financial Loss
                          </span>
                          <div className="text-base font-bold text-rose-600 mt-0.5">
                            ₹{st.totalLoss.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar of Loss */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                          <span>Share of total wastage</span>
                          <span>{lossShare}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, lossShare))}%` }}
                          />
                        </div>
                      </div>

                      {/* Action to drill-down */}
                      <button
                        onClick={() => {
                          setSelectedStoreId(st.storeId);
                          setViewTab("audit_log");
                        }}
                        className="mt-4 w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        View Store Wastage Audit <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Content View 2: ITEM-WISE BREAKDOWN */}
        {viewTab === "item_breakdown" && (
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-800">
                Product Wastage Ranking (Highest Loss First)
              </h3>
              <span className="text-xs text-zinc-500">
                {itemAnalytics.length} affected products
              </span>
            </div>

            {itemAnalytics.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                No items with expired wastage found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/75 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Sweet Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Barcode</th>
                      <th className="py-3 px-4 text-center">Expired Batches</th>
                      <th className="py-3 px-4 text-right">Wasted Quantity</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-right">Total Financial Loss</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {itemAnalytics.map((item) => (
                      <tr key={item.itemId} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0">
                              <img
                                src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                                alt={item.itemName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                            </div>
                            <span className="font-bold text-zinc-900">{item.itemName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-zinc-600">
                          <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                            {item.itemCategory || "Sweets"}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-zinc-500">
                          {item.itemBarcodeId || "—"}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            {item.batchCount} batches
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-zinc-900">
                          {item.totalQty.toLocaleString()} {item.unit}
                        </td>

                        <td className="py-3 px-4 text-right text-zinc-600">
                          ₹{item.unitPrice}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                          ₹{item.totalLoss.toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSearchQuery(item.itemName);
                              setViewTab("audit_log");
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Filter Logs
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Content View 3: DETAILED AUDIT LOG */}
        {viewTab === "audit_log" && (
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-800">
                  Expired Stock Wastage Audit Log
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Showing {filteredRecords.length} records matching current filters.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto text-xs">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    selectedCategory === "all"
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 border border-zinc-200"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      selectedCategory === cat
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-600 border border-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                No wastage audit records found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/75 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Store Location</th>
                      <th className="py-3 px-4">Sweet Item</th>
                      <th className="py-3 px-4">Batch #</th>
                      <th className="py-3 px-4">Mfg Date</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Expiry Status</th>
                      <th className="py-3 px-4 text-right">Wasted Qty</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-right">Total Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                            <Store className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{rec.storeName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0">
                              <img
                                src={rec.imageUrl || DEFAULT_ITEM_IMAGE}
                                alt={rec.itemName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                            </div>
                            <div>
                              <div className="font-bold text-zinc-900">{rec.itemName}</div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                {rec.itemBarcodeId}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-semibold text-zinc-800">
                          {rec.batchCodeString}
                        </td>

                        <td className="py-3 px-4 font-mono text-zinc-500">
                          {rec.manufacturingDate}
                        </td>

                        <td className="py-3 px-4 font-mono font-medium text-rose-600">
                          {rec.expiryDate}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-rose-500" />
                            Expired {rec.daysExpired}d ago
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-zinc-900">
                          {rec.quantity} {rec.itemUnit}
                        </td>

                        <td className="py-3 px-4 text-right text-zinc-600">
                          ₹{rec.unitPrice}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                          ₹{rec.totalLoss.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
