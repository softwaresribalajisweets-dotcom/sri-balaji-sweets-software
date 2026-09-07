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
} from "firebase/firestore";
import {
  Warehouse,
  Store,
  Calendar,
  Package,
  Search,
  CheckCircle2,
  Clock,
  Pencil,
  Eye,
  Loader2,
  X,
  FileText,
  Truck,
  Layers,
  ChevronRight,
  Boxes,
  Check,
  Building2,
  Send,
  Factory,
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
  batchId?: string;
  batchCodeString?: string;
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
  storeAllocations?: Array<{
    storeId: string;
    storeName: string;
    quantity: number;
  }>;
  totalAllocated?: number;
  unallocatedQuantity?: number;
  storeRequestId?: string;
  requestNumber?: string;
  storeReceived?: boolean;
  status?: string;
  createdAt?: any;
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
  createdAt?: any;
}

export default function WarehouseTOPage() {
  const [requests, setRequests] = useState<StoreRequestDoc[]>([]);
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<
    "incoming" | "packing" | "dispatched" | "all"
  >("incoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");

  // Packing & Move to Store Modal State
  const [packingTO, setPackingTO] = useState<StoreRequestDoc | null>(null);
  const [packedQuantities, setPackedQuantities] = useState<{
    [itemId: string]: number | "";
  }>({});
  const [selectedItemBatches, setSelectedItemBatches] = useState<{
    [itemId: string]: string;
  }>({});
  const [warehouseNotes, setWarehouseNotes] = useState("");
  const [savingPacking, setSavingPacking] = useState(false);

  // View Details Modal State
  const [viewingTO, setViewingTO] = useState<StoreRequestDoc | null>(null);

  // Real-time Firestore subscription
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
        console.error("Error loading requests for warehouse TO:", err);
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
        bList.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setBatches(bList);
    });

    return () => {
      unsubReqs();
      unsubStores();
      unsubBatches();
    };
  }, []);

  // One-click Receive at Warehouse
  const handleReceiveAtWarehouse = async (reqId: string, reqNum: string) => {
    try {
      await updateDoc(doc(db, "store_requests", reqId), {
        status: "Received at Warehouse",
      });
    } catch (err: any) {
      alert(`Error receiving transfer order ${reqNum}: ${err.message}`);
    }
  };

  // Open Pack & Move to Store Modal
  const handleOpenPackTO = (req: StoreRequestDoc) => {
    setPackingTO(req);
    const initialMap: { [itemId: string]: number | "" } = {};
    const batchMap: { [itemId: string]: string } = {};

    req.items.forEach((it) => {
      initialMap[it.itemId] =
        it.packedQuantity !== undefined
          ? it.packedQuantity
          : it.fulfilledQuantity !== undefined
          ? it.fulfilledQuantity
          : it.quantity;

      // Find top created batches for this item (newest first, top 10)
      const itemBatches = batches.filter(
        (b) => b.itemId === it.itemId || b.itemBarcodeId === it.barcodeId
      );

      if (it.batchId) {
        batchMap[it.itemId] = it.batchId;
      } else if (itemBatches.length > 0) {
        batchMap[it.itemId] = itemBatches[0].id;
      }
    });

    setPackedQuantities(initialMap);
    setSelectedItemBatches(batchMap);
    setWarehouseNotes(req.warehouseNotes || "");
  };

  // Save Packed Quantities & Move to Store
  const handleConfirmMoveToStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packingTO) return;

    try {
      setSavingPacking(true);
      const updatedItems = packingTO.items.map((it) => {
        const pQty = Number(packedQuantities[it.itemId]) || 0;
        const bId = selectedItemBatches[it.itemId] || "";
        const bObj = batches.find((b) => b.id === bId);
        return {
          ...it,
          packedQuantity: pQty,
          batchId: bId || undefined,
          batchCodeString: bObj ? bObj.batchCodeString || `Batch #${bObj.batchCode}` : undefined,
        };
      });

      const totalPacked = updatedItems.reduce(
        (sum, it) => sum + (Number(it.packedQuantity) || 0),
        0
      );

      // Update batches with store allocation for this store request
      for (const it of updatedItems) {
        if (it.batchId && it.packedQuantity > 0) {
          const bDoc = batches.find((b) => b.id === it.batchId);
          if (bDoc) {
            const otherAllocations = (bDoc.storeAllocations || []).filter(
              (a) => a.storeId !== packingTO.storeId
            );
            const newAllocations = [
              ...otherAllocations,
              {
                storeId: packingTO.storeId,
                storeName: packingTO.storeName,
                quantity: it.packedQuantity,
              },
            ];
            const totalAllocated = newAllocations.reduce((sum, a) => sum + a.quantity, 0);
            const unallocated = Math.max(0, bDoc.manufacturedQuantity - totalAllocated);

            await updateDoc(doc(db, "batches", it.batchId), {
              storeAllocations: newAllocations,
              totalAllocated: totalAllocated,
              unallocatedQuantity: unallocated,
              storeRequestId: packingTO.id,
              requestNumber: packingTO.requestNumber,
              storeReceived: false, // In transit until confirmed in Store Requests
              status: "Moved to Store",
            });
          }
        }
      }

      await updateDoc(doc(db, "store_requests", packingTO.id), {
        items: updatedItems,
        totalPackedQuantity: totalPacked,
        status: "Moved to Store",
        warehouseNotes: warehouseNotes.trim(),
      });

      setPackingTO(null);
    } catch (err: any) {
      console.error("Error dispatching to store:", err);
      alert(`Failed to update shipment: ${err.message}`);
    } finally {
      setSavingPacking(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Moved to Warehouse":
        return {
          label: "Incoming from Factory",
          badge: "bg-indigo-100 text-indigo-900 border-indigo-300 font-bold",
        };
      case "Received at Warehouse":
        return {
          label: "In Warehouse Packing",
          badge: "bg-cyan-100 text-cyan-900 border-cyan-300 font-bold",
        };
      case "Moved to Store":
      case "Dispatched":
        return {
          label: "Moved to Store (In Transit)",
          badge: "bg-purple-100 text-purple-900 border-purple-300 font-bold",
        };
      case "Received at Store":
      case "Delivered":
        return {
          label: "Delivered at Store",
          badge: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
        };
      default:
        return {
          label: status,
          badge: "bg-neutral-100 text-neutral-600 border-neutral-300",
        };
    }
  };

  // Filter list for warehouse view
  const warehouseRelevantRequests = requests.filter((r) =>
    [
      "Moved to Warehouse",
      "Received at Warehouse",
      "Moved to Store",
      "Dispatched",
      "Received at Store",
      "Delivered",
    ].includes(r.status)
  );

  const filteredRequests = warehouseRelevantRequests.filter((req) => {
    const matchesSearch =
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.items.some((it) => it.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStore =
      selectedStoreFilter === "all" || req.storeId === selectedStoreFilter;

    let matchesTab = true;
    if (activeTab === "incoming") {
      matchesTab = req.status === "Moved to Warehouse";
    } else if (activeTab === "packing") {
      matchesTab = req.status === "Received at Warehouse";
    } else if (activeTab === "dispatched") {
      matchesTab = req.status === "Moved to Store" || req.status === "Dispatched";
    }

    return matchesSearch && matchesStore && matchesTab;
  });

  // KPI Metrics
  const incomingCount = requests.filter((r) => r.status === "Moved to Warehouse").length;
  const packingCount = requests.filter((r) => r.status === "Received at Warehouse").length;
  const inTransitCount = requests.filter(
    (r) => r.status === "Moved to Store" || r.status === "Dispatched"
  ).length;
  const deliveredCount = requests.filter(
    (r) => r.status === "Received at Store" || r.status === "Delivered"
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Warehouse Transfer Orders (Warehouse TO)
              </h1>
              <p className="text-xs text-neutral-500">
                Receive production stock from factory, pack shipments, and dispatch orders to branch stores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/factory-to"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Factory className="w-3.5 h-3.5" />
              <span>Factory TO</span>
            </Link>
            <Link
              href="/store-requests"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Store Requests</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab("incoming")}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "incoming"
                ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20"
                : "bg-white border-neutral-200/90 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">1. Incoming</span>
              <span className="p-1 rounded bg-indigo-100 text-indigo-800">
                <Truck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-900 font-mono">
              {incomingCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-indigo-700 font-medium">
              From Factory (Click to receive)
            </div>
          </div>

          <div
            onClick={() => setActiveTab("packing")}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "packing"
                ? "bg-cyan-50 border-cyan-300 ring-2 ring-cyan-500/20"
                : "bg-white border-neutral-200/90 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">2. In Packing</span>
              <span className="p-1 rounded bg-cyan-100 text-cyan-800">
                <Package className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-cyan-900 font-mono">
              {packingCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-cyan-700 font-medium">
              Ready to pack & dispatch
            </div>
          </div>

          <div
            onClick={() => setActiveTab("dispatched")}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "dispatched"
                ? "bg-purple-50 border-purple-300 ring-2 ring-purple-500/20"
                : "bg-white border-neutral-200/90 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">3. In Transit</span>
              <span className="p-1 rounded bg-purple-100 text-purple-800">
                <Send className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-900 font-mono">
              {inTransitCount} Shipments
            </div>
            <div className="mt-1 text-[11px] text-purple-700 font-medium">
              On the way to branch stores
            </div>
          </div>

          <div
            onClick={() => setActiveTab("all")}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
              activeTab === "all"
                ? "bg-neutral-100 border-neutral-300 ring-2 ring-neutral-500/20"
                : "bg-white border-neutral-200/90 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">4. Total Handled</span>
              <span className="p-1 rounded bg-neutral-200 text-neutral-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 font-mono">
              {warehouseRelevantRequests.length} Total
            </div>
            <div className="mt-1 text-[11px] text-emerald-700 font-medium">
              {deliveredCount} Delivered at stores
            </div>
          </div>
        </div>

        {/* Operational Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-200/60 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("incoming")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "incoming"
                  ? "bg-white text-indigo-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Incoming from Factory ({incomingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("packing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "packing"
                  ? "bg-white text-cyan-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              In Warehouse Packing ({packingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dispatched")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dispatched"
                  ? "bg-white text-purple-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Moved to Store ({inTransitCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              All Warehouse Orders ({warehouseRelevantRequests.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search TO #, store, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
              />
            </div>

            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warehouse Orders Table */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
              <span className="text-xs font-medium">Loading Warehouse Orders...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200">
                <Warehouse className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                No Transfer Orders in this Stage
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm">
                Orders dispatched by the factory will automatically arrive here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">TO Number</th>
                    <th className="py-3 px-4">Target Store</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Factory Supplied</th>
                    <th className="py-3 px-4">Packed Qty</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Warehouse Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredRequests.map((req) => {
                    const st = getStatusBadge(req.status);
                    const isIncoming = req.status === "Moved to Warehouse";
                    const isPacking = req.status === "Received at Warehouse";

                    return (
                      <tr key={req.id} className="hover:bg-neutral-50/60 transition-colors group">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewingTO(req)}
                            className="font-mono font-bold text-neutral-900 text-sm hover:text-blue-600 cursor-pointer"
                          >
                            {req.requestNumber}
                          </button>
                        </td>

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

                        <td className="py-3 px-4 font-mono text-neutral-700">
                          {req.requestDate}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 font-mono font-bold text-xs text-neutral-900 shadow-2xs">
                            <Package className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{req.items.length} {req.items.length === 1 ? "Item" : "Items"}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-blue-800 text-sm">
                          {req.totalFulfilledQuantity !== undefined
                            ? req.totalFulfilledQuantity
                            : req.totalQuantity}{" "}
                          <span className="text-xs font-normal text-neutral-500 font-sans">Units</span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-neutral-900 text-sm">
                          {req.totalPackedQuantity !== undefined ? (
                            <span>{req.totalPackedQuantity} units</span>
                          ) : (
                            <span className="text-neutral-400 font-normal italic font-sans text-xs">
                              Not packed yet
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.badge}`}
                          >
                            {st.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Step 1: Receive from Factory */}
                            {isIncoming && (
                              <button
                                type="button"
                                onClick={() => handleReceiveAtWarehouse(req.id, req.requestNumber)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                                title="Confirm stock received at warehouse"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Receive at Warehouse</span>
                              </button>
                            )}

                            {/* Step 2: Pack & Move to Store */}
                            {isPacking && (
                              <button
                                type="button"
                                onClick={() => handleOpenPackTO(req)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                                title="Verify packed quantities & dispatch to store"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Pack & Move to Store</span>
                              </button>
                            )}

                            {/* View Button */}
                            <button
                              type="button"
                              onClick={() => setViewingTO(req)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
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
        {/* PACK & MOVE TO STORE MODAL                                     */}
        {/* ============================================================== */}
        {packingTO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 my-8 overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      <span>Pack & Dispatch to Store - {packingTO.requestNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-bold border border-purple-200">
                        {packingTO.storeName}
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Select created production batches and allocate packed quantities for store delivery
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingPacking && setPackingTO(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmMoveToStore} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block">Destination Store</span>
                      <strong className="text-neutral-900">{packingTO.storeName}</strong>
                      <p className="text-[11px] text-neutral-500">{packingTO.storeAddress}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block">Request Date</span>
                      <span className="font-mono text-neutral-800">{packingTO.requestDate}</span>
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-neutral-100 text-[11px] font-bold text-neutral-600 border-b border-neutral-200">
                        <tr>
                          <th className="py-2.5 px-3">Item Name</th>
                          <th className="py-2.5 px-3 text-center">Req / Factory</th>
                          <th className="py-2.5 px-3">Select Created Batch (Top 10 Newest)</th>
                          <th className="py-2.5 px-3 text-right">Packed Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/60">
                        {packingTO.items.map((it) => {
                          const itemBatches = batches
                            .filter(
                              (b) =>
                                b.itemId === it.itemId || b.itemBarcodeId === it.barcodeId
                            )
                            .slice(0, 10);

                          const currentBatchId = selectedItemBatches[it.itemId];
                          const selectedBatch = batches.find((b) => b.id === currentBatchId);

                          return (
                            <tr key={it.itemId} className="hover:bg-neutral-50/70 transition-colors">
                              {/* Item info */}
                              <td className="py-2.5 px-3">
                                <strong className="text-neutral-900 block">{it.itemName}</strong>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  #{it.barcodeId} • {it.category}
                                </span>
                              </td>

                              {/* Req / Fulfilled */}
                              <td className="py-2.5 px-3 text-center font-mono">
                                <div className="text-neutral-700 text-xs">
                                  Req: <span className="font-bold">{it.quantity}</span> {it.unit}
                                </div>
                                <div className="text-blue-700 text-[11px] font-bold">
                                  Factory: {it.fulfilledQuantity !== undefined ? it.fulfilledQuantity : it.quantity} {it.unit}
                                </div>
                              </td>

                              {/* Batch Selection (Top 10 newest) */}
                              <td className="py-2.5 px-3">
                                {itemBatches.length === 0 ? (
                                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-1.5 rounded-md">
                                    No batches found. Batch will be auto-allocated.
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <select
                                      value={currentBatchId || ""}
                                      onChange={(e) =>
                                        setSelectedItemBatches((prev) => ({
                                          ...prev,
                                          [it.itemId]: e.target.value,
                                        }))
                                      }
                                      className="w-full bg-white text-xs font-semibold text-neutral-900 p-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900"
                                    >
                                      <option value="">-- Choose from Created Batches --</option>
                                      {itemBatches.map((b) => {
                                        const availQty =
                                          b.unallocatedQuantity !== undefined
                                            ? b.unallocatedQuantity
                                            : b.manufacturedQuantity;
                                        return (
                                          <option key={b.id} value={b.id}>
                                            {b.batchCodeString || `Batch #${b.batchCode}`} • Mfg: {b.manufacturingDate} • Exp: {b.expiryDate} ({availQty} {b.itemUnit} avail)
                                          </option>
                                        );
                                      })}
                                    </select>

                                    {selectedBatch && (
                                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 font-mono font-bold text-neutral-800">
                                          {selectedBatch.batchCodeString || `Batch #${selectedBatch.batchCode}`}
                                        </span>
                                        <span>• Mfg: {selectedBatch.manufacturingDate}</span>
                                        <span>• Exp: {selectedBatch.expiryDate}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Packed Quantity */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    required
                                    value={packedQuantities[it.itemId]}
                                    onChange={(e) =>
                                      setPackedQuantities((prev) => ({
                                        ...prev,
                                        [it.itemId]: e.target.value === "" ? "" : Number(e.target.value),
                                      }))
                                    }
                                    className="w-20 bg-white font-mono font-bold text-xs p-1.5 rounded-lg border border-neutral-300 text-right focus:outline-none focus:border-neutral-900"
                                  />
                                  <span className="text-xs font-semibold text-neutral-500">{it.unit}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Warehouse Dispatch Notes (e.g. Driver Name, Vehicle #, Carton Count)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4 cartons loaded in Van AP28-XX-1234, Driver Suresh"
                      value={warehouseNotes}
                      onChange={(e) => setWarehouseNotes(e.target.value)}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 px-6 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between rounded-b-2xl">
                  <div className="text-xs text-neutral-600">
                    Total Packed Quantity:{" "}
                    <strong className="font-mono text-purple-900 font-bold">
                      {Object.values(packedQuantities).reduce(
                        (acc: number, curr) => acc + (Number(curr) || 0),
                        0
                      )}{" "}
                      units
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPackingTO(null)}
                      disabled={savingPacking}
                      className="px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPacking}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                    >
                      {savingPacking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch to Store (Moved to Store)</span>
                    </button>
                  </div>
                </div>
              </form>
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
                      Warehouse Transfer Slip - {viewingTO.requestNumber}
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
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">Store Outlet</span>
                    <strong className="text-neutral-900 text-sm block">{viewingTO.storeName}</strong>
                    <p className="text-[11px] text-neutral-600 mt-0.5">{viewingTO.storeAddress}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">Status</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border mt-0.5 ${getStatusBadge(viewingTO.status).badge}`}>
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
                        <th className="py-2.5 px-3 text-right">Packed Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {viewingTO.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3">
                            <strong className="text-neutral-900 block">{it.itemName}</strong>
                            <span className="text-[10px] text-neutral-400 font-mono">Barcode: {it.barcodeId}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-neutral-700">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                            {it.fulfilledQuantity !== undefined ? `${it.fulfilledQuantity} ${it.unit}` : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-900">
                            {it.packedQuantity !== undefined ? `${it.packedQuantity} ${it.unit}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {viewingTO.warehouseNotes && (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-[11px]">
                    <span className="font-bold text-purple-900 block mb-0.5">Warehouse Dispatch Notes:</span>
                    <p className="text-purple-950">{viewingTO.warehouseNotes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end">
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
