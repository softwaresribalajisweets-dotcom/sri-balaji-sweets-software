"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import QRCode from "qrcode";
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
  Wrench,
  Plus,
  Search,
  QrCode,
  Download,
  Printer,
  Trash2,
  Copy,
  Check,
  Loader2,
  Box,
  Hash,
  Sliders,
  X,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";

interface RackItem {
  id: string;
  name: string;
  code: string;
  qrCodeUrl: string;
  imagekitFileId?: string;
  notes?: string;
  createdAt?: any;
}

interface SerialItem {
  id: string;
  serialNumber: string;
  itemName: string;
  qrCodeUrl: string;
  notes?: string;
  createdAt?: any;
}

export default function UtilitiesPage() {
  const [activeTab, setActiveTab] = useState<"racks" | "serials" | "tools">(
    "racks"
  );

  // Racks State
  const [racks, setRacks] = useState<RackItem[]>([]);
  const [loadingRacks, setLoadingRacks] = useState(true);
  const [isAddRackOpen, setIsAddRackOpen] = useState(false);
  const [rackName, setRackName] = useState("");
  const [rackCode, setRackCode] = useState("");
  const [rackNotes, setRackNotes] = useState("");
  const [savingRack, setSavingRack] = useState(false);
  const [saveStep, setSaveStep] = useState("");

  // Serial Numbers State
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(true);
  const [isAddSerialOpen, setIsAddSerialOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [itemName, setItemName] = useState("");
  const [serialNotes, setSerialNotes] = useState("");
  const [savingSerial, setSavingSerial] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Print Preview Modal
  const [printItem, setPrintItem] = useState<{
    title: string;
    subtitle: string;
    qrCodeUrl: string;
  } | null>(null);

  // Subscribe to Realtime Firestore collections
  useEffect(() => {
    // Racks snapshot listener
    const qRacks = query(collection(db, "racks"), orderBy("createdAt", "desc"));
    const unsubscribeRacks = onSnapshot(
      qRacks,
      (snapshot) => {
        const items: RackItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as RackItem);
        });
        setRacks(items);
        setLoadingRacks(false);
      },
      (error) => {
        console.error("Firestore Racks error:", error);
        setLoadingRacks(false);
      }
    );

    // Serials snapshot listener
    const qSerials = query(
      collection(db, "serials"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeSerials = onSnapshot(
      qSerials,
      (snapshot) => {
        const items: SerialItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as SerialItem);
        });
        setSerials(items);
        setLoadingSerials(false);
      },
      (error) => {
        console.error("Firestore Serials error:", error);
        setLoadingSerials(false);
      }
    );

    return () => {
      unsubscribeRacks();
      unsubscribeSerials();
    };
  }, []);

  // Handle Add Rack Submission
  const handleCreateRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackName.trim()) return;

    try {
      setSavingRack(true);

      const generatedCode =
        rackCode.trim() ||
        `RCK-${Math.floor(1000 + Math.random() * 9000)}`;

      // Step 1: Generate QR Code locally
      setSaveStep("Generating QR code...");
      const qrPayload = JSON.stringify({
        type: "RACK",
        code: generatedCode,
        name: rackName,
        timestamp: Date.now(),
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0d0d0d",
          light: "#ffffff",
        },
      });

      // Step 2: Upload QR image to ImageKit
      setSaveStep("Uploading QR code to ImageKit...");
      const uploadRes = await fetch("/api/upload-imagekit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: qrDataUrl,
          fileName: `rack_${generatedCode}_qr.png`,
          folder: "/racks_qr",
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "ImageKit upload failed");
      }

      // Step 3: Save metadata with ImageKit URL into Firebase Firestore
      setSaveStep("Saving Rack details to Firebase...");
      await addDoc(collection(db, "racks"), {
        name: rackName.trim(),
        code: generatedCode,
        qrCodeUrl: uploadData.url,
        imagekitFileId: uploadData.fileId || "",
        notes: rackNotes.trim(),
        createdAt: serverTimestamp(),
      });

      // Reset form & close modal
      setRackName("");
      setRackCode("");
      setRackNotes("");
      setIsAddRackOpen(false);
    } catch (err: any) {
      console.error("Failed to save rack:", err);
      alert(`Error saving rack: ${err.message}`);
    } finally {
      setSavingRack(false);
      setSaveStep("");
    }
  };

  // Handle Add Serial Number Submission
  const handleCreateSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;

    try {
      setSavingSerial(true);
      setSaveStep("Generating Serial QR code...");

      const qrPayload = JSON.stringify({
        type: "SERIAL",
        sn: serialNumber.trim(),
        item: itemName.trim() || "Item",
        timestamp: Date.now(),
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0d0d0d",
          light: "#ffffff",
        },
      });

      setSaveStep("Uploading to ImageKit...");
      const uploadRes = await fetch("/api/upload-imagekit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: qrDataUrl,
          fileName: `sn_${serialNumber.trim()}_qr.png`,
          folder: "/serials_qr",
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "ImageKit upload failed");
      }

      setSaveStep("Saving Serial No to Firebase...");
      await addDoc(collection(db, "serials"), {
        serialNumber: serialNumber.trim(),
        itemName: itemName.trim() || "Uncategorized Item",
        qrCodeUrl: uploadData.url,
        notes: serialNotes.trim(),
        createdAt: serverTimestamp(),
      });

      setSerialNumber("");
      setItemName("");
      setSerialNotes("");
      setIsAddSerialOpen(false);
    } catch (err: any) {
      console.error("Failed to save serial number:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSavingSerial(false);
      setSaveStep("");
    }
  };

  // Delete Rack from Firestore
  const handleDeleteRack = async (rackId: string) => {
    if (confirm("Are you sure you want to delete this rack?")) {
      try {
        await deleteDoc(doc(db, "racks", rackId));
      } catch (err: any) {
        alert(`Failed to delete rack: ${err.message}`);
      }
    }
  };

  // Delete Serial from Firestore
  const handleDeleteSerial = async (serialId: string) => {
    if (confirm("Are you sure you want to delete this serial number?")) {
      try {
        await deleteDoc(doc(db, "serials", serialId));
      } catch (err: any) {
        alert(`Failed to delete serial: ${err.message}`);
      }
    }
  };

  // Download QR Code Image
  const handleDownloadQR = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy URL to Clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered lists
  const filteredRacks = racks.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSerials = serials.filter(
    (s) =>
      s.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neutral-900 text-white shadow-xs">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Utilities & Rack Management
            </h1>
            <p className="text-xs text-neutral-500">
              Manage inventory Racks, Serial Number QR codes, and system tools
            </p>
          </div>
        </div>

        {/* Tab Selection Buttons */}
        <div className="flex items-center gap-1.5 bg-neutral-200/80 p-1 rounded-xl border border-neutral-300/60">
          <button
            type="button"
            onClick={() => setActiveTab("racks")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "racks"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-amber-600" />
            <span>Racks</span>
            <span className="ml-1 text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
              {racks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("serials")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "serials"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-blue-600" />
            <span>Serial Numbers</span>
            <span className="ml-1 text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
              {serials.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "tools"
                ? "bg-white text-neutral-900 shadow-2xs"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>General Tools</span>
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: RACKS ==================== */}
      {activeTab === "racks" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search racks by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-800 placeholder-neutral-400 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddRackOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rack</span>
            </button>
          </div>

          {/* Racks Grid Container */}
          {loadingRacks ? (
            <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
              <span className="text-xs font-medium">Loading Racks from Firebase...</span>
            </div>
          ) : filteredRacks.length === 0 ? (
            <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-200/60">
                <Box className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                No Racks Configured
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mb-5">
                Click "Add Rack" to create your first inventory rack. A unique QR code will be generated and uploaded to ImageKit automatically.
              </p>
              <button
                type="button"
                onClick={() => setIsAddRackOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Rack</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRacks.map((rack) => (
                <div
                  key={rack.id}
                  className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Rack Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                          {rack.code}
                        </span>
                        <h3 className="text-sm font-bold text-neutral-900 mt-1">
                          {rack.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRack(rack.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Rack"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* ImageKit QR Image Card */}
                    <div className="bg-neutral-50 border border-neutral-200/80 rounded-lg p-3 flex flex-col items-center justify-center my-3 relative group">
                      {rack.qrCodeUrl ? (
                        <img
                          src={rack.qrCodeUrl}
                          alt={`QR for ${rack.name}`}
                          className="w-36 h-36 object-contain rounded bg-white p-1 border border-neutral-200 shadow-2xs"
                        />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center bg-neutral-100 rounded text-neutral-400">
                          <QrCode className="w-8 h-8" />
                        </div>
                      )}
                      <span className="text-[10px] text-neutral-400 mt-2 font-mono flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        ImageKit CDN Hosted
                      </span>
                    </div>

                    {rack.notes && (
                      <p className="text-xs text-neutral-500 italic mb-2">
                        "{rack.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadQR(
                          rack.qrCodeUrl,
                          `Rack_${rack.code}_QR.png`
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintItem({
                          title: rack.name,
                          subtitle: `RACK CODE: ${rack.code}`,
                          qrCodeUrl: rack.qrCodeUrl,
                        })
                      }
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Tag</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SERIAL NUMBERS ==================== */}
      {activeTab === "serials" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by serial no or item name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-800 placeholder-neutral-400 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddSerialOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Serial Number</span>
            </button>
          </div>

          {loadingSerials ? (
            <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
              <span className="text-xs font-medium">Loading Serial Numbers from Firebase...</span>
            </div>
          ) : filteredSerials.length === 0 ? (
            <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-200/60">
                <Hash className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                No Serial Numbers Added
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mb-5">
                Generate Serial Number QR codes for batch tracking and item tags.
              </p>
              <button
                type="button"
                onClick={() => setIsAddSerialOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Serial Number</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSerials.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                          SN: {s.serialNumber}
                        </span>
                        <h3 className="text-sm font-bold text-neutral-900 mt-1">
                          {s.itemName}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSerial(s.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-neutral-50 border border-neutral-200/80 rounded-lg p-3 flex flex-col items-center justify-center my-3">
                      <img
                        src={s.qrCodeUrl}
                        alt={`QR for ${s.serialNumber}`}
                        className="w-36 h-36 object-contain rounded bg-white p-1 border border-neutral-200 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadQR(
                          s.qrCodeUrl,
                          `SN_${s.serialNumber}_QR.png`
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrintItem({
                          title: s.itemName,
                          subtitle: `SERIAL NO: ${s.serialNumber}`,
                          qrCodeUrl: s.qrCodeUrl,
                        })
                      }
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Tag</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: GENERAL TOOLS ==================== */}
      {activeTab === "tools" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-neutral-900 mb-1">
              Bulk Price Modifier
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Apply bulk percentage or fixed adjustments to item prices.
            </p>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Configure Tool
            </button>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-neutral-900 mb-1">
              Firebase Storage Backup
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Export racks, serial numbers, and ImageKit QR references.
            </p>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Export JSON Backup
            </button>
          </div>
        </div>
      )}

      {/* ==================== ADD RACK MODAL ==================== */}
      {isAddRackOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700">
                  <Box className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Add New Inventory Rack
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !savingRack && setIsAddRackOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRack} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Rack Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack A1 - Kaju Section"
                  value={rackName}
                  onChange={(e) => setRackName(e.target.value)}
                  disabled={savingRack}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Rack Code / Location ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RCK-A1-001 (auto-generated if empty)"
                  value={rackCode}
                  onChange={(e) => setRackCode(e.target.value)}
                  disabled={savingRack}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Notes / Storage Details
                </label>
                <textarea
                  placeholder="e.g. Shelf 2, Ghee Sweets Storage"
                  value={rackNotes}
                  onChange={(e) => setRackNotes(e.target.value)}
                  disabled={savingRack}
                  rows={2}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              {savingRack && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                  <span className="font-semibold">{saveStep}</span>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRackOpen(false)}
                  disabled={savingRack}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRack || !rackName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {savingRack ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5" />
                  )}
                  <span>Generate QR & Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD SERIAL NO MODAL ==================== */}
      {isAddSerialOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700">
                  <Hash className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Add Serial Number Tag
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !savingSerial && setIsAddSerialOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSerial} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Serial Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SN-2026-8801"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  disabled={savingSerial}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Associated Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Kaju Katli Batch #4"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  disabled={savingSerial}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              {savingSerial && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span className="font-semibold">{saveStep}</span>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSerialOpen(false)}
                  disabled={savingSerial}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSerial || !serialNumber.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {savingSerial ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Serial QR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PRINT TAG MODAL ==================== */}
      {printItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 border border-neutral-300 text-center">
            <div className="border-2 border-dashed border-neutral-800 rounded-xl p-6 bg-white flex flex-col items-center justify-center">
              <h2 className="text-lg font-extrabold text-neutral-900 uppercase tracking-tight">
                Sri Balaji Sweets
              </h2>
              <p className="text-xs font-bold text-neutral-600 mt-1">
                {printItem.title}
              </p>
              <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded mt-1 border border-neutral-300">
                {printItem.subtitle}
              </span>

              <img
                src={printItem.qrCodeUrl}
                alt="QR Code"
                className="w-48 h-48 my-3 border border-neutral-300 p-1 bg-white rounded-lg shadow-2xs"
              />

              <p className="text-[9px] text-neutral-400 font-mono">
                Scan with POS app to view rack contents
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPrintItem(null)}
                className="px-4 py-2 bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-300 cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tag Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
