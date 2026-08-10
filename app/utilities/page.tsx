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
  Boxes,
  Hash,
  Sliders,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Layers3,
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

  // Bulk Racks State
  const [isBulkRackOpen, setIsBulkRackOpen] = useState(false);
  const [bulkRackPrefix, setBulkRackPrefix] = useState("Rack ");
  const [bulkRackStart, setBulkRackStart] = useState<number | "">(1);
  const [bulkRackEnd, setBulkRackEnd] = useState<number | "">(5);
  const [bulkRackSaving, setBulkRackSaving] = useState(false);
  const [bulkRackProgress, setBulkRackProgress] = useState<{
    current: number;
    total: number;
    step: string;
  } | null>(null);

  // Serial Numbers State
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(true);
  const [isAddSerialOpen, setIsAddSerialOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [itemName, setItemName] = useState("");
  const [serialNotes, setSerialNotes] = useState("");
  const [savingSerial, setSavingSerial] = useState(false);

  // Bulk Serials State
  const [isBulkSerialOpen, setIsBulkSerialOpen] = useState(false);
  const [bulkSerialPrefix, setBulkSerialPrefix] = useState("SN-2026-");
  const [bulkSerialItemName, setBulkSerialItemName] = useState("Sweet Item");
  const [bulkSerialStart, setBulkSerialStart] = useState<number | "">(1);
  const [bulkSerialEnd, setBulkSerialEnd] = useState<number | "">(5);
  const [bulkSerialSaving, setBulkSerialSaving] = useState(false);
  const [bulkSerialProgress, setBulkSerialProgress] = useState<{
    current: number;
    total: number;
    step: string;
  } | null>(null);

  // Filter & Search State
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

  // Single Rack Creation
  const handleCreateRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackName.trim()) return;

    try {
      setSavingRack(true);

      const generatedCode =
        rackCode.trim() ||
        `RCK-${Math.floor(1000 + Math.random() * 9000)}`;

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
        color: { dark: "#0d0d0d", light: "#ffffff" },
      });

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

      setSaveStep("Saving Rack to Firebase...");
      await addDoc(collection(db, "racks"), {
        name: rackName.trim(),
        code: generatedCode,
        qrCodeUrl: uploadData.url,
        imagekitFileId: uploadData.fileId || "",
        notes: rackNotes.trim(),
        createdAt: serverTimestamp(),
      });

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

  // Bulk Create Racks Handler
  const handleBulkCreateRacks = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = Number(bulkRackStart);
    const end = Number(bulkRackEnd);

    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      alert("Please enter a valid starting and ending count range.");
      return;
    }

    const total = end - start + 1;
    if (total > 50) {
      if (!confirm(`You are creating ${total} racks. This may take a minute. Continue?`)) {
        return;
      }
    }

    try {
      setBulkRackSaving(true);

      for (let i = start; i <= end; i++) {
        const countIdx = i - start + 1;
        const rName = `${bulkRackPrefix.trim()} ${i}`.trim();
        const rCode = `RCK-${i}`;

        setBulkRackProgress({
          current: countIdx,
          total,
          step: `Generating QR for ${rName}...`,
        });

        // 1. Generate QR Code
        const qrPayload = JSON.stringify({
          type: "RACK",
          code: rCode,
          name: rName,
          index: i,
          timestamp: Date.now(),
        });

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
          color: { dark: "#0d0d0d", light: "#ffffff" },
        });

        // 2. Upload to ImageKit
        setBulkRackProgress({
          current: countIdx,
          total,
          step: `Uploading ${rName} QR to ImageKit...`,
        });

        const uploadRes = await fetch("/api/upload-imagekit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: qrDataUrl,
            fileName: `rack_${rCode}_qr.png`,
            folder: "/racks_qr",
          }),
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(`Failed to upload ${rName}: ${uploadData.error}`);
        }

        // 3. Save to Firestore
        setBulkRackProgress({
          current: countIdx,
          total,
          step: `Saving ${rName} to Firebase...`,
        });

        await addDoc(collection(db, "racks"), {
          name: rName,
          code: rCode,
          qrCodeUrl: uploadData.url,
          imagekitFileId: uploadData.fileId || "",
          notes: `Bulk created item #${i}`,
          createdAt: serverTimestamp(),
        });
      }

      setIsBulkRackOpen(false);
      setBulkRackProgress(null);
    } catch (err: any) {
      console.error("Bulk create racks error:", err);
      alert(`Bulk create error: ${err.message}`);
    } finally {
      setBulkRackSaving(false);
      setBulkRackProgress(null);
    }
  };

  // Single Serial Creation
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
        color: { dark: "#0d0d0d", light: "#ffffff" },
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

  // Bulk Create Serials Handler
  const handleBulkCreateSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = Number(bulkSerialStart);
    const end = Number(bulkSerialEnd);

    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      alert("Please enter a valid starting and ending count range.");
      return;
    }

    const total = end - start + 1;
    if (total > 50) {
      if (!confirm(`You are creating ${total} serial numbers. Continue?`)) {
        return;
      }
    }

    try {
      setBulkSerialSaving(true);

      for (let i = start; i <= end; i++) {
        const countIdx = i - start + 1;
        const formattedNum = String(i).padStart(3, "0");
        const snCode = `${bulkSerialPrefix.trim()}${formattedNum}`;
        const itemLabel = `${bulkSerialItemName.trim()} #${i}`;

        setBulkSerialProgress({
          current: countIdx,
          total,
          step: `Generating QR for ${snCode}...`,
        });

        const qrPayload = JSON.stringify({
          type: "SERIAL",
          sn: snCode,
          item: itemLabel,
          index: i,
          timestamp: Date.now(),
        });

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
          color: { dark: "#0d0d0d", light: "#ffffff" },
        });

        setBulkSerialProgress({
          current: countIdx,
          total,
          step: `Uploading ${snCode} QR to ImageKit...`,
        });

        const uploadRes = await fetch("/api/upload-imagekit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: qrDataUrl,
            fileName: `sn_${snCode}_qr.png`,
            folder: "/serials_qr",
          }),
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(`Failed to upload ${snCode}: ${uploadData.error}`);
        }

        setBulkSerialProgress({
          current: countIdx,
          total,
          step: `Saving ${snCode} to Firebase...`,
        });

        await addDoc(collection(db, "serials"), {
          serialNumber: snCode,
          itemName: itemLabel,
          qrCodeUrl: uploadData.url,
          notes: `Bulk generated serial item #${i}`,
          createdAt: serverTimestamp(),
        });
      }

      setIsBulkSerialOpen(false);
      setBulkSerialProgress(null);
    } catch (err: any) {
      console.error("Bulk create serials error:", err);
      alert(`Bulk create error: ${err.message}`);
    } finally {
      setBulkSerialSaving(false);
      setBulkSerialProgress(null);
    }
  };

  // Delete Rack
  const handleDeleteRack = async (rackId: string) => {
    if (confirm("Are you sure you want to delete this rack?")) {
      try {
        await deleteDoc(doc(db, "racks", rackId));
      } catch (err: any) {
        alert(`Failed to delete rack: ${err.message}`);
      }
    }
  };

  // Delete Serial
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsBulkRackOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                <Boxes className="w-4 h-4 text-amber-700" />
                <span>Bulk Create Racks</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddRackOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rack</span>
              </button>
            </div>
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
                Click "Add Rack" or "Bulk Create Racks" to generate QR codes uploaded automatically to ImageKit.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkRackOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-amber-700" />
                  <span>Bulk Create</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddRackOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Single Rack</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRacks.map((rack) => (
                <div
                  key={rack.id}
                  className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
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

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadQR(
                          rack.qrCodeUrl,
                          `Rack_${rack.code}_QR.png`
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
                          title: rack.name,
                          subtitle: `RACK CODE: ${rack.code}`,
                          qrCodeUrl: rack.qrCodeUrl,
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsBulkSerialOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                <Layers3 className="w-4 h-4 text-blue-700" />
                <span>Bulk Create Serials</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddSerialOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Serial Number</span>
              </button>
            </div>
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkSerialOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Layers3 className="w-4 h-4 text-blue-700" />
                  <span>Bulk Create</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSerialOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Single Serial</span>
                </button>
              </div>
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
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
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

      {/* ==================== BULK RACK MODAL ==================== */}
      {isBulkRackOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-800">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Bulk Create Racks
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Generate multiple rack QR codes automatically
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !bulkRackSaving && setIsBulkRackOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkCreateRacks} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Rack Name Prefix
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack "
                  value={bulkRackPrefix}
                  onChange={(e) => setBulkRackPrefix(e.target.value)}
                  disabled={bulkRackSaving}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Example preview: "{bulkRackPrefix.trim()} 1", "{bulkRackPrefix.trim()} 2"...
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Start Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkRackStart}
                    onChange={(e) =>
                      setBulkRackStart(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={bulkRackSaving}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    End Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkRackEnd}
                    onChange={(e) =>
                      setBulkRackEnd(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={bulkRackSaving}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {bulkRackProgress && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                      Creating Racks...
                    </span>
                    <span>
                      {bulkRackProgress.current} / {bulkRackProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-amber-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all duration-300 rounded-full"
                      style={{
                        width: `${
                          (bulkRackProgress.current / bulkRackProgress.total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-amber-800 font-mono truncate">
                    {bulkRackProgress.step}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkRackOpen(false)}
                  disabled={bulkRackSaving}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    bulkRackSaving ||
                    bulkRackStart === "" ||
                    bulkRackEnd === "" ||
                    Number(bulkRackStart) > Number(bulkRackEnd)
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {bulkRackSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Boxes className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Bulk Create (
                    {Number(bulkRackEnd) >= Number(bulkRackStart)
                      ? Number(bulkRackEnd) - Number(bulkRackStart) + 1
                      : 0}{" "}
                    Racks)
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== BULK SERIAL MODAL ==================== */}
      {isBulkSerialOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-800">
                  <Layers3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Bulk Create Serial Numbers
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Generate sequential Serial Number QR tags
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !bulkSerialSaving && setIsBulkSerialOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkCreateSerials} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Serial Prefix
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SN-2026-"
                  value={bulkSerialPrefix}
                  onChange={(e) => setBulkSerialPrefix(e.target.value)}
                  disabled={bulkSerialSaving}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Item / Batch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sweet Item"
                  value={bulkSerialItemName}
                  onChange={(e) => setBulkSerialItemName(e.target.value)}
                  disabled={bulkSerialSaving}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Example preview: "{bulkSerialPrefix.trim()}001" for "{bulkSerialItemName.trim()} #1"
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Start Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkSerialStart}
                    onChange={(e) =>
                      setBulkSerialStart(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={bulkSerialSaving}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    End Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkSerialEnd}
                    onChange={(e) =>
                      setBulkSerialEnd(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={bulkSerialSaving}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {bulkSerialProgress && (
                <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                      Creating Serials...
                    </span>
                    <span>
                      {bulkSerialProgress.current} / {bulkSerialProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-blue-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{
                        width: `${
                          (bulkSerialProgress.current /
                            bulkSerialProgress.total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-blue-800 font-mono truncate">
                    {bulkSerialProgress.step}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkSerialOpen(false)}
                  disabled={bulkSerialSaving}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    bulkSerialSaving ||
                    bulkSerialStart === "" ||
                    bulkSerialEnd === "" ||
                    Number(bulkSerialStart) > Number(bulkSerialEnd)
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {bulkSerialSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Layers3 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Bulk Create (
                    {Number(bulkSerialEnd) >= Number(bulkSerialStart)
                      ? Number(bulkSerialEnd) - Number(bulkSerialStart) + 1
                      : 0}{" "}
                    Serials)
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SINGLE ADD RACK MODAL ==================== */}
      {isAddRackOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
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
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
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
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRack || !rackName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
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

      {/* ==================== SINGLE ADD SERIAL NO MODAL ==================== */}
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
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
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
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSerial || !serialNumber.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
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
                Scan with POS app to view item details
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
