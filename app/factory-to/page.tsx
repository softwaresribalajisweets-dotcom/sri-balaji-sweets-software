"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  query,
  orderBy,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Factory,
  Store,
  Calendar,
  Package,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Pencil,
  Eye,
  Loader2,
  X,
  FileText,
  Truck,
  TrendingUp,
  TrendingDown,
  Warehouse,
  ChevronRight,
  Sparkles,
  Building2,
  Layers,
  Boxes,
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

interface RequestItemEntry {
  itemId: string;
  itemName: string;
  category: string;
  barcodeId: string;
  unit: string;
  quantity: number;
  fulfilledQuantity?: number;
  packedQuantity?: number;
  receivedQuantity?: number;
}

interface StoreRequestDoc {
  id: string;
  requestNumber: string;
  storeId: string;
  storeName: string;
  storeMobile: string;
  storeAddress: string;
  requestDate: string;
  items: RequestItemEntry[];
  totalQuantity: number;
  totalFulfilledQuantity?: number;
  totalPackedQuantity?: number;
  totalReceivedQuantity?: number;
  status: string;
  notes?: string;
  factoryNotes?: string;
  warehouseNotes?: string;
  storeNotes?: string;
  batchesCreated?: boolean;
  batchesCreatedAt?: any;
  createdAt?: any;
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
  storeAllocations?: Array<{
    storeId: string;
    storeName: string;
    quantity: number;
  }>;
  totalAllocated?: number;
  unallocatedQuantity?: number;
  createdAt?: any;
}

export default function FactoryTOPage() {
  const [requests, setRequests] = useState<StoreRequestDoc[]>([]);
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [existingBatches, setExistingBatches] = useState<ItemBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Edit / Fulfill TO Modal State
  const [editingTO, setEditingTO] = useState<StoreRequestDoc | null>(null);
  const [itemFulfilledQuantities, setItemFulfilledQuantities] = useState<{
    [itemId: string]: number | "";
  }>({});
  const [factoryNotes, setFactoryNotes] = useState("");
  const [savingTO, setSavingTO] = useState(false);

  // Move to Warehouse Batch Selection Modal State
  const [batchModalTO, setBatchModalTO] = useState<StoreRequestDoc | null>(null);
  const [selectedItemBatches, setSelectedItemBatches] = useState<{ [itemId: string]: string }>({});
  const [batchMoveQuantities, setBatchMoveQuantities] = useState<{ [itemId: string]: number | "" }>({});
  const [batchModalNotes, setBatchModalNotes] = useState("");
  const [savingBatches, setSavingBatches] = useState(false);

  // View Details Modal State
  const [viewingTO, setViewingTO] = useState<StoreRequestDoc | null>(null);

  // Subscribe to store_requests, stores, and batches
  useEffect(() => {
    const qReqs = query(collection(db, "store_requests"), orderBy("createdAt", "desc"));
    const unsubReqs = onSnapshot(
      qReqs,
      (snapshot) => {
        const reqList: StoreRequestDoc[] = [];
        snapshot.forEach((docSnap) => {
          reqList.push({ id: docSnap.id, ...docSnap.data() } as StoreRequestDoc);
        });
        setRequests(reqList);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading requests for factory TO:", err);
        setLoading(false);
      }
    );

    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(qStores, (snapshot) => {
      const storeList: StoreBranch[] = [];
      snapshot.forEach((docSnap) => {
        storeList.push({ id: docSnap.id, ...docSnap.data() } as StoreBranch);
      });
      setStores(storeList);
    });

    const qBatches = query(collection(db, "batches"), orderBy("createdAt", "desc"));
    const unsubBatches = onSnapshot(qBatches, (snapshot) => {
      const bList: ItemBatch[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        bList.push({
          id: docSnap.id,
          ...data,
          batchCode: Number(data.batchCode) || 0,
          manufacturedQuantity: Number(data.manufacturedQuantity) || 0,
        } as ItemBatch);
      });
      setExistingBatches(bList);
    });

    return () => {
      unsubReqs();
      unsubStores();
      unsubBatches();
    };
  }, []);

  // Open Edit / Fulfill Modal
  const handleOpenEditTO = (req: StoreRequestDoc) => {
    setEditingTO(req);
    const initialMap: { [itemId: string]: number | "" } = {};
    req.items.forEach((it) => {
      initialMap[it.itemId] =
        it.fulfilledQuantity !== undefined ? it.fulfilledQuantity : it.quantity;
    });
    setItemFulfilledQuantities(initialMap);
    setFactoryNotes(req.factoryNotes || "");
  };

  // Open Move to Warehouse Modal (select from top 10 newest batches per item)
  const handleOpenBatchModal = (
    req: StoreRequestDoc,
    prefilledQuantities?: { [itemId: string]: number | "" }
  ) => {
    setBatchModalTO(req);
    const initialQtyMap: { [itemId: string]: number | "" } = {};
    const initialBatchMap: { [itemId: string]: string } = {};

    req.items.forEach((it) => {
      const qty =
        prefilledQuantities &&
        prefilledQuantities[it.itemId] !== undefined &&
        prefilledQuantities[it.itemId] !== ""
          ? Number(prefilledQuantities[it.itemId])
          : it.fulfilledQuantity !== undefined
          ? it.fulfilledQuantity
          : it.quantity;

      initialQtyMap[it.itemId] = qty;

      // Filter matching batches for this item (top 10 newest, existingBatches is ordered by createdAt desc)
      const itemBatches = existingBatches.filter(
        (b) => b.itemId === it.itemId || (it.barcodeId && b.itemBarcodeId === it.barcodeId)
      );

      if ((it as any).batchId) {
        initialBatchMap[it.itemId] = (it as any).batchId;
      } else if (itemBatches.length > 0) {
        initialBatchMap[it.itemId] = itemBatches[0].id;
      } else {
        initialBatchMap[it.itemId] = "";
      }
    });

    setBatchMoveQuantities(initialQtyMap);
    setSelectedItemBatches(initialBatchMap);
    setBatchModalNotes(req.factoryNotes || "");
  };

  // Save batch assignments and update Store Request to "Moved to Warehouse"
  const handleSaveBatchDispatch = async () => {
    if (!batchModalTO) return;

    try {
      setSavingBatches(true);

      const updatedItems = batchModalTO.items.map((it) => {
        const moveQty =
          batchMoveQuantities[it.itemId] !== undefined && batchMoveQuantities[it.itemId] !== ""
            ? Number(batchMoveQuantities[it.itemId])
            : Number(it.fulfilledQuantity || it.quantity);
        const bId = selectedItemBatches[it.itemId] || "";
        const bObj = existingBatches.find((b) => b.id === bId);

        return {
          ...it,
          fulfilledQuantity: moveQty,
          batchId: bId || undefined,
          batchCodeString: bObj ? bObj.batchCodeString || `Batch #${bObj.batchCode}` : undefined,
        };
      });

      // Update storeAllocations on each chosen batch
      for (const it of updatedItems) {
        if (it.batchId && it.fulfilledQuantity > 0) {
          const bDoc = existingBatches.find((b) => b.id === it.batchId);
          if (bDoc) {
            const otherAllocations = (bDoc.storeAllocations || []).filter(
              (a) => a.storeId !== batchModalTO.storeId
            );
            const newAllocations = [
              ...otherAllocations,
              {
                storeId: batchModalTO.storeId,
                storeName: batchModalTO.storeName,
                quantity: it.fulfilledQuantity,
              },
            ];
            const totalAllocated = newAllocations.reduce((sum, a) => sum + a.quantity, 0);
            const unallocated = Math.max(0, (bDoc.manufacturedQuantity || 0) - totalAllocated);

            await updateDoc(doc(db, "batches", it.batchId), {
              storeAllocations: newAllocations,
              totalAllocated: totalAllocated,
              unallocatedQuantity: unallocated,
              storeRequestId: batchModalTO.id,
              requestNumber: batchModalTO.requestNumber,
              storeReceived: false, // In transit until received at store in Store Requests
              status: "Moved to Warehouse",
            });
          }
        }
      }

      const totalFulfilled = updatedItems.reduce(
        (sum, it) => sum + (Number(it.fulfilledQuantity) || 0),
        0
      );

      // Update Store Request to "Moved to Warehouse"
      await updateDoc(doc(db, "store_requests", batchModalTO.id), {
        status: "Moved to Warehouse",
        items: updatedItems,
        totalFulfilledQuantity: totalFulfilled,
        factoryNotes: batchModalNotes.trim(),
        batchesCreated: true,
        batchesCreatedAt: serverTimestamp(),
      });

      setBatchModalTO(null);
    } catch (err: any) {
      console.error("Error moving to warehouse:", err);
      alert(`Error moving to warehouse: ${err.message}`);
    } finally {
      setSavingBatches(false);
    }
  };

  // Save Quantities & Optionally Transition Status
  const handleSaveFulfilledTO = async (targetStatus?: string) => {
    if (!editingTO) return;

    try {
      setSavingTO(true);
      const updatedItems = editingTO.items.map((it) => ({
        ...it,
        fulfilledQuantity: Number(itemFulfilledQuantities[it.itemId]) || 0,
      }));

      const totalFulfilled = updatedItems.reduce(
        (sum, it) => sum + (Number(it.fulfilledQuantity) || 0),
        0
      );

      const updatePayload: any = {
        items: updatedItems,
        totalFulfilledQuantity: totalFulfilled,
        factoryNotes: factoryNotes.trim(),
      };

      if (targetStatus) {
        updatePayload.status = targetStatus;
      }

      await updateDoc(doc(db, "store_requests", editingTO.id), updatePayload);
      setEditingTO(null);
    } catch (err: any) {
      console.error("Error updating factory TO:", err);
      alert(`Error updating transfer order: ${err.message}`);
    } finally {
      setSavingTO(false);
    }
  };

  // Status Badge & Stepper Info
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Created":
      case "Pending":
        return {
          label: "Created / New Order",
          badge: "bg-amber-100 text-amber-900 border-amber-300",
          step: 1,
        };
      case "Accepted by Factory":
      case "In Progress":
        return {
          label: "Accepted by Factory",
          badge: "bg-blue-100 text-blue-900 border-blue-300 font-bold",
          step: 2,
        };
      case "Moved to Warehouse":
        return {
          label: "Moved to Warehouse",
          badge: "bg-indigo-100 text-indigo-900 border-indigo-300 font-bold",
          step: 3,
        };
      case "Received at Warehouse":
        return {
          label: "Received at Warehouse",
          badge: "bg-cyan-100 text-cyan-900 border-cyan-300",
          step: 4,
        };
      case "Moved to Store":
      case "Dispatched":
        return {
          label: "Moved to Store",
          badge: "bg-purple-100 text-purple-900 border-purple-300",
          step: 5,
        };
      case "Received at Store":
      case "Delivered":
        return {
          label: "Received at Store",
          badge: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
          step: 6,
        };
      default:
        return {
          label: status || "Cancelled",
          badge: "bg-neutral-100 text-neutral-600 border-neutral-300",
          step: 0,
        };
    }
  };

  // Filtering Requests
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.items.some((it) => it.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStore =
      selectedStoreFilter === "all" || req.storeId === selectedStoreFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active_factory" &&
        ["Created", "Pending", "Accepted by Factory", "In Progress"].includes(req.status)) ||
      req.status === statusFilter;

    return matchesSearch && matchesStore && matchesStatus;
  });

  // KPI Metrics
  const totalCreatedCount = requests.filter(
    (r) => r.status === "Created" || r.status === "Pending"
  ).length;
  const totalAcceptedCount = requests.filter(
    (r) => r.status === "Accepted by Factory" || r.status === "In Progress"
  ).length;
  const totalMovedWarehouseCount = requests.filter(
    (r) => r.status === "Moved to Warehouse"
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Factory Transfer Orders (Factory TO)
              </h1>
              <p className="text-xs text-neutral-500">
                Review branch store requests, fulfill quantities, and dispatch fresh production stock to warehouse
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/batches"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Production Batches</span>
            </Link>
            <Link
              href="/warehouse-to"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Warehouse TO</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                1. New Store Requests
              </span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 font-mono">
              {totalCreatedCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-amber-700 font-medium">
              Waiting for factory review & acceptance
            </div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                2. Accepted & In Production
              </span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                <Factory className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-700 font-mono">
              {totalAcceptedCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-blue-600 font-medium">
              Ready for batch allocation & dispatch
            </div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                3. Dispatched to Warehouse
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <Truck className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-700 font-mono">
              {totalMovedWarehouseCount} Dispatched
            </div>
            <div className="mt-1 text-[11px] text-indigo-600 font-medium">
              Stock moved to central warehouse
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search TO #, store outlet, or sweet product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
              />
            </div>

            {/* Store Filter */}
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">🏢 All Stores ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isMainBranch ? "⭐ (Main Branch)" : ""}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">⚡ All Statuses</option>
              <option value="active_factory">🔥 Factory Action Required</option>
              <option value="Created">🟡 Created (New)</option>
              <option value="Accepted by Factory">🔵 Accepted by Factory</option>
              <option value="Moved to Warehouse">🟣 Moved to Warehouse</option>
              <option value="Received at Warehouse">🔷 Received at Warehouse</option>
              <option value="Moved to Store">🚚 Moved to Store</option>
              <option value="Received at Store">🟢 Completed at Store</option>
            </select>
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            Showing <strong className="font-mono text-neutral-900">{filteredRequests.length}</strong> of{" "}
            <strong className="font-mono text-neutral-900">{requests.length}</strong> transfer orders
          </div>
        </div>

        {/* Transfer Orders Table */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
              <span className="text-xs font-medium">Loading Factory Transfer Orders...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200">
                <Factory className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                No Factory Orders Found
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm">
                No store requests currently match the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">TO Number</th>
                    <th className="py-3 px-4">Store Outlet</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Requested Qty</th>
                    <th className="py-3 px-4">Factory Supplied Qty</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Factory Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredRequests.map((req) => {
                    const st = getStatusBadge(req.status);
                    const isNew = req.status === "Created" || req.status === "Pending";
                    const isAccepted =
                      req.status === "Accepted by Factory" || req.status === "In Progress";
                    const hasFulfilled =
                      req.totalFulfilledQuantity !== undefined &&
                      req.totalFulfilledQuantity !== req.totalQuantity;

                    return (
                      <tr key={req.id} className="hover:bg-neutral-50/60 transition-colors group">
                        {/* Request Number */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewingTO(req)}
                            className="font-mono font-bold text-neutral-900 text-sm hover:text-blue-600 cursor-pointer"
                          >
                            {req.requestNumber}
                          </button>
                        </td>

                        {/* Store Outlet */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <div>
                              <strong className="text-neutral-900 block">{req.storeName}</strong>
                              {req.storeMobile && (
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {req.storeMobile}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 font-mono text-neutral-700">
                          {req.requestDate}
                        </td>

                        {/* Items Count */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 font-mono font-bold text-xs text-neutral-900 shadow-2xs">
                            <Package className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{req.items.length} {req.items.length === 1 ? "Item" : "Items"}</span>
                          </span>
                        </td>

                        {/* Requested Qty (Main Value) */}
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900 text-sm">
                          {req.totalQuantity} <span className="text-xs font-normal text-neutral-500 font-sans">Units</span>
                        </td>

                        {/* Factory Supplied Qty */}
                        <td className="py-3 px-4">
                          {req.totalFulfilledQuantity !== undefined ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-700 text-sm">
                                {req.totalFulfilledQuantity}
                              </span>
                              {hasFulfilled && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                    req.totalFulfilledQuantity > req.totalQuantity
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {req.totalFulfilledQuantity > req.totalQuantity ? "+" : ""}
                                  {(req.totalFulfilledQuantity - req.totalQuantity).toFixed(1)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-400 font-mono text-xs italic">
                              Pending fulfill
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.badge}`}
                          >
                            {st.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary Action Button */}
                            {isNew && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditTO(req)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                                title="Review & Fulfill Quantities"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Fulfill & Accept</span>
                              </button>
                            )}

                            {isAccepted && (
                              <button
                                type="button"
                                onClick={() => handleOpenBatchModal(req)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                                title="Create Production Batches & Move to Warehouse"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>Move to Warehouse</span>
                              </button>
                            )}

                            {/* View Button */}
                            <button
                              type="button"
                              onClick={() => setViewingTO(req)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* General Edit button for any other state */}
                            {!isNew && !isAccepted && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditTO(req)}
                                className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                                title="Adjust Quantities"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* EDIT / FULFILL TRANSFER ORDER MODAL                            */}
        {/* ============================================================== */}
        {editingTO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-neutral-200 my-8 overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      <span>Fulfill Store Request - {editingTO.requestNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold border border-blue-200">
                        {editingTO.storeName}
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Edit supplied quantities (can be more or less than requested) and advance status
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingTO && setEditingTO(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items Comparison Table */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Store & Date Info Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">Store</span>
                    <strong className="text-neutral-900">{editingTO.storeName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">Request Date</span>
                    <span className="font-mono text-neutral-800">{editingTO.requestDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">Current Status</span>
                    <span className="font-bold text-blue-700">{editingTO.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">Items Count</span>
                    <span className="font-mono font-bold text-neutral-900">{editingTO.items.length} Products</span>
                  </div>
                </div>

                {/* Main comparison table */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-bold text-neutral-600">
                      <tr>
                        <th className="py-2.5 px-3">Sweet Product</th>
                        <th className="py-2.5 px-3 text-center">
                          Main Requested Qty
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          Factory Supplied Qty (Editable)
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          Variance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {editingTO.items.map((it) => {
                        const originalQty = Number(it.quantity) || 0;
                        const suppliedQty =
                          itemFulfilledQuantities[it.itemId] === ""
                            ? 0
                            : Number(itemFulfilledQuantities[it.itemId]);
                        const diff = suppliedQty - originalQty;

                        return (
                          <tr key={it.itemId} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <strong className="text-neutral-900 block">{it.itemName}</strong>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                Barcode: {it.barcodeId} • {it.category}
                              </span>
                            </td>

                            {/* Main requested quantity */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-800 text-sm">
                              {originalQty} <span className="text-xs font-normal text-neutral-500 font-sans">{it.unit}</span>
                            </td>

                            {/* Editable factory fulfilled quantity */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  required
                                  value={itemFulfilledQuantities[it.itemId]}
                                  onChange={(e) =>
                                    setItemFulfilledQuantities((prev) => ({
                                      ...prev,
                                      [it.itemId]: e.target.value === "" ? "" : Number(e.target.value),
                                    }))
                                  }
                                  className="w-24 bg-white font-mono font-bold text-sm p-1.5 rounded-lg border border-neutral-300 text-center focus:outline-none focus:border-neutral-900 shadow-2xs"
                                />
                                <span className="text-xs font-semibold text-neutral-500">
                                  {it.unit}
                                </span>
                              </div>
                            </td>

                            {/* Variance Difference Badge */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                              {diff === 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Exact
                                </span>
                              ) : diff > 0 ? (
                                <span className="inline-flex items-center gap-1 text-blue-700 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                                  <TrendingUp className="w-3 h-3" /> +{diff.toFixed(1)} {it.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                                  <TrendingDown className="w-3 h-3" /> {diff.toFixed(1)} {it.unit}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Factory Notes */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Factory Fulfillment Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Extra 5 KG supplied from Morning Shift Batch #4"
                    value={factoryNotes}
                    onChange={(e) => setFactoryNotes(e.target.value)}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="p-4 px-6 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
                <div className="text-xs text-neutral-600">
                  Total Requested:{" "}
                  <strong className="font-mono text-neutral-900">
                    {editingTO.totalQuantity} units
                  </strong>{" "}
                  • Total Factory Supplied:{" "}
                  <strong className="font-mono text-blue-700">
                    {Object.values(itemFulfilledQuantities).reduce(
                      (acc: number, curr) => acc + (Number(curr) || 0),
                      0
                    )}{" "}
                    units
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTO(null)}
                    disabled={savingTO}
                    className="px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveFulfilledTO("Accepted by Factory")}
                    disabled={savingTO}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    {savingTO && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save & Accept by Factory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const currentReq = editingTO;
                      const currentMap = { ...itemFulfilledQuantities };
                      setEditingTO(null);
                      handleOpenBatchModal(currentReq, currentMap);
                    }}
                    disabled={savingTO}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Select Batches & Move to Warehouse</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SELECT BATCH & MOVE TO WAREHOUSE MODAL                         */}
        {/* ============================================================== */}
        {batchModalTO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 my-8 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      <span>Select Batches & Move to Warehouse</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 font-bold">
                        {batchModalTO.requestNumber}
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Select created batch (newest 10) per item and assign quantities for destination store
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingBatches && setBatchModalTO(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Destination Banner */}
              <div className="px-6 pt-4 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-neutral-600" />
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block">Destination Store Outlet</span>
                      <strong className="text-neutral-900 text-sm">{batchModalTO.storeName}</strong>
                    </div>
                  </div>
                  <div className="text-neutral-600">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">Request Date</span>
                    <span className="font-mono">{batchModalTO.requestDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Store stock will activate once confirmed in Store Requests</span>
                  </div>
                </div>
              </div>

              {/* Items Batches Selection List */}
              <div className="p-6 pt-2 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-3">
                  {batchModalTO.items.map((it) => {
                    const itemBatches = existingBatches.filter(
                      (b) => b.itemId === it.itemId || (it.barcodeId && b.itemBarcodeId === it.barcodeId)
                    );
                    const top10Batches = itemBatches.slice(0, 10);
                    const selectedBatchId = selectedItemBatches[it.itemId] || "";
                    const activeBatchObj = existingBatches.find((b) => b.id === selectedBatchId);
                    const currentMoveQty = batchMoveQuantities[it.itemId] ?? it.quantity;

                    return (
                      <div
                        key={it.itemId}
                        className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs hover:border-neutral-300 transition space-y-3"
                      >
                        {/* Item header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-neutral-900">{it.itemName}</h4>
                              <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                                {it.category}
                              </span>
                              <span className="font-mono text-[10px] text-neutral-400">
                                #{it.barcodeId}
                              </span>
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              Requested by Store: <strong className="font-mono text-neutral-800">{it.quantity} {it.unit}</strong>
                            </div>
                          </div>

                          {activeBatchObj && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-neutral-500 font-medium">Batch Info:</span>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-mono text-xs font-bold">
                                <span>{activeBatchObj.batchCodeString || `Batch #${activeBatchObj.batchCode}`}</span>
                                <span className="text-neutral-400">•</span>
                                <span className="text-[11px] text-purple-700 font-sans">
                                  Avail: {activeBatchObj.unallocatedQuantity ?? activeBatchObj.manufacturedQuantity} {it.unit}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Dropdown & Quantity Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          {/* Batch Selection Dropdown (Top 10 Newest) */}
                          <div className="md:col-span-8">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                                <span>Select Batch for Item</span>
                                <span className="text-neutral-400 font-normal">(Top 10 Newest Batches)</span>
                              </label>
                              {top10Batches.length === 0 && (
                                <Link
                                  href="/batches"
                                  target="_blank"
                                  className="text-[10px] text-purple-700 hover:underline font-bold"
                                >
                                  + Create Batch in Batches
                                </Link>
                              )}
                            </div>

                            {top10Batches.length > 0 ? (
                              <select
                                value={selectedBatchId}
                                onChange={(e) =>
                                  setSelectedItemBatches((prev) => ({
                                    ...prev,
                                    [it.itemId]: e.target.value,
                                  }))
                                }
                                className="w-full bg-white text-xs font-medium text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-2xs font-mono"
                              >
                                <option value="">-- Select Created Batch (Top 10 Newest) --</option>
                                {top10Batches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.batchCodeString || `Batch #${b.batchCode}`} • Mfg: {b.manufacturingDate || "N/A"} • Exp: {b.expiryDate || "N/A"} • Avail: {b.unallocatedQuantity ?? b.manufacturedQuantity} {it.unit}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                                <span>No batches created yet for {it.itemName}.</span>
                                <Link
                                  href="/batches"
                                  target="_blank"
                                  className="px-2 py-1 bg-amber-800 text-white rounded text-[10px] font-bold"
                                >
                                  Add Batch
                                </Link>
                              </div>
                            )}
                          </div>

                          {/* Move Quantity */}
                          <div className="md:col-span-4">
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Move to Warehouse Qty ({it.unit})
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={currentMoveQty}
                              onChange={(e) =>
                                setBatchMoveQuantities((prev) => ({
                                  ...prev,
                                  [it.itemId]: e.target.value === "" ? "" : Number(e.target.value),
                                }))
                              }
                              className="w-full bg-neutral-50 text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-900 font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Store Allocation Preview */}
                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-neutral-500">Store Allocation:</span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold">
                            <Store className="w-3 h-3 text-blue-600" />
                            {batchModalTO.storeName}: {Number(currentMoveQty) || 0} {it.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dispatch Notes */}
                <div className="mt-4">
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Dispatch & Transfer Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dispatched from factory production to central warehouse via Van #2"
                    value={batchModalNotes}
                    onChange={(e) => setBatchModalNotes(e.target.value)}
                    className="w-full bg-neutral-50 text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
                <div className="text-xs text-neutral-600">
                  Total Items:{" "}
                  <strong className="font-mono text-neutral-900">
                    {batchModalTO.items.length} Products
                  </strong>{" "}
                  • Total Move Qty:{" "}
                  <strong className="font-mono text-neutral-900">
                    {Object.values(batchMoveQuantities).reduce(
                      (sum: number, q) => sum + (Number(q) || 0),
                      0
                    )}{" "}
                    Units
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchModalTO(null)}
                    disabled={savingBatches}
                    className="px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBatchDispatch}
                    disabled={savingBatches}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    {savingBatches ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Truck className="w-3.5 h-3.5" />
                    )}
                    <span>Move to Warehouse</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW DETAILS MODAL                                             */}
        {/* ============================================================== */}
        {viewingTO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Factory Transfer Slip - {viewingTO.requestNumber}
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Store: {viewingTO.storeName} ({viewingTO.requestDate})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTO(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                      Target Store
                    </span>
                    <strong className="text-neutral-900 text-sm block">
                      {viewingTO.storeName}
                    </strong>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      {viewingTO.storeAddress}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                      Transfer Status
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border mt-0.5 ${
                        getStatusBadge(viewingTO.status).badge
                      }`}
                    >
                      {getStatusBadge(viewingTO.status).label}
                    </span>
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-[11px] font-bold text-neutral-600 border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-center">Requested</th>
                        <th className="py-2.5 px-3 text-center">Factory Supplied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {viewingTO.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <strong className="text-neutral-900 block">{it.itemName}</strong>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Barcode: {it.barcodeId}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-700">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-800">
                            {it.fulfilledQuantity !== undefined
                              ? `${it.fulfilledQuantity} ${it.unit}`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {viewingTO.notes && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px]">
                    <span className="font-bold text-amber-900 block mb-0.5">Store Order Notes:</span>
                    <p className="text-amber-950">{viewingTO.notes}</p>
                  </div>
                )}

                {viewingTO.factoryNotes && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px]">
                    <span className="font-bold text-blue-900 block mb-0.5">Factory Remarks:</span>
                    <p className="text-blue-950">{viewingTO.factoryNotes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const to = viewingTO;
                    setViewingTO(null);
                    handleOpenEditTO(to);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Fulfill & Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingTO(null)}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
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
