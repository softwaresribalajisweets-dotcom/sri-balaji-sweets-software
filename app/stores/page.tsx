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
  Store,
  Plus,
  Search,
  Phone,
  MapPin,
  Building2,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  X,
  CheckCircle2,
  Star,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Navigation,
  Sparkles,
} from "lucide-react";

interface StoreBranch {
  id: string;
  name: string;
  mobileNumber: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  isMainBranch?: boolean;
  status?: "Active" | "Inactive";
  createdAt?: any;
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Add Store Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [savingStore, setSavingStore] = useState(false);

  // Edit Store Modal State
  const [editStore, setEditStore] = useState<StoreBranch | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editMobileNumber, setEditMobileNumber] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editIsMainBranch, setEditIsMainBranch] = useState(false);
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active");
  const [updatingStore, setUpdatingStore] = useState(false);

  // View Store Modal State
  const [viewStore, setViewStore] = useState<StoreBranch | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Realtime subscription to stores collection
  useEffect(() => {
    const q = query(collection(db, "stores"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const storeList: StoreBranch[] = [];
        snapshot.forEach((docSnap) => {
          storeList.push({ id: docSnap.id, ...docSnap.data() } as StoreBranch);
        });
        setStores(storeList);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading stores:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Open Add Store Modal
  const handleOpenAddModal = () => {
    setStoreName("");
    setMobileNumber("");
    setAddress("");
    setCity("");
    setStateName("");
    setPincode("");
    setIsMainBranch(stores.length === 0); // Default to main branch if first store
    setIsAddModalOpen(true);
  };

  // Add Store Submit
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !mobileNumber.trim() || !address.trim()) {
      alert("Please fill in Store Name, Mobile Number, and Address.");
      return;
    }

    try {
      setSavingStore(true);

      // If this is set as main branch, demote previous main branch
      if (isMainBranch && stores.length > 0) {
        for (const s of stores.filter((st) => st.isMainBranch)) {
          await updateDoc(doc(db, "stores", s.id), { isMainBranch: false });
        }
      }

      await addDoc(collection(db, "stores"), {
        name: storeName.trim(),
        mobileNumber: mobileNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        isMainBranch: isMainBranch || stores.length === 0,
        status: "Active",
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error creating store:", err);
      alert(`Error saving store: ${err.message}`);
    } finally {
      setSavingStore(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (store: StoreBranch) => {
    setEditStore(store);
    setEditStoreName(store.name);
    setEditMobileNumber(store.mobileNumber);
    setEditAddress(store.address);
    setEditCity(store.city || "");
    setEditPincode(store.pincode || "");
    setEditIsMainBranch(store.isMainBranch || false);
    setEditStatus(store.status || "Active");
  };

  // Update Store Submit
  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStore || !editStoreName.trim() || !editMobileNumber.trim() || !editAddress.trim()) {
      alert("Please fill in Store Name, Mobile Number, and Address.");
      return;
    }

    try {
      setUpdatingStore(true);

      if (editIsMainBranch) {
        for (const s of stores.filter((st) => st.isMainBranch && st.id !== editStore.id)) {
          await updateDoc(doc(db, "stores", s.id), { isMainBranch: false });
        }
      }

      await updateDoc(doc(db, "stores", editStore.id), {
        name: editStoreName.trim(),
        mobileNumber: editMobileNumber.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
        pincode: editPincode.trim(),
        isMainBranch: editIsMainBranch,
        status: editStatus,
      });

      setEditStore(null);
    } catch (err: any) {
      console.error("Error updating store:", err);
      alert(`Error updating store: ${err.message}`);
    } finally {
      setUpdatingStore(false);
    }
  };

  // Delete Store
  const handleDeleteStore = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete store branch "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "stores", id));
      } catch (err: any) {
        alert(`Error deleting store: ${err.message}`);
      }
    }
  };

  // Copy address to clipboard
  const handleCopyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Filtered Stores
  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.mobileNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.city && store.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalStoresCount = stores.length;
  const activeStoresCount = stores.filter((s) => s.status !== "Inactive").length;
  const mainBranchStore = stores.find((s) => s.isMainBranch);

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
                Store Locations & Outlets
              </h1>
              <p className="text-xs text-neutral-500">
                Manage branch outlets, store addresses, and contact phone numbers for <strong>Sri Balaji Sweets</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Store Branch</span>
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Outlets */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Total Store Outlets</span>
              <Building2 className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 font-mono">
              {totalStoresCount} Branches
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Configured in retail network
            </div>
          </div>

          {/* Active Outlets */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Active Outlets</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
              {activeStoresCount} Operational
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-medium">
              Accepting POS & billing orders
            </div>
          </div>

          {/* Main / Primary Branch */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Headquarters / Main Branch</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            </div>
            <div className="mt-2 text-lg font-bold text-neutral-900 truncate">
              {mainBranchStore ? mainBranchStore.name : "Not Configured"}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500 truncate">
              {mainBranchStore ? `${mainBranchStore.mobileNumber}` : "Add a store and set as Main Branch"}
            </div>
          </div>
        </div>

        {/* Filter Bar & View Mode Toggle */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search store name, mobile number, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-200/70 p-0.5 rounded-lg border border-neutral-300/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Card View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Stores List Container */}
        {loading ? (
          <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-neutral-200">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
            <span className="text-xs font-medium">Loading Store Outlets...</span>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center bg-white rounded-xl border border-neutral-200 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200">
              <Store className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No store branches found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mb-5">
              Click "Add Store Branch" to register your store name, mobile contact number, and physical retail address.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Store</span>
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ==================== GRID VIEW ==================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
              >
                {/* Store Card Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 border border-amber-500/20 flex items-center justify-center font-bold shrink-0">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900 text-sm leading-snug">
                          {store.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {store.isMainBranch && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              Main Branch
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              store.status === "Inactive"
                                ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {store.status || "Active"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs">
                    {/* Mobile Number */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200/60">
                      <div className="flex items-center gap-2 text-neutral-700 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="font-mono font-bold text-neutral-900 truncate">
                          {store.mobileNumber}
                        </span>
                      </div>
                      <a
                        href={`tel:${store.mobileNumber}`}
                        className="px-2 py-0.5 rounded bg-white text-neutral-800 hover:bg-neutral-200 border border-neutral-300 text-[10px] font-bold shadow-2xs shrink-0"
                      >
                        Call
                      </a>
                    </div>

                    {/* Address */}
                    <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/60 text-xs text-neutral-700 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        <p className="text-neutral-800 line-clamp-2 text-[11px] leading-relaxed">
                          {store.address}
                          {store.city && `, ${store.city}`}
                          {store.pincode && ` - ${store.pincode}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewStore(store)}
                    className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(store)}
                      className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                      title="Edit Store"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteStore(store.id, store.name)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                      title="Delete Store"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ==================== TABLE VIEW ==================== */
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Store Name</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredStores.map((store) => (
                    <tr key={store.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-900">
                        {store.name}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-neutral-800">
                        <a
                          href={`tel:${store.mobileNumber}`}
                          className="hover:text-blue-600 inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-neutral-400" />
                          {store.mobileNumber}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-neutral-700 max-w-xs truncate text-[11px]">
                        {store.address}
                        {store.city && `, ${store.city}`}
                      </td>
                      <td className="py-3 px-4">
                        {store.isMainBranch ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            Main Branch
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-500">Outlet</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            store.status === "Inactive"
                              ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {store.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewStore(store)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(store)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(store.id, store.name)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Delete"
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
          </div>
        )}

        {/* ============================================================== */}
        {/* ADD STORE MODAL                                                */}
        {/* ============================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 my-8">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Add Store Branch
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Enter store details, phone number, and physical address
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingStore && setIsAddModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStore} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Store Name */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sri Balaji Sweets - Main Branch"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={savingStore}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210 or +91 9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    disabled={savingStore}
                    className="w-full bg-white text-xs font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Shop #12, Market Main Road, Near Bus Stand"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={savingStore}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800 resize-none"
                  ></textarea>
                </div>

                {/* City & Pincode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={savingStore}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 500001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      disabled={savingStore}
                      className="w-full bg-white text-xs font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Main Branch Checkbox */}
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMainBranch}
                      onChange={(e) => setIsMainBranch(e.target.checked)}
                      disabled={savingStore}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-800 cursor-pointer"
                    />
                    <span>Set as Headquarters / Main Branch</span>
                  </label>
                  <p className="text-[11px] text-neutral-500 mt-1 pl-6">
                    Primary store information used on bills and receipts
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={savingStore}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStore || !storeName.trim() || !mobileNumber.trim() || !address.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingStore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Store Branch</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* EDIT STORE MODAL                                               */}
        {/* ============================================================== */}
        {editStore && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 my-8">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/60 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-600 text-white">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Edit Store - {editStore.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !updatingStore && setEditStore(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStore} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    disabled={updatingStore}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editMobileNumber}
                    onChange={(e) => setEditMobileNumber(e.target.value)}
                    disabled={updatingStore}
                    className="w-full bg-white text-xs font-mono text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    disabled={updatingStore}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none resize-none"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      disabled={updatingStore}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as "Active" | "Inactive")}
                      disabled={updatingStore}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsMainBranch}
                      onChange={(e) => setEditIsMainBranch(e.target.checked)}
                      disabled={updatingStore}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-800 cursor-pointer"
                    />
                    <span>Set as Headquarters / Main Branch</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStore(null)}
                    disabled={updatingStore}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingStore}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    {updatingStore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Store</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW STORE MODAL                                               */}
        {/* ============================================================== */}
        {viewStore && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      {viewStore.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      ID: {viewStore.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewStore(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {viewStore.isMainBranch && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
                    <span>Designated Main Branch / Store Headquarters</span>
                  </div>
                )}

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                    Contact Phone Number
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-neutral-900">
                      {viewStore.mobileNumber}
                    </span>
                    <a
                      href={`tel:${viewStore.mobileNumber}`}
                      className="px-3 py-1 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-neutral-800 shadow-2xs"
                    >
                      Call Branch
                    </a>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                      Physical Store Address
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAddress(
                          `${viewStore.address}${viewStore.city ? `, ${viewStore.city}` : ""}`
                        )
                      }
                      className="text-[10px] font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedAddress ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAddress ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-neutral-800 text-xs leading-relaxed font-medium">
                    {viewStore.address}
                    {viewStore.city && `, ${viewStore.city}`}
                    {viewStore.pincode && ` - ${viewStore.pincode}`}
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const st = viewStore;
                    setViewStore(null);
                    handleOpenEdit(st);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Branch</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewStore(null)}
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
