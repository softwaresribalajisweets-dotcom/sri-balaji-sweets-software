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
} from "firebase/firestore";
import {
  Boxes,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Loader2,
  X,
  Package,
  Barcode,
  Eye,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  Store,
  Layers,
  Sparkles,
  Building2,
  SlidersHorizontal,
  ArrowRight,
  Percent,
} from "lucide-react";
import Link from "next/link";

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

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isMainBranch?: boolean;
  status?: "Active" | "Inactive";
  createdAt?: any;
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
  batchCode: number; // Item-specific numeric: 1, 2, 3...
  batchCodeString: string; // "Batch #1"
  manufacturedQuantity: number;
  manufacturingDate: string; // "YYYY-MM-DD"
  expiryDays: number;
  expiryDate: string; // "YYYY-MM-DD"
  notes?: string;
  storeAllocations?: StoreAllocation[];
  totalAllocated?: number;
  unallocatedQuantity?: number;
  createdAt?: any;
}

const DEFAULT_ITEM_IMAGE = "/default-img.png";
const PRESET_EXPIRY_DAYS = [2, 3, 4, 5, 7, 10, 15, 30, 45, 90];
const ITEMS_PER_PAGE = 45;

export default function ItemBatchesPage() {
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingStores, setLoadingStores] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [batchStatusFilter, setBatchStatusFilter] = useState<"all" | "active" | "expired" | "no_batches">("all");
  const [activeTab, setActiveTab] = useState<"items_view" | "logs_view">("items_view");

  // Pagination State (45 items per page)
  const [currentPage, setCurrentPage] = useState(1);

  // Add Batch Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemProduct | null>(null);
  const [autoBatchNumber, setAutoBatchNumber] = useState<number>(1);
  const [manufacturedQuantity, setManufacturedQuantity] = useState<number | "">(50);
  const [mfgDate, setMfgDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [expiryDays, setExpiryDays] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);

  // Store Arrangement / Stock Allocation State for Add Batch
  const [storeAllocations, setStoreAllocations] = useState<{
    storeId: string;
    storeName: string;
    quantity: number | "";
  }[]>([]);
  const [selectedStoreToAdd, setSelectedStoreToAdd] = useState<string>("");

  // View Item's Batches Modal State
  const [viewingItemBatches, setViewingItemBatches] = useState<ItemProduct | null>(null);

  // Single Batch Details Modal State
  const [viewBatchDetails, setViewBatchDetails] = useState<ItemBatch | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Helper to compute expiry date from mfg date + days
  const computeExpiryDate = (mfg: string, days: number): string => {
    if (!mfg) return "";
    const d = new Date(mfg);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().split("T")[0];
  };

  const calculatedExpiryDate = computeExpiryDate(mfgDate, expiryDays);

  // Computed values for Store Arrangement
  const totalMfgQty = Number(manufacturedQuantity) || 0;
  const totalAllocatedQty = storeAllocations.reduce(
    (sum, a) => sum + (Number(a.quantity) || 0),
    0
  );
  const unallocatedQty = Math.max(0, totalMfgQty - totalAllocatedQty);
  const isOverAllocated = totalAllocatedQty > totalMfgQty;
  const allocationPercentage = totalMfgQty > 0
    ? Math.min(100, Math.round((totalAllocatedQty / totalMfgQty) * 100))
    : 0;

  // Subscribe to Items, Batches, and Stores
  useEffect(() => {
    const qItems = query(collection(db, "items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(
      qItems,
      (snapshot) => {
        const itemList: ItemProduct[] = [];
        snapshot.forEach((docSnap) => {
          itemList.push({ id: docSnap.id, ...docSnap.data() } as ItemProduct);
        });
        setItems(itemList);
        setLoadingItems(false);
      },
      (err) => {
        console.error("Error loading items:", err);
        setLoadingItems(false);
      }
    );

    const qBatches = query(collection(db, "batches"), orderBy("createdAt", "desc"));
    const unsubscribeBatches = onSnapshot(
      qBatches,
      (snapshot) => {
        const batchList: ItemBatch[] = [];
        snapshot.forEach((docSnap) => {
          batchList.push({ id: docSnap.id, ...docSnap.data() } as ItemBatch);
        });
        setBatches(batchList);
        setLoadingBatches(false);
      },
      (err) => {
        console.error("Error loading batches:", err);
        setLoadingBatches(false);
      }
    );

    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubscribeStores = onSnapshot(
      qStores,
      (snapshot) => {
        const storeList: StoreBranch[] = [];
        snapshot.forEach((docSnap) => {
          storeList.push({ id: docSnap.id, ...docSnap.data() } as StoreBranch);
        });
        setStores(storeList);
        setLoadingStores(false);
      },
      (err) => {
        console.error("Error loading stores:", err);
        setLoadingStores(false);
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeBatches();
      unsubscribeStores();
    };
  }, []);

  // Compute next item-specific numeric batch code
  const getNextBatchNumberForItem = (itemId: string): number => {
    if (!itemId) return 1;
    const itemBatches = batches.filter((b) => b.itemId === itemId);
    if (itemBatches.length === 0) return 1;
    const maxCode = Math.max(...itemBatches.map((b) => Number(b.batchCode) || 0), 0);
    return maxCode + 1;
  };

  // Open Add Batch Modal
  const handleOpenAddBatch = (item?: ItemProduct) => {
    const target = item || items[0] || null;
    setSelectedItem(target);
    const targetId = target ? target.id : "";
    const nextNum = getNextBatchNumberForItem(targetId);
    setAutoBatchNumber(nextNum);

    setMfgDate(new Date().toISOString().split("T")[0]);
    setExpiryDays(3);
    setManufacturedQuantity(50);
    setNotes("");
    setStoreAllocations([]);
    setSelectedStoreToAdd("");
    setIsAddModalOpen(true);
  };

  // When changing item in Add Batch Modal
  const handleSelectItemChange = (itemId: string) => {
    const found = items.find((i) => i.id === itemId) || null;
    setSelectedItem(found);
    const nextNum = getNextBatchNumberForItem(itemId);
    setAutoBatchNumber(nextNum);
  };

  // Store Allocation Handlers
  const handleAddStoreAllocation = (storeId: string) => {
    if (!storeId) return;
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;
    if (storeAllocations.some((a) => a.storeId === storeId)) return;

    // Default allocation can be remaining unallocated quantity
    const remaining = Math.max(0, totalMfgQty - totalAllocatedQty);
    setStoreAllocations((prev) => [
      ...prev,
      {
        storeId: store.id,
        storeName: store.name,
        quantity: remaining > 0 ? remaining : "",
      },
    ]);
    setSelectedStoreToAdd("");
  };

  const handleStoreQtyChange = (storeId: string, val: number | "") => {
    setStoreAllocations((prev) =>
      prev.map((a) => (a.storeId === storeId ? { ...a, quantity: val } : a))
    );
  };

  const handleRemoveStoreAllocation = (storeId: string) => {
    setStoreAllocations((prev) => prev.filter((a) => a.storeId !== storeId));
  };

  const handleFillRemaining = (storeId: string) => {
    const currentStoreQty = Number(storeAllocations.find((a) => a.storeId === storeId)?.quantity) || 0;
    const available = Math.max(0, totalMfgQty - (totalAllocatedQty - currentStoreQty));
    handleStoreQtyChange(storeId, available > 0 ? available : 0);
  };

  const handleDistributeEqually = () => {
    if (storeAllocations.length === 0 || totalMfgQty <= 0) return;
    const equalQty = Math.floor((totalMfgQty / storeAllocations.length) * 100) / 100;
    setStoreAllocations((prev) =>
      prev.map((a) => ({ ...a, quantity: equalQty }))
    );
  };

  const handleAddAllStores = () => {
    const unadded = stores.filter(
      (s) => s.status !== "Inactive" && !storeAllocations.some((a) => a.storeId === s.id)
    );
    if (unadded.length === 0) return;
    setStoreAllocations((prev) => [
      ...prev,
      ...unadded.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        quantity: "" as const,
      })),
    ]);
  };

  // Save Batch to Firestore
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || manufacturedQuantity === "" || !mfgDate) {
      alert("Please fill in all required fields.");
      return;
    }

    if (isOverAllocated) {
      alert(
        `Total allocated to stores (${totalAllocatedQty} ${selectedItem.unit || "KG"}) exceeds total batch quantity (${manufacturedQuantity} ${selectedItem.unit || "KG"}). Please adjust store quantities before saving.`
      );
      return;
    }

    try {
      setSavingBatch(true);
      const nextBatchCode = getNextBatchNumberForItem(selectedItem.id);
      const expDate = computeExpiryDate(mfgDate, expiryDays);

      const cleanAllocations = storeAllocations
        .filter((a) => Number(a.quantity) > 0)
        .map((a) => ({
          storeId: a.storeId,
          storeName: a.storeName,
          quantity: Number(a.quantity),
        }));

      const totalAllocated = cleanAllocations.reduce((sum, a) => sum + a.quantity, 0);
      const unallocated = Math.max(0, Number(manufacturedQuantity) - totalAllocated);

      await addDoc(collection(db, "batches"), {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        itemCategory: selectedItem.category || "Sweets",
        itemBarcodeId: selectedItem.barcodeId || "7707",
        itemUnit: selectedItem.unit || "KG",
        batchCode: nextBatchCode,
        batchCodeString: `Batch #${nextBatchCode}`,
        manufacturedQuantity: Number(manufacturedQuantity),
        manufacturingDate: mfgDate,
        expiryDays: Number(expiryDays),
        expiryDate: expDate,
        notes: notes.trim(),
        storeAllocations: cleanAllocations,
        totalAllocated: totalAllocated,
        unallocatedQuantity: unallocated,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error creating batch:", err);
      alert(`Error saving batch: ${err.message}`);
    } finally {
      setSavingBatch(false);
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (id: string, batchLabel: string, itemName: string) => {
    if (confirm(`Are you sure you want to delete ${batchLabel} for "${itemName}"?`)) {
      try {
        await deleteDoc(doc(db, "batches", id));
      } catch (err: any) {
        alert(`Error deleting batch: ${err.message}`);
      }
    }
  };

  // Batch Status Helper
  const getBatchStatusInfo = (expiryDateStr: string) => {
    if (!expiryDateStr) return { status: "active", label: "Active", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200", daysDiff: 99 };

    const today = new Date(todayStr).getTime();
    const exp = new Date(expiryDateStr).getTime();
    const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        label: `Expired (${Math.abs(diffDays)}d ago)`,
        badgeClass: "bg-red-100 text-red-800 border-red-200",
        daysDiff: diffDays,
      };
    } else if (diffDays === 0) {
      return {
        status: "expiring",
        label: "Expires Today",
        badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
        daysDiff: 0,
      };
    } else if (diffDays <= 2) {
      return {
        status: "expiring",
        label: `Expiring Soon (${diffDays}d left)`,
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        daysDiff: diffDays,
      };
    } else {
      return {
        status: "active",
        label: `Active (${diffDays}d left)`,
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        daysDiff: diffDays,
      };
    }
  };

  // Item Batches Aggregation Helper
  const getItemBatchMetrics = (itemId: string) => {
    const itemBatches = batches.filter((b) => b.itemId === itemId);
    const activeBatches = itemBatches.filter((b) => getBatchStatusInfo(b.expiryDate).status === "active");
    const expiringBatches = itemBatches.filter((b) => getBatchStatusInfo(b.expiryDate).status === "expiring");
    const expiredBatches = itemBatches.filter((b) => getBatchStatusInfo(b.expiryDate).status === "expired");

    const totalActiveQty = activeBatches.reduce((acc, curr) => acc + (Number(curr.manufacturedQuantity) || 0), 0);
    const nextBatchCode = getNextBatchNumberForItem(itemId);

    return {
      allBatches: itemBatches,
      activeCount: activeBatches.length,
      expiringCount: expiringBatches.length,
      expiredCount: expiredBatches.length,
      totalActiveQty,
      nextBatchCode,
    };
  };

  // Filter Items List
  const filteredItems = items.filter((item) => {
    const metrics = getItemBatchMetrics(item.id);

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat =
      categoryFilter === "all" || item.category.toLowerCase() === categoryFilter.toLowerCase();

    const matchesBatchFilter =
      batchStatusFilter === "all" ||
      (batchStatusFilter === "active" && metrics.activeCount > 0) ||
      (batchStatusFilter === "expired" && metrics.expiredCount > 0) ||
      (batchStatusFilter === "no_batches" && metrics.allBatches.length === 0);

    return matchesSearch && matchesCat && matchesBatchFilter;
  });

  // Calculate Pagination Slices (45 items per page)
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, batchStatusFilter]);

  // Overall Global KPI Metrics
  const totalCatalogItems = items.length;
  const itemsWithActiveBatches = items.filter((i) => getItemBatchMetrics(i.id).activeCount > 0).length;
  const totalActiveBatchesCount = batches.filter((b) => getBatchStatusInfo(b.expiryDate).status === "active").length;
  const totalExpiredBatchesCount = batches.filter((b) => getBatchStatusInfo(b.expiryDate).status === "expired").length;

  const categoriesList = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header & Page Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Item Batches & Production Tracking
              </h1>
              <p className="text-xs text-neutral-500">
                All sweet products with item-specific batch codes, active batches, and expired shelf-life monitoring
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/barcode-generator"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Barcode className="w-3.5 h-3.5 text-neutral-600" />
              <span>Barcode Generator</span>
            </Link>

            <button
              type="button"
              onClick={() => handleOpenAddBatch()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Batch</span>
            </button>
          </div>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Catalog Items */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Total Sweet Products</span>
              <Package className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 font-mono">
              {totalCatalogItems}
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Items in store catalog
            </div>
          </div>

          {/* Products with Active Batches */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Active Production Items</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
              {itemsWithActiveBatches} Products
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-medium">
              {totalActiveBatchesCount} active fresh batches running
            </div>
          </div>

          {/* Expired Batches Alert */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Expired Batches Alert</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600 font-mono">
              {totalExpiredBatchesCount} Batches
            </div>
            <div className="mt-1 text-[11px] text-red-500 font-medium">
              Needs clearance / kitchen review
            </div>
          </div>

          {/* Total Batches Recorded */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Total Production Logs</span>
              <Boxes className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-700 font-mono">
              {batches.length} Logs
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Historical batches generated
            </div>
          </div>
        </div>

        {/* View Toggle Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-2">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setBatchStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                batchStatusFilter === "all"
                  ? "bg-neutral-900 text-white shadow-xs"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              }`}
            >
              All Items ({items.length})
            </button>

            <button
              type="button"
              onClick={() => setBatchStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                batchStatusFilter === "active"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-white text-emerald-700 hover:bg-emerald-50 border border-neutral-200"
              }`}
            >
              Active Batches ({itemsWithActiveBatches})
            </button>

            <button
              type="button"
              onClick={() => setBatchStatusFilter("expired")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                batchStatusFilter === "expired"
                  ? "bg-red-700 text-white shadow-xs"
                  : "bg-white text-red-700 hover:bg-red-50 border border-neutral-200"
              }`}
            >
              Has Expired Batches ({items.filter((i) => getItemBatchMetrics(i.id).expiredCount > 0).length})
            </button>

            <button
              type="button"
              onClick={() => setBatchStatusFilter("no_batches")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                batchStatusFilter === "no_batches"
                  ? "bg-neutral-700 text-white shadow-xs"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              }`}
            >
              No Batches ({items.filter((i) => getItemBatchMetrics(i.id).allBatches.length === 0).length})
            </button>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center gap-1 bg-neutral-200/70 p-0.5 rounded-lg border border-neutral-300/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("items_view")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === "items_view"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Items Production Table
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("logs_view")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === "logs_view"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              All Batch Logs ({batches.length})
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: MAIN ITEMS BATCHES TABLE (Primary View with 45 Items)   */}
        {/* ============================================================== */}
        {activeTab === "items_view" && (
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
            {/* Search & Category Header */}
            <div className="p-3 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, barcode ID, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white text-xs text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-neutral-500 font-medium">
                Page <strong className="font-mono text-neutral-900">{currentPage}</strong> of{" "}
                <strong className="font-mono text-neutral-900">{totalPages}</strong>
              </div>
            </div>

            {/* Data Table */}
            {loadingItems ? (
              <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
                <span className="text-xs font-medium">Loading Items & Batches...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200/60">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-1">
                  No matching products found
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mb-4">
                  Adjust your search keyword or category filter to view sweet items.
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="py-3 px-4 w-12">Image</th>
                        <th className="py-3 px-4">Product & Barcode</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Price / Unit</th>
                        <th className="py-3 px-4">Active Batches</th>
                        <th className="py-3 px-4">Expired / Alerts</th>
                        <th className="py-3 px-4">Next Batch #</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60 text-xs">
                      {paginatedItems.map((item) => {
                        const metrics = getItemBatchMetrics(item.id);

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-neutral-50/60 transition-colors group"
                          >
                            {/* Image */}
                            <td className="py-3 px-4">
                              <img
                                src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                                alt={item.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                                }}
                                className="w-9 h-9 object-cover rounded-lg border border-neutral-200 shadow-2xs"
                              />
                            </td>

                            {/* Product Name & Barcode */}
                            <td className="py-3 px-4">
                              <span className="font-bold text-neutral-900 text-sm block">
                                {item.name}
                              </span>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 inline-flex items-center gap-1 mt-0.5">
                                <Barcode className="w-3 h-3 text-neutral-500" />
                                {item.barcodeId}
                              </span>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-4 font-semibold text-neutral-700">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 border border-neutral-200">
                                <Tag className="w-3 h-3 text-neutral-500" />
                                {item.category}
                              </span>
                            </td>

                            {/* Price / Unit */}
                            <td className="py-3 px-4 font-bold text-neutral-900 font-mono">
                              ₹{item.price.toFixed(2)}{" "}
                              <span className="text-[11px] font-normal text-neutral-500 font-sans">
                                / {item.unit || "KG"}
                              </span>
                            </td>

                            {/* Active Batches Column */}
                            <td className="py-3 px-4">
                              {metrics.activeCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingItemBatches(item)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                  title="Click to view all active batches"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{metrics.activeCount} Active</span>
                                  <span className="font-mono text-[10px] text-emerald-600 font-normal">
                                    ({metrics.totalActiveQty} {item.unit || "KG"})
                                  </span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium text-neutral-400 bg-neutral-50 border border-neutral-200">
                                  0 Active
                                </span>
                              )}
                            </td>

                            {/* Expired / Expiring Batches Column */}
                            <td className="py-3 px-4">
                              {metrics.expiredCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingItemBatches(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 cursor-pointer"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                  <span>{metrics.expiredCount} Expired</span>
                                </button>
                              ) : metrics.expiringCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingItemBatches(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{metrics.expiringCount} Expiring Soon</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-neutral-400">
                                  0 Expired
                                </span>
                              )}
                            </td>

                            {/* Next Batch # (Item Specific Starting from 1) */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono font-bold text-xs">
                                Batch #{metrics.nextBatchCode}
                              </span>
                            </td>

                            {/* Actions Column */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Direct Add Batch for this Item */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddBatch(item)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                  title={`Add Batch #${metrics.nextBatchCode} for ${item.name}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Batch</span>
                                </button>

                                {/* View All Batches Drawer/Modal */}
                                {metrics.allBatches.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingItemBatches(item)}
                                    className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                                    title="View all batches for this product"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
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

                {/* Pagination Controls Bar (45 items/page) */}
                <div className="p-3.5 bg-neutral-50/80 border-t border-neutral-200/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-neutral-600 font-medium">
                    <span>
                      Showing <strong className="font-mono text-neutral-900">{filteredItems.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
                      <strong className="font-mono text-neutral-900">
                        {Math.min(endIndex, filteredItems.length)}
                      </strong>{" "}
                      of <strong className="font-mono text-neutral-900">{filteredItems.length}</strong> products
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-200/60 text-neutral-700 text-[11px] font-medium">
                      45 items / page
                    </span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="First Page"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      {/* Numbered Page Buttons with Ellipsis */}
                      <div className="flex items-center gap-1 px-1">
                        {(() => {
                          const range: (number | string)[] = [];
                          if (totalPages <= 7) {
                            for (let i = 1; i <= totalPages; i++) range.push(i);
                          } else if (currentPage <= 4) {
                            range.push(1, 2, 3, 4, 5, "...", totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            range.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                          } else {
                            range.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
                          }

                          return range.map((page, idx) => {
                            if (typeof page === "string") {
                              return (
                                <span key={`ellipsis-${idx}`} className="px-1 text-neutral-400 font-mono select-none">
                                  ...
                                </span>
                              );
                            }
                            return (
                              <button
                                key={`page-${page}`}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentPage === page
                                    ? "bg-neutral-900 text-white shadow-xs"
                                    : "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-100"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Last Page"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: ALL BATCH LOGS TABLE (Historical Production Logs)      */}
        {/* ============================================================== */}
        {activeTab === "logs_view" && (
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-neutral-200/80 flex items-center justify-between bg-neutral-50/50">
              <span className="text-xs font-bold text-neutral-800">
                All Production Logs ({batches.length} Batches)
              </span>
            </div>

            {batches.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                <Boxes className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                <p className="text-xs">No batches recorded yet. Click "Add New Batch" to start.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Product Name & Barcode</th>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Manufactured Qty</th>
                      <th className="py-3 px-4">Mfg Date</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4">Store Arrangement</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 text-xs">
                    {batches.map((batch) => {
                      const st = getBatchStatusInfo(batch.expiryDate);

                      return (
                        <tr key={batch.id} className="hover:bg-neutral-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <strong className="text-neutral-900 block">{batch.itemName}</strong>
                            <span className="text-[10px] font-mono text-neutral-500">
                              Barcode: {batch.itemBarcodeId}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-purple-800">
                            {batch.batchCodeString}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                            {batch.manufacturedQuantity} {batch.itemUnit}
                          </td>

                          <td className="py-3 px-4 font-mono text-neutral-700">
                            {batch.manufacturingDate}
                          </td>

                          <td className="py-3 px-4 font-mono text-neutral-900">
                            {batch.expiryDate}
                            <span className="text-[10px] text-neutral-400 block font-sans">
                              ({batch.expiryDays} days)
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {batch.storeAllocations && batch.storeAllocations.length > 0 ? (
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1 items-center max-w-xs">
                                  {batch.storeAllocations.map((alloc, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold"
                                    >
                                      <Store className="w-3 h-3 text-blue-600" />
                                      <span>{alloc.storeName}:</span>
                                      <strong className="font-mono">{alloc.quantity} {batch.itemUnit}</strong>
                                    </span>
                                  ))}
                                </div>
                                {batch.unallocatedQuantity && batch.unallocatedQuantity > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                    Factory Buffer: <strong className="font-mono">{batch.unallocatedQuantity} {batch.itemUnit}</strong>
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-neutral-400 text-[11px] italic">
                                <Package className="w-3 h-3 text-neutral-400" />
                                Central Factory Stock
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.badgeClass}`}>
                              {st.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteBatch(batch.id, batch.batchCodeString, batch.itemName)
                              }
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Delete Batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* ============================================================== */}
        {/* ADD BATCH MODAL                                                */}
        {/* ============================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 my-8 overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                      <span>Add Item Batch</span>
                      {selectedItem && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono font-bold border border-purple-200">
                          Batch #{autoBatchNumber}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Generate item-specific batch code and arrange stock distribution across branch stores
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingBatch && setIsAddModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveBatch} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Batch & Production Details */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="pb-2 border-b border-neutral-200/80 flex items-center gap-2">
                        <Package className="w-4 h-4 text-neutral-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                          1. Production Details
                        </h4>
                      </div>

                      {/* 1. Select Item */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">
                          Select Sweet Product <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={selectedItem?.id || ""}
                          onChange={(e) => handleSelectItemChange(e.target.value)}
                          disabled={savingBatch}
                          className="w-full bg-white text-xs font-medium text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-2xs"
                        >
                          <option value="">-- Select Product --</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (Barcode: {i.barcodeId}) - ₹{i.price}/{i.unit || "KG"}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Auto-generated Item-Specific Batch Code Badge */}
                      <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-purple-900 block">
                            Auto-Generated Batch Code
                          </span>
                          <p className="text-[10px] text-purple-700">
                            Sequential batch #{autoBatchNumber} for {selectedItem ? selectedItem.name : "selected product"}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg bg-purple-700 text-white font-mono font-bold text-sm shadow-xs">
                          Batch #{autoBatchNumber}
                        </span>
                      </div>

                      {/* 3. Manufactured Quantity & Unit */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Manufactured Qty <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={0.1}
                            step="any"
                            required
                            placeholder="e.g. 50"
                            value={manufacturedQuantity}
                            onChange={(e) =>
                              setManufacturedQuantity(
                                e.target.value === "" ? "" : Number(e.target.value)
                              )
                            }
                            disabled={savingBatch}
                            className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Product Unit
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={selectedItem?.unit || "KG"}
                            className="w-full bg-neutral-100 text-xs font-bold font-mono text-neutral-600 p-2.5 rounded-lg border border-neutral-300 cursor-not-allowed shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* 4. Manufacturing Date & Shelf Life Days */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Mfg Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={mfgDate}
                            onChange={(e) => setMfgDate(e.target.value)}
                            disabled={savingBatch}
                            className="w-full bg-white text-xs font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-neutral-700 mb-1">
                            Expiry Days <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            required
                            placeholder="e.g. 3"
                            value={expiryDays}
                            onChange={(e) => setExpiryDays(Math.max(1, Number(e.target.value) || 1))}
                            disabled={savingBatch}
                            className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Quick Expiry Days Chips */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                          Shelf-life presets:
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_EXPIRY_DAYS.map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setExpiryDays(days)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono transition-all cursor-pointer ${
                                expiryDays === days
                                  ? "bg-neutral-900 text-white"
                                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                              }`}
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Computed Expiry Date Display */}
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-700" />
                          <div>
                            <span className="text-[10px] font-bold uppercase text-amber-800 block">
                              Computed Expiry
                            </span>
                            <span className="text-xs text-amber-900 font-medium">
                              {mfgDate} + {expiryDays} days
                            </span>
                          </div>
                        </div>
                        <strong className="font-mono font-bold text-amber-950 text-sm">
                          {calculatedExpiryDate}
                        </strong>
                      </div>

                      {/* Notes (Optional) */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">
                          Batch Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Morning Shift / Master Chef Batch"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={savingBatch}
                          className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Right Column: Stores Arrangement / Stock Allocation */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="pb-2 border-b border-neutral-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-700" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                            2. Stores Arrangement
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200">
                            {storeAllocations.length} {storeAllocations.length === 1 ? "store" : "stores"}
                          </span>
                        </div>

                        {storeAllocations.length > 1 && totalMfgQty > 0 && (
                          <button
                            type="button"
                            onClick={handleDistributeEqually}
                            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            title="Distribute total quantity equally among all added stores"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>Split Equally</span>
                          </button>
                        )}
                      </div>

                      {/* Live Allocation Summary & Progress Bar */}
                      <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-2xs">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase block tracking-wider">
                              Total Batch
                            </span>
                            <span className="font-mono font-bold text-neutral-900 text-sm">
                              {totalMfgQty} <span className="text-[11px] font-sans text-neutral-500">{selectedItem?.unit || "KG"}</span>
                            </span>
                          </div>

                          <div
                            className={`p-2.5 rounded-lg border shadow-2xs ${
                              isOverAllocated
                                ? "bg-red-50 border-red-200 text-red-900"
                                : "bg-white border-neutral-200 text-neutral-900"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold uppercase block tracking-wider ${
                                isOverAllocated ? "text-red-700" : "text-neutral-500"
                              }`}
                            >
                              Allocated Stores
                            </span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                isOverAllocated ? "text-red-700" : "text-blue-700"
                              }`}
                            >
                              {totalAllocatedQty}{" "}
                              <span className="text-[10px] font-sans font-medium">
                                ({allocationPercentage}%)
                              </span>
                            </span>
                          </div>

                          <div className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-2xs">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase block tracking-wider">
                              Unallocated Buffer
                            </span>
                            <span className="font-mono font-bold text-amber-800 text-sm">
                              {unallocatedQty}{" "}
                              <span className="text-[11px] font-sans text-neutral-500">{selectedItem?.unit || "KG"}</span>
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isOverAllocated
                                  ? "bg-red-600"
                                  : allocationPercentage === 100
                                  ? "bg-emerald-600"
                                  : "bg-blue-600"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, allocationPercentage))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                            <span>Store Distribution</span>
                            <span
                              className={`font-mono font-bold ${
                                isOverAllocated
                                  ? "text-red-600"
                                  : allocationPercentage === 100
                                  ? "text-emerald-700"
                                  : "text-blue-700"
                              }`}
                            >
                              {isOverAllocated ? "⚠️ Over-allocated!" : `${allocationPercentage}% Assigned to Stores`}
                            </span>
                          </div>
                        </div>

                        {isOverAllocated && (
                          <div className="flex items-center gap-2 p-2.5 bg-red-100 text-red-800 text-xs rounded-lg border border-red-200 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                            <span>
                              Store allocations ({totalAllocatedQty} {selectedItem?.unit || "KG"}) exceed batch quantity ({totalMfgQty} {selectedItem?.unit || "KG"}). Please reduce quantities.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Store Allocation Rows */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-600 font-semibold">
                          <span>Assigned Stores:</span>
                          <span className="text-[11px] text-neutral-400">
                            Enter quantity per store
                          </span>
                        </div>

                        {storeAllocations.length === 0 ? (
                          <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 space-y-2">
                            <Store className="w-8 h-8 text-neutral-300 mx-auto" />
                            <p className="text-xs font-bold text-neutral-700">No Stores Added Yet</p>
                            <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                              Select a store from below to arrange batch stock for your branch outlets, or add all available stores.
                            </p>
                            {stores.length > 0 && (
                              <button
                                type="button"
                                onClick={handleAddAllStores}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer mt-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add All Available Stores ({stores.length})</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                            {storeAllocations.map((alloc) => {
                              const storeObj = stores.find((s) => s.id === alloc.storeId);
                              const storeQtyNum = Number(alloc.quantity) || 0;
                              const storePct = totalMfgQty > 0 ? Math.round((storeQtyNum / totalMfgQty) * 100) : 0;

                              return (
                                <div
                                  key={alloc.storeId}
                                  className="p-3 bg-white hover:bg-neutral-50/70 flex items-center justify-between gap-3 transition-colors"
                                >
                                  {/* Store details */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Store className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                      <strong className="text-xs font-bold text-neutral-900 truncate">
                                        {alloc.storeName}
                                      </strong>
                                      {storeObj?.isMainBranch && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                          Main Branch
                                        </span>
                                      )}
                                    </div>
                                    {storeObj?.address && (
                                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                        {storeObj.address}
                                      </p>
                                    )}
                                  </div>

                                  {/* Quantity input & quick actions */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative flex items-center">
                                      <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        placeholder="Qty"
                                        value={alloc.quantity}
                                        onChange={(e) =>
                                          handleStoreQtyChange(
                                            alloc.storeId,
                                            e.target.value === "" ? "" : Number(e.target.value)
                                          )
                                        }
                                        className="w-24 bg-white text-xs font-bold font-mono text-neutral-900 py-1.5 px-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900"
                                      />
                                      <span className="ml-1 text-[11px] font-semibold text-neutral-500">
                                        {selectedItem?.unit || "KG"}
                                      </span>
                                    </div>

                                    {/* Portion % pill */}
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-semibold w-10 text-center">
                                      {storePct}%
                                    </span>

                                    {/* Fill Remaining Quick Button */}
                                    {unallocatedQty > 0 && alloc.quantity !== totalMfgQty && (
                                      <button
                                        type="button"
                                        onClick={() => handleFillRemaining(alloc.storeId)}
                                        className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-bold rounded-md border border-neutral-200 cursor-pointer transition-colors"
                                        title="Fill this store with the remaining unallocated quantity"
                                      >
                                        Fill Rem.
                                      </button>
                                    )}

                                    {/* Delete store row */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStoreAllocation(alloc.storeId)}
                                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      title="Remove Store from Allocation"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Store Picker & Quick Action Controls */}
                      <div className="pt-2 border-t border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        {/* Selector for stores not yet added */}
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={selectedStoreToAdd}
                            onChange={(e) => handleAddStoreAllocation(e.target.value)}
                            className="flex-1 bg-white text-xs text-neutral-800 p-2 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900 cursor-pointer"
                          >
                            <option value="">+ Select a store to arrange stock...</option>
                            {stores
                              .filter((s) => s.status !== "Inactive" && !storeAllocations.some((a) => a.storeId === s.id))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} {s.isMainBranch ? "⭐ (Main Branch)" : ""} {s.city ? `- ${s.city}` : ""}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Quick options */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {stores.filter((s) => s.status !== "Inactive" && !storeAllocations.some((a) => a.storeId === s.id)).length > 0 && (
                            <button
                              type="button"
                              onClick={handleAddAllStores}
                              className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                            >
                              + Add All Stores
                            </button>
                          )}

                          {storeAllocations.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setStoreAllocations([])}
                              className="px-2.5 py-1.5 text-neutral-400 hover:text-red-600 text-[11px] font-semibold cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 px-6 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
                  <div className="text-xs text-neutral-600">
                    {storeAllocations.length > 0 ? (
                      <span>
                        Distributing <strong className="font-mono text-neutral-900">{totalAllocatedQty} {selectedItem?.unit || "KG"}</strong> across <strong className="text-neutral-900">{storeAllocations.filter(a => Number(a.quantity) > 0).length}</strong> store(s)
                        {unallocatedQty > 0 ? (
                          <span> (<strong className="font-mono text-amber-800">{unallocatedQty} {selectedItem?.unit || "KG"}</strong> buffer stock)</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-neutral-500">
                        Entire batch of <strong className="font-mono text-neutral-900">{totalMfgQty} {selectedItem?.unit || "KG"}</strong> will be kept as central factory stock.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={savingBatch}
                      className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBatch || !selectedItem || manufacturedQuantity === "" || isOverAllocated}
                      className="flex items-center gap-1.5 px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {savingBatch && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Batch #{autoBatchNumber}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW SPECIFIC ITEM'S BATCHES DRAWER / MODAL                   */}
        {/* ============================================================== */}
        {viewingItemBatches && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Batches for {viewingItemBatches.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      Barcode ID: {viewingItemBatches.barcodeId} | Category: {viewingItemBatches.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item = viewingItemBatches;
                      setViewingItemBatches(null);
                      handleOpenAddBatch(item);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Batch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingItemBatches(null)}
                    className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
                {(() => {
                  const itemBatches = batches.filter((b) => b.itemId === viewingItemBatches.id);

                  if (itemBatches.length === 0) {
                    return (
                      <div className="p-8 text-center text-neutral-400">
                        No batches created for this item yet.
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                      {itemBatches.map((batch) => {
                        const st = getBatchStatusInfo(batch.expiryDate);

                        return (
                          <div
                            key={batch.id}
                            className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono font-bold text-xs border border-purple-200">
                                  {batch.batchCodeString}
                                </span>
                                <strong className="font-mono text-neutral-900 text-xs">
                                  {batch.manufacturedQuantity} {batch.itemUnit || "KG"}
                                </strong>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
                                  {st.label}
                                </span>
                              </div>

                              <div className="text-[11px] text-neutral-500 flex items-center gap-3">
                                <span>Mfg: <strong className="font-mono text-neutral-700">{batch.manufacturingDate}</strong></span>
                                <span>•</span>
                                <span>Expiry: <strong className="font-mono text-neutral-700">{batch.expiryDate}</strong> ({batch.expiryDays} days)</span>
                              </div>

                              {batch.storeAllocations && batch.storeAllocations.length > 0 && (
                                <div className="pt-1.5 flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                                    <Store className="w-3 h-3 text-neutral-500" /> Stores:
                                  </span>
                                  {batch.storeAllocations.map((alloc, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] border border-blue-200 font-semibold"
                                    >
                                      <span>{alloc.storeName}:</span>
                                      <strong className="font-mono">{alloc.quantity} {batch.itemUnit || "KG"}</strong>
                                    </span>
                                  ))}
                                  {batch.unallocatedQuantity && batch.unallocatedQuantity > 0 ? (
                                    <span className="text-[10px] text-amber-700 font-medium ml-1">
                                      Buffer: <strong className="font-mono">{batch.unallocatedQuantity} {batch.itemUnit || "KG"}</strong>
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(batch.id, batch.batchCodeString, batch.itemName)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Delete Batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingItemBatches(null)}
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
