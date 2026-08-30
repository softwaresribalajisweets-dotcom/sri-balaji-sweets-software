"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ClipboardList,
  Plus,
  Search,
  Store,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  Printer,
  X,
  Loader2,
  Package,
  ChevronRight,
  Filter,
  ShoppingCart,
  Send,
  Truck,
  ArrowRight,
  FileText,
  Minus,
  Check,
  Building2,
  Maximize2,
  Minimize2,
  Tag,
  Pencil,
  Boxes,
} from "lucide-react";

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber: string;
  address: string;
  city?: string;
  isMainBranch?: boolean;
}

interface ItemProduct {
  id: string;
  name: string;
  category: string;
  unit?: string;
  barcodeId: string;
  stockCount?: number;
  imageUrl?: string;
}

interface RequestItemEntry {
  itemId: string;
  itemName: string;
  category: string;
  barcodeId: string;
  unit: string;
  quantity: number;
}

interface StoreRequestDoc {
  id: string;
  requestNumber: string;
  storeId: string;
  storeName: string;
  storeMobile: string;
  storeAddress: string;
  requestDate: string; // "YYYY-MM-DD"
  items: RequestItemEntry[];
  totalQuantity: number;
  status: "Pending" | "In Progress" | "Dispatched" | "Delivered" | "Cancelled";
  notes?: string;
  createdAt?: any;
}

const DEFAULT_ITEM_IMAGE = "/default-img.png";

export default function StoreRequestsPage() {
  const [requests, setRequests] = useState<StoreRequestDoc[]>([]);
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Full Screen Add/Edit Request Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingRequestNumber, setEditingRequestNumber] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<StoreRequestDoc["status"]>("Pending");

  const [reqStoreId, setReqStoreId] = useState<string>("");
  const [reqDate, setReqDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [reqNotes, setReqNotes] = useState<string>("");
  const [selectedItemsMap, setSelectedItemsMap] = useState<{ [itemId: string]: RequestItemEntry }>({});
  const [itemSearchQuery, setItemSearchQuery] = useState<string>("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>("all");
  const [savingRequest, setSavingRequest] = useState(false);

  // View Details Modal State
  const [viewRequest, setViewRequest] = useState<StoreRequestDoc | null>(null);

  // Subscribe to store_requests, stores, and items collections
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
        console.error("Error loading store requests:", err);
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

    const qItems = query(collection(db, "items"), orderBy("name", "asc"));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const itemList: ItemProduct[] = [];
      snapshot.forEach((docSnap) => {
        itemList.push({ id: docSnap.id, ...docSnap.data() } as ItemProduct);
      });
      setItems(itemList);
    });

    return () => {
      unsubReqs();
      unsubStores();
      unsubItems();
    };
  }, []);

  // Open Full-Screen Add Request Modal
  const handleOpenAddRequest = () => {
    setEditingRequestId(null);
    setEditingRequestNumber(null);
    setEditingStatus("Pending");
    setReqStoreId(stores[0]?.id || "");
    setReqDate(new Date().toISOString().split("T")[0]);
    setReqNotes("");
    setSelectedItemsMap({});
    setItemSearchQuery("");
    setItemCategoryFilter("all");
    setIsAddModalOpen(true);
  };

  // Open Full-Screen Edit Request Modal
  const handleOpenEditRequest = (req: StoreRequestDoc) => {
    setEditingRequestId(req.id);
    setEditingRequestNumber(req.requestNumber);
    setEditingStatus(req.status);
    setReqStoreId(req.storeId);
    setReqDate(req.requestDate);
    setReqNotes(req.notes || "");

    const map: { [itemId: string]: RequestItemEntry } = {};
    if (req.items && Array.isArray(req.items)) {
      req.items.forEach((it) => {
        map[it.itemId] = {
          itemId: it.itemId,
          itemName: it.itemName,
          category: it.category || "General",
          barcodeId: it.barcodeId || "",
          unit: it.unit || "KG",
          quantity: it.quantity || 1,
        };
      });
    }
    setSelectedItemsMap(map);

    setItemSearchQuery("");
    setItemCategoryFilter("all");
    setIsAddModalOpen(true);
  };

  // Toggle or Update Item Quantity in Request
  const handleSetItemQuantity = (item: ItemProduct, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItemsMap((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    } else {
      setSelectedItemsMap((prev) => ({
        ...prev,
        [item.id]: {
          itemId: item.id,
          itemName: item.name,
          category: item.category || "General",
          barcodeId: item.barcodeId || "",
          unit: item.unit || "KG",
          quantity: quantity,
        },
      }));
    }
  };

  // Quick increment / decrement
  const handleAdjustQuantity = (item: ItemProduct, delta: number) => {
    const current = selectedItemsMap[item.id]?.quantity || 0;
    const next = Math.max(0, current + delta);
    handleSetItemQuantity(item, next);
  };

  // Compute Totals in Cart
  const requestItemsArray = Object.values(selectedItemsMap);
  const totalCartItemsCount = requestItemsArray.length;
  const totalCartQuantity = requestItemsArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  // Submit (Create or Update) Store Request
  const handleSaveStoreRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqStoreId) {
      alert("Please select a Store.");
      return;
    }

    if (requestItemsArray.length === 0) {
      alert("Please select at least one item and enter required quantity.");
      return;
    }

    const storeObj = stores.find((s) => s.id === reqStoreId);
    if (!storeObj) {
      alert("Selected store not found.");
      return;
    }

    try {
      setSavingRequest(true);

      if (editingRequestId) {
        // UPDATE EXISTING REQUEST
        await updateDoc(doc(db, "store_requests", editingRequestId), {
          storeId: storeObj.id,
          storeName: storeObj.name,
          storeMobile: storeObj.mobileNumber || "",
          storeAddress: storeObj.address || "",
          requestDate: reqDate,
          items: requestItemsArray,
          totalQuantity: totalCartQuantity,
          status: editingStatus,
          notes: reqNotes.trim(),
        });
      } else {
        // CREATE NEW REQUEST
        const reqNum = `REQ-${1000 + requests.length + 1}`;

        await addDoc(collection(db, "store_requests"), {
          requestNumber: reqNum,
          storeId: storeObj.id,
          storeName: storeObj.name,
          storeMobile: storeObj.mobileNumber || "",
          storeAddress: storeObj.address || "",
          requestDate: reqDate,
          items: requestItemsArray,
          totalQuantity: totalCartQuantity,
          status: "Pending",
          notes: reqNotes.trim(),
          createdAt: serverTimestamp(),
        });
      }

      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error saving store request:", err);
      alert(`Failed to save store request: ${err.message}`);
    } finally {
      setSavingRequest(false);
    }
  };

  // Update Status of a Request
  const handleUpdateStatus = async (
    reqId: string,
    newStatus: StoreRequestDoc["status"]
  ) => {
    try {
      await updateDoc(doc(db, "store_requests", reqId), {
        status: newStatus,
      });
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Delete Store Request
  const handleDeleteRequest = async (reqId: string, reqNum: string) => {
    if (confirm(`Are you sure you want to delete Store Request "${reqNum}"?`)) {
      try {
        await deleteDoc(doc(db, "store_requests", reqId));
      } catch (err: any) {
        alert(`Error deleting request: ${err.message}`);
      }
    }
  };

  // Filtered Requests List
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.items.some((it) => it.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStore =
      selectedStoreFilter === "all" || req.storeId === selectedStoreFilter;

    const matchesStatus =
      statusFilter === "all" || req.status === statusFilter;

    return matchesSearch && matchesStore && matchesStatus;
  });

  // Filter Catalog Items inside Modal
  const modalFilteredItems = items.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      it.barcodeId.toLowerCase().includes(itemSearchQuery.toLowerCase());
    const matchesCat =
      itemCategoryFilter === "all" || it.category === itemCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Categories List
  const categoriesList = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  // KPI Metrics
  const totalRequestsCount = requests.length;
  const pendingRequestsCount = requests.filter((r) => r.status === "Pending").length;
  const inProgressRequestsCount = requests.filter((r) => r.status === "In Progress" || r.status === "Dispatched").length;
  const deliveredRequestsCount = requests.filter((r) => r.status === "Delivered").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Store Inventory Requests
              </h1>
              <p className="text-xs text-neutral-500">
                Manage branch sweet requirements, dispatch schedules, and store order fulfillments
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handleOpenAddRequest}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Store Request</span>
          </button>
        </div>

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Total Orders Logged</span>
              <ClipboardList className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 font-mono">
              {totalRequestsCount}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Across all store outlets
            </div>
          </div>

          {/* Pending Fulfillment */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Pending Requests</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 font-mono">
              {pendingRequestsCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-amber-600 font-medium">
              Awaiting kitchen production / packing
            </div>
          </div>

          {/* In Transit / Dispatched */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">In Transit / Dispatched</span>
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600 font-mono">
              {inProgressRequestsCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-blue-500">
              Out for store delivery
            </div>
          </div>

          {/* Delivered */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Delivered / Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
              {deliveredRequestsCount} Orders
            </div>
            <div className="mt-1 text-[11px] text-emerald-600">
              Stock received by branches
            </div>
          </div>
        </div>

        {/* Filter Bar with Store Filters */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search request #, store name, or sweet item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
              />
            </div>

            {/* Store Filter Dropdown */}
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">🏢 All Stores ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            Showing <strong className="font-mono text-neutral-900">{filteredRequests.length}</strong> of{" "}
            <strong className="font-mono text-neutral-900">{requests.length}</strong> requests
          </div>
        </div>

        {/* Requests Table List */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
              <span className="text-xs font-medium">Loading Store Requests...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200">
                <ClipboardList className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                No Store Requests Recorded
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mb-5">
                Click "Create Store Request" to place stock requirements for your branch outlets.
              </p>
              <button
                type="button"
                onClick={handleOpenAddRequest}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Request</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Store Outlet</th>
                    <th className="py-3 px-4">Requested Date</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Total Quantity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-neutral-50/60 transition-colors group">
                      {/* Request # */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setViewRequest(req)}
                          className="font-mono font-bold text-neutral-900 text-sm hover:text-blue-600 transition-colors cursor-pointer"
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

                      {/* Requested Date */}
                      <td className="py-3 px-4 font-mono text-neutral-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{req.requestDate}</span>
                        </div>
                      </td>

                      {/* Items Count Only */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 font-mono font-bold text-xs text-neutral-900 shadow-2xs">
                          <Package className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{req.items.length} {req.items.length === 1 ? "Item" : "Items"}</span>
                        </span>
                      </td>

                      {/* Total Quantity */}
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900 text-sm">
                        {req.totalQuantity} <span className="text-xs font-normal text-neutral-500 font-sans">Units</span>
                      </td>

                      {/* Status Dropdown / Badge */}
                      <td className="py-3 px-4">
                        <select
                          value={req.status}
                          onChange={(e) =>
                            handleUpdateStatus(req.id, e.target.value as StoreRequestDoc["status"])
                          }
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                            req.status === "Pending"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : req.status === "In Progress"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : req.status === "Dispatched"
                              ? "bg-purple-50 text-purple-800 border-purple-300"
                              : req.status === "Delivered"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-neutral-100 text-neutral-600 border-neutral-300"
                          }`}
                        >
                          <option value="Pending">🟡 Pending</option>
                          <option value="In Progress">🔵 In Progress</option>
                          <option value="Dispatched">🟣 Dispatched</option>
                          <option value="Delivered">🟢 Delivered</option>
                          <option value="Cancelled">⚪ Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setViewRequest(req)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                            title="View Request Slip"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditRequest(req)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Edit Store Request"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req.id, req.requestNumber)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* FULL SCREEN MODAL: CREATE OR EDIT STORE INVENTORY REQUEST     */}
        {/* ============================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-between">
            <div className="bg-white w-full h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Top Modal Header */}
              <div className="h-16 px-6 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/10 text-white">
                    {editingRequestId ? <Pencil className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {editingRequestId
                        ? `Edit Store Request - ${editingRequestNumber}`
                        : "Create Store Inventory Request"}
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {editingRequestId
                        ? "Modify requested items, quantities, delivery date, or store destination"
                        : "Select target store outlet, requested delivery date, and pick items with required quantities"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => !savingRequest && setIsAddModalOpen(false)}
                    className="p-2 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body (Split Screen: Left Store & Catalog Items, Right Order Cart) */}
              <form onSubmit={handleSaveStoreRequest} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
                  {/* LEFT PANE (7 Cols): Store Configuration & Item Catalog Selection */}
                  <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5 border-r border-neutral-200 bg-neutral-50/40">
                    {/* Store & Date Row */}
                    <div className="p-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-neutral-700" />
                          Step 1: Store & Delivery Date
                        </span>

                        {editingRequestId && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-600">Status:</span>
                            <select
                              value={editingStatus}
                              onChange={(e) =>
                                setEditingStatus(e.target.value as StoreRequestDoc["status"])
                              }
                              className="text-xs font-bold px-2 py-1 rounded-md border border-neutral-300 bg-neutral-50"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Dispatched">Dispatched</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Store Selection */}
                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Target Store Outlet <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={reqStoreId}
                            onChange={(e) => setReqStoreId(e.target.value)}
                            disabled={savingRequest}
                            className="w-full bg-white text-xs font-bold text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                          >
                            {stores.length === 0 && (
                              <option value="">No stores found. Add a store first.</option>
                            )}
                            {stores.map((s) => (
                              <option key={s.id} value={s.id}>
                                🏢 {s.name} {s.isMainBranch ? "(Main Branch)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Request Date (Defaults to Today, can select other dates) */}
                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Requested Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={reqDate}
                            onChange={(e) => setReqDate(e.target.value)}
                            disabled={savingRequest}
                            className="w-full bg-white text-xs font-mono font-bold text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          Order Instructions / Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Deliver before 10 AM for morning festive sales"
                          value={reqNotes}
                          onChange={(e) => setReqNotes(e.target.value)}
                          disabled={savingRequest}
                          className="w-full bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Step 2: Browse Catalog Items */}
                    <div className="p-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-neutral-700" />
                          Step 2: Browse & Select Items
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          {modalFilteredItems.length} products available
                        </span>
                      </div>

                      {/* Item Search & Category Filter */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                          <input
                            type="text"
                            placeholder="Search sweet product name or barcode..."
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
                          />
                        </div>

                        <select
                          value={itemCategoryFilter}
                          onChange={(e) => setItemCategoryFilter(e.target.value)}
                          className="bg-white text-xs text-neutral-700 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
                        >
                          <option value="all">All Categories</option>
                          {categoriesList.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Items Grid / List with Direct Quantity Adjuster */}
                      <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-xl bg-neutral-50/50">
                        {modalFilteredItems.map((item) => {
                          const selectedQty = selectedItemsMap[item.id]?.quantity || 0;
                          const isSelected = selectedQty > 0;

                          return (
                            <div
                              key={item.id}
                              className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                                isSelected ? "bg-amber-50/70" : "hover:bg-neutral-50 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                                  alt={item.name}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                                  }}
                                  className="w-10 h-10 object-cover rounded-lg border border-neutral-200 shrink-0 shadow-2xs"
                                />
                                <div className="min-w-0">
                                  <h4 className="font-bold text-neutral-900 text-xs truncate">
                                    {item.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                                    <span className="font-medium text-neutral-700">
                                      Unit: {item.unit || "KG"}
                                    </span>
                                    <span>•</span>
                                    <span className="font-mono text-[10px]">
                                      ID: {item.barcodeId}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Quantity Selector on the Right */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isSelected ? (
                                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-amber-300 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustQuantity(item, -5)}
                                      className="w-6 h-6 rounded flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold cursor-pointer"
                                      title="-5"
                                    >
                                      -
                                    </button>

                                    <input
                                      type="number"
                                      min={1}
                                      value={selectedQty}
                                      onChange={(e) =>
                                        handleSetItemQuantity(
                                          item,
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-14 text-center text-xs font-bold font-mono text-neutral-900 border-0 focus:outline-none"
                                    />

                                    <span className="text-[10px] text-neutral-500 pr-1">
                                      {item.unit || "KG"}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleAdjustQuantity(item, 5)}
                                      className="w-6 h-6 rounded flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                                      title="+5"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSetItemQuantity(item, 10)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Item</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANE (5 Cols): Selected Items Cart & Order Review */}
                  <div className="lg:col-span-5 p-6 overflow-y-auto flex flex-col justify-between space-y-4 bg-white">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-neutral-700" />
                          Requested Items Cart ({totalCartItemsCount})
                        </span>
                        {totalCartItemsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedItemsMap({})}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-800 cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {totalCartItemsCount === 0 ? (
                        <div className="p-12 text-center text-neutral-400 flex flex-col items-center justify-center">
                          <ShoppingCart className="w-8 h-8 text-neutral-300 mb-2" />
                          <p className="text-xs font-medium">No items added to request yet.</p>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            Click "+ Add Item" on the left catalog to specify quantities.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                          {requestItemsArray.map((it) => (
                            <div
                              key={it.itemId}
                              className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <h5 className="font-bold text-neutral-900 text-xs truncate">
                                  {it.itemName}
                                </h5>
                                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                                  Required Quantity:{" "}
                                  <strong className="text-neutral-900 font-bold">
                                    {it.quantity} {it.unit}
                                  </strong>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const found = items.find((i) => i.id === it.itemId);
                                      if (found) handleAdjustQuantity(found, -5);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-xs px-1 text-neutral-900">
                                    {it.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const found = items.find((i) => i.id === it.itemId);
                                      if (found) handleAdjustQuantity(found, 5);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const found = items.find((i) => i.id === it.itemId);
                                    if (found) handleSetItemQuantity(found, 0);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-red-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary & Submit Box */}
                    <div className="p-4 bg-neutral-900 text-white rounded-2xl space-y-3 shadow-md">
                      <div className="flex items-center justify-between text-xs text-neutral-300">
                        <span>Total Items Types:</span>
                        <strong className="font-mono text-white text-sm">
                          {totalCartItemsCount} Items
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-xs text-neutral-300 pt-2 border-t border-neutral-700">
                        <span className="font-bold text-white">Total Requested Quantity:</span>
                        <strong className="font-mono text-amber-400 text-base font-bold">
                          {totalCartQuantity} Units
                        </strong>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(false)}
                          disabled={savingRequest}
                          className="w-1/3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={savingRequest || totalCartItemsCount === 0 || !reqStoreId}
                          className="w-2/3 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                        >
                          {savingRequest ? (
                            <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                          ) : (
                            <Send className="w-4 h-4 text-neutral-950" />
                          )}
                          <span>
                            {editingRequestId ? "Update & Save Request" : "Save & Dispatch Request"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW REQUEST SLIP / DETAILS MODAL                              */}
        {/* ============================================================== */}
        {viewRequest && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Store Request - {viewRequest.requestNumber}
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Target: {viewRequest.storeName} ({viewRequest.requestDate})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewRequest(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                {/* Store Header Info */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                      Target Store
                    </span>
                    <strong className="text-neutral-900 text-sm block">
                      {viewRequest.storeName}
                    </strong>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      {viewRequest.storeAddress}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                      Delivery / Request Date
                    </span>
                    <strong className="text-neutral-900 text-sm font-mono block">
                      {viewRequest.requestDate}
                    </strong>
                    <span className="text-[10px] text-neutral-500">
                      Status: <strong>{viewRequest.status}</strong>
                    </span>
                  </div>
                </div>

                {/* Items Breakdown Table */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100/70 border-b border-neutral-200 text-[11px] font-bold text-neutral-600">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Requested Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60">
                      {viewRequest.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 text-neutral-400 font-mono font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-neutral-900">
                            {it.itemName}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600">
                            {it.category || "General"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 text-right">
                            {it.quantity} {it.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-neutral-800">
                          Total Quantity Required
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-900 text-right">
                          {viewRequest.totalQuantity} units
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {viewRequest.notes && (
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px]">
                    <span className="font-bold text-amber-900 block mb-0.5">Order Notes:</span>
                    <p className="text-amber-950">{viewRequest.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const req = viewRequest;
                      setViewRequest(null);
                      handleOpenEditRequest(req);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewRequest(null)}
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
