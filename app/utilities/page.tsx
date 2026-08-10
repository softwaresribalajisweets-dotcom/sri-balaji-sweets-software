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
  updateDoc,
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
  List,
  LayoutGrid,
  ArrowLeftRight,
  PackagePlus,
  Eye,
  ChevronRight,
  Package,
  Barcode,
  ShoppingBag,
} from "lucide-react";

interface RackItem {
  id: string;
  name: string;
  code: string;
  qrCodeUrl: string;
  imagekitFileId?: string;
  notes?: string;
  assignedItems?: { itemId: string; name: string; barcodeId: string; quantity: number }[];
  createdAt?: any;
}

interface SerialItem {
  id: string;
  serialNumber: string;
  itemName: string;
  qrCodeUrl: string;
  status?: "Available" | "Assigned" | "In Maintenance";
  assignedItems?: { itemId: string; name: string; barcodeId: string; quantity: number }[];
  notes?: string;
  createdAt?: any;
}

interface StoreProduct {
  id: string;
  name: string;
  barcodeId: string;
  price: number;
  category: string;
}

export default function UtilitiesPage() {
  const [activeTab, setActiveTab] = useState<"racks" | "serials" | "tools">(
    "racks"
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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

  // Store Products List (from Firestore items collection)
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);

  // MULTIPLE Items Add to Rack Modal State
  const [addItemRack, setAddItemRack] = useState<RackItem | null>(null);
  const [rackItemsToAdd, setRackItemsToAdd] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: "", quantity: 1 }]);
  const [addingItemsToRack, setAddingItemsToRack] = useState(false);

  // MULTIPLE Items Assign to Serial Modal State
  const [addItemSerial, setAddItemSerial] = useState<SerialItem | null>(null);
  const [serialItemsToAdd, setSerialItemsToAdd] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: "", quantity: 1 }]);
  const [addingItemsToSerial, setAddingItemsToSerial] = useState(false);

  // MULTIPLE Items Move Between Racks Modal State
  const [moveRack, setMoveRack] = useState<RackItem | null>(null);
  const [rackItemsToMove, setRackItemsToMove] = useState<
    { itemId: string; quantity: number }[]
  >([{ itemId: "", quantity: 1 }]);
  const [targetRackId, setTargetRackId] = useState("");
  const [movingItems, setMovingItems] = useState(false);

  // View Rack Contents Modal State
  const [viewRack, setViewRack] = useState<RackItem | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");

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

    const qItems = query(collection(db, "items"), orderBy("name", "asc"));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const items: StoreProduct[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name,
          barcodeId: data.barcodeId,
          price: data.price,
          category: data.category,
        });
      });
      setStoreProducts(items);
    });

    return () => {
      unsubscribeRacks();
      unsubscribeSerials();
      unsubscribeItems();
    };
  }, []);

  // Open Add Items Modal for Rack
  const handleOpenAddItemsRack = (rack: RackItem) => {
    setAddItemRack(rack);
    setRackItemsToAdd([{ productId: "", quantity: 1 }]);
  };

  // Open Add Items Modal for Serial
  const handleOpenAddItemsSerial = (serial: SerialItem) => {
    setAddItemSerial(serial);
    setSerialItemsToAdd([{ productId: "", quantity: 1 }]);
  };

  // Open Move Items Modal for Rack
  const handleOpenMoveItemsRack = (rack: RackItem) => {
    setMoveRack(rack);
    setRackItemsToMove([{ itemId: "", quantity: 1 }]);
    setTargetRackId("");
  };

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
        assignedItems: [],
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
      if (!confirm(`You are creating ${total} racks. Continue?`)) return;
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
          assignedItems: [],
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

  // MULTIPLE Items Add to Rack Handler
  const handleAddMultipleItemsToRackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addItemRack) return;

    const validRows = rackItemsToAdd.filter(
      (r) => r.productId && Number(r.quantity) > 0
    );
    if (validRows.length === 0) {
      alert("Please select at least one valid product and quantity.");
      return;
    }

    try {
      setAddingItemsToRack(true);
      let updatedItems = [...(addItemRack.assignedItems || [])];

      for (const row of validRows) {
        const prod = storeProducts.find((p) => p.id === row.productId);
        if (!prod) continue;

        const existingIdx = updatedItems.findIndex((i) => i.itemId === prod.id);
        const addQty = Number(row.quantity) || 1;

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            quantity: updatedItems[existingIdx].quantity + addQty,
          };
        } else {
          updatedItems.push({
            itemId: prod.id,
            name: prod.name,
            barcodeId: prod.barcodeId,
            quantity: addQty,
          });
        }
      }

      await updateDoc(doc(db, "racks", addItemRack.id), {
        assignedItems: updatedItems,
      });

      setAddItemRack(null);
      setRackItemsToAdd([{ productId: "", quantity: 1 }]);
    } catch (err: any) {
      alert(`Failed to add items to rack: ${err.message}`);
    } finally {
      setAddingItemsToRack(false);
    }
  };

  // MULTIPLE Items Assign to Serial Handler
  const handleAddMultipleItemsToSerialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addItemSerial) return;

    const validRows = serialItemsToAdd.filter(
      (r) => r.productId && Number(r.quantity) > 0
    );
    if (validRows.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    try {
      setAddingItemsToSerial(true);
      let updatedItems = [...(addItemSerial.assignedItems || [])];

      for (const row of validRows) {
        const prod = storeProducts.find((p) => p.id === row.productId);
        if (!prod) continue;

        const existingIdx = updatedItems.findIndex((i) => i.itemId === prod.id);
        const addQty = Number(row.quantity) || 1;

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = {
            ...updatedItems[existingIdx],
            quantity: updatedItems[existingIdx].quantity + addQty,
          };
        } else {
          updatedItems.push({
            itemId: prod.id,
            name: prod.name,
            barcodeId: prod.barcodeId,
            quantity: addQty,
          });
        }
      }

      const firstItemName = updatedItems[0]?.name || addItemSerial.itemName;

      await updateDoc(doc(db, "serials", addItemSerial.id), {
        itemName: firstItemName,
        assignedItems: updatedItems,
        status: "Assigned",
      });

      setAddItemSerial(null);
      setSerialItemsToAdd([{ productId: "", quantity: 1 }]);
    } catch (err: any) {
      alert(`Failed to assign items to serial: ${err.message}`);
    } finally {
      setAddingItemsToSerial(false);
    }
  };

  // MULTIPLE Items Move Between Racks Handler
  const handleMoveMultipleItemsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveRack || !targetRackId) {
      alert("Please select target destination rack.");
      return;
    }

    const targetRack = racks.find((r) => r.id === targetRackId);
    if (!targetRack) {
      alert("Target rack not found.");
      return;
    }

    const validMoveRows = rackItemsToMove.filter(
      (r) => r.itemId && Number(r.quantity) > 0
    );
    if (validMoveRows.length === 0) {
      alert("Please select at least one item to move.");
      return;
    }

    try {
      setMovingItems(true);
      let sourceItems = [...(moveRack.assignedItems || [])];
      let targetItems = [...(targetRack.assignedItems || [])];

      for (const moveRow of validMoveRows) {
        const sourceIdx = sourceItems.findIndex((i) => i.itemId === moveRow.itemId);
        if (sourceIdx < 0) continue;

        const itemToMove = sourceItems[sourceIdx];
        const moveQty = Number(moveRow.quantity) || 1;

        if (moveQty > itemToMove.quantity) {
          alert(
            `Cannot move ${moveQty} units of "${itemToMove.name}". Available: ${itemToMove.quantity}`
          );
          setMovingItems(false);
          return;
        }

        // Deduct from source
        if (itemToMove.quantity - moveQty === 0) {
          sourceItems.splice(sourceIdx, 1);
        } else {
          sourceItems[sourceIdx] = {
            ...itemToMove,
            quantity: itemToMove.quantity - moveQty,
          };
        }

        // Add to target
        const targetIdx = targetItems.findIndex((i) => i.itemId === moveRow.itemId);
        if (targetIdx >= 0) {
          targetItems[targetIdx] = {
            ...targetItems[targetIdx],
            quantity: targetItems[targetIdx].quantity + moveQty,
          };
        } else {
          targetItems.push({
            itemId: itemToMove.itemId,
            name: itemToMove.name,
            barcodeId: itemToMove.barcodeId,
            quantity: moveQty,
          });
        }
      }

      // Update both racks in Firestore
      await updateDoc(doc(db, "racks", moveRack.id), {
        assignedItems: sourceItems,
      });

      await updateDoc(doc(db, "racks", targetRack.id), {
        assignedItems: targetItems,
      });

      setMoveRack(null);
      setRackItemsToMove([{ itemId: "", quantity: 1 }]);
      setTargetRackId("");
      alert(`Successfully transferred items to ${targetRack.name}!`);
    } catch (err: any) {
      console.error("Error moving items:", err);
      alert(`Error moving items: ${err.message}`);
    } finally {
      setMovingItems(false);
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
        status: "Available",
        assignedItems: [],
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
      if (!confirm(`You are creating ${total} serial numbers. Continue?`)) return;
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
          status: "Available",
          assignedItems: [],
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

  // Delete Actions
  const handleDeleteRack = async (rackId: string) => {
    if (confirm("Are you sure you want to delete this rack?")) {
      try {
        await deleteDoc(doc(db, "racks", rackId));
      } catch (err: any) {
        alert(`Failed to delete rack: ${err.message}`);
      }
    }
  };

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
              Manage inventory Racks, Serial Number QR codes, item movements, and system tools
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
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

              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "list"
                      ? "bg-white text-neutral-900 shadow-2xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden md:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white text-neutral-900 shadow-2xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden md:inline">Grid</span>
                </button>
              </div>
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
                Click "Add Rack" or "Bulk Create Racks" to generate QR code tags and start adding/moving products.
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
          ) : viewMode === "list" ? (
            /* ================= RACKS LIST VIEW TABLE ================= */
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-20">QR Tag</th>
                      <th className="py-3 px-4">Rack Info</th>
                      <th className="py-3 px-4">Stored Items</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 text-xs">
                    {filteredRacks.map((rack) => {
                      const itemCount = rack.assignedItems?.length || 0;
                      const totalQty =
                        rack.assignedItems?.reduce(
                          (acc, item) => acc + (item.quantity || 1),
                          0
                        ) || 0;

                      return (
                        <tr
                          key={rack.id}
                          className="hover:bg-neutral-50/60 transition-colors group"
                        >
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() =>
                                setPrintItem({
                                  title: rack.name,
                                  subtitle: `RACK CODE: ${rack.code}`,
                                  qrCodeUrl: rack.qrCodeUrl,
                                })
                              }
                              className="relative group/qr block cursor-pointer"
                              title="Click to print or expand QR tag"
                            >
                              <img
                                src={rack.qrCodeUrl}
                                alt={`QR for ${rack.name}`}
                                className="w-11 h-11 object-contain rounded-lg border border-neutral-300 p-0.5 bg-white shadow-2xs group-hover/qr:scale-105 transition-transform"
                              />
                            </button>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                {rack.code}
                              </span>
                              <span className="font-bold text-neutral-900 text-sm">
                                {rack.name}
                              </span>
                            </div>
                            {rack.notes && (
                              <p className="text-[11px] text-neutral-500 mt-0.5">
                                {rack.notes}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  itemCount > 0
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                }`}
                              >
                                <Package className="w-3 h-3" />
                                {itemCount} Products ({totalQty} total units)
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Add Multiple Items Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenAddItemsRack(rack)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                                title="Add multiple items from store to this rack"
                              >
                                <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+ Add Items</span>
                              </button>

                              {/* Move Multiple Items Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenMoveItemsRack(rack)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                                title="Move items to another rack"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                                <span>Move</span>
                              </button>

                              {/* View Items Button */}
                              <button
                                type="button"
                                onClick={() => setViewRack(rack)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                                title="View rack contents"
                              >
                                <Eye className="w-3.5 h-3.5 text-neutral-600" />
                                <span>View</span>
                              </button>

                              {/* Download QR */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadQR(
                                    rack.qrCodeUrl,
                                    `Rack_${rack.code}_QR.png`
                                  )
                                }
                                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                                title="Download QR Image"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Print Tag */}
                              <button
                                type="button"
                                onClick={() =>
                                  setPrintItem({
                                    title: rack.name,
                                    subtitle: `RACK CODE: ${rack.code}`,
                                    qrCodeUrl: rack.qrCodeUrl,
                                  })
                                }
                                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                                title="Print Rack Tag"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Rack */}
                              <button
                                type="button"
                                onClick={() => handleDeleteRack(rack.id)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Delete Rack"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ================= RACKS GRID VIEW ================= */
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
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
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
                      onClick={() => handleOpenAddItemsRack(rack)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>+ Add Items</span>
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
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
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
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
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

              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "list"
                      ? "bg-white text-neutral-900 shadow-2xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden md:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white text-neutral-900 shadow-2xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden md:inline">Grid</span>
                </button>
              </div>
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
          ) : viewMode === "list" ? (
            /* ================= SERIALS LIST VIEW TABLE ================= */
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-20">QR Tag</th>
                      <th className="py-3 px-4">Serial Number</th>
                      <th className="py-3 px-4">Associated Items</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 text-xs">
                    {filteredSerials.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-neutral-50/60 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintItem({
                                title: s.itemName,
                                subtitle: `SERIAL NO: ${s.serialNumber}`,
                                qrCodeUrl: s.qrCodeUrl,
                              })
                            }
                            className="cursor-pointer"
                            title="Click to view tag"
                          >
                            <img
                              src={s.qrCodeUrl}
                              alt={`QR for ${s.serialNumber}`}
                              className="w-11 h-11 object-contain rounded-lg border border-neutral-300 p-0.5 bg-white shadow-2xs"
                            />
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                            {s.serialNumber}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-neutral-900">
                            {s.itemName}
                          </div>
                          {s.assignedItems && s.assignedItems.length > 0 && (
                            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                              {s.assignedItems.length} products assigned
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              s.status === "Assigned"
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {s.status || "Available"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Assign Multiple Items to Serial */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddItemsSerial(s)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                              title="Assign products from items list to this serial"
                            >
                              <PackagePlus className="w-3.5 h-3.5 text-blue-600" />
                              <span>+ Assign Items</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadQR(
                                  s.qrCodeUrl,
                                  `SN_${s.serialNumber}_QR.png`
                                )
                              }
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Download QR"
                            >
                              <Download className="w-3.5 h-3.5" />
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
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Print Tag"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSerial(s.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Delete Serial"
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
          ) : (
            /* ================= SERIALS GRID VIEW ================= */
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
                      onClick={() => handleOpenAddItemsSerial(s)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>Assign Items</span>
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
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
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

      {/* ==================== ADD MULTIPLE ITEMS TO RACK MODAL ==================== */}
      {addItemRack && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Add Items to {addItemRack.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    Rack Code: {addItemRack.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddItemRack(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMultipleItemsToRackSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">
                    Select Products & Quantities
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRackItemsToAdd((prev) => [
                        ...prev,
                        { productId: "", quantity: 1 },
                      ])
                    }
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Item</span>
                  </button>
                </div>

                {rackItemsToAdd.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl border border-neutral-200"
                  >
                    <select
                      required
                      value={row.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRackItemsToAdd((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, productId: val } : r
                          )
                        );
                      }}
                      disabled={addingItemsToRack}
                      className="flex-1 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Product --</option>
                      {storeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.barcodeId}) - ₹{p.price}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setRackItemsToAdd((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, quantity: qty } : r
                          )
                        );
                      }}
                      disabled={addingItemsToRack}
                      className="w-20 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none font-mono text-center"
                    />

                    {rackItemsToAdd.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRackItemsToAdd((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddItemRack(null)}
                  disabled={addingItemsToRack}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingItemsToRack}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  {addingItemsToRack ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PackagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>Store All Items in Rack</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ASSIGN MULTIPLE ITEMS TO SERIAL MODAL ==================== */}
      {addItemSerial && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Assign Items to Serial {addItemSerial.serialNumber}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddItemSerial(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMultipleItemsToSerialSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">
                    Select Products to Assign
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSerialItemsToAdd((prev) => [
                        ...prev,
                        { productId: "", quantity: 1 },
                      ])
                    }
                    className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Item</span>
                  </button>
                </div>

                {serialItemsToAdd.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl border border-neutral-200"
                  >
                    <select
                      required
                      value={row.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSerialItemsToAdd((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, productId: val } : r
                          )
                        );
                      }}
                      disabled={addingItemsToSerial}
                      className="flex-1 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Product --</option>
                      {storeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.barcodeId})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setSerialItemsToAdd((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, quantity: qty } : r
                          )
                        );
                      }}
                      disabled={addingItemsToSerial}
                      className="w-20 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none font-mono text-center"
                    />

                    {serialItemsToAdd.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSerialItemsToAdd((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddItemSerial(null)}
                  disabled={addingItemsToSerial}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingItemsToSerial}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  {addingItemsToSerial ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PackagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>Assign to Serial Tag</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MOVE MULTIPLE ITEMS BETWEEN RACKS MODAL ==================== */}
      {moveRack && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Move Items from {moveRack.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Transfer multiple items to another rack
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoveRack(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveMultipleItemsSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Destination Target Rack */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Select Destination Target Rack <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={targetRackId}
                  onChange={(e) => setTargetRackId(e.target.value)}
                  disabled={movingItems}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Target Rack --</option>
                  {racks
                    .filter((r) => r.id !== moveRack.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Items to Move Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">
                    Items & Quantities to Move
                  </span>
                  {moveRack.assignedItems && moveRack.assignedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRackItemsToMove((prev) => [
                          ...prev,
                          { itemId: "", quantity: 1 },
                        ])
                      }
                      className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Item to Move</span>
                    </button>
                  )}
                </div>

                {moveRack.assignedItems && moveRack.assignedItems.length > 0 ? (
                  rackItemsToMove.map((row, idx) => {
                    const selectedItem = moveRack.assignedItems?.find(
                      (i) => i.itemId === row.itemId
                    );

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl border border-neutral-200"
                      >
                        <select
                          required
                          value={row.itemId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRackItemsToMove((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, itemId: val } : r
                              )
                            );
                          }}
                          disabled={movingItems}
                          className="flex-1 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Select Stored Item --</option>
                          {moveRack.assignedItems?.map((item) => (
                            <option key={item.itemId} value={item.itemId}>
                              {item.name} ({item.quantity} available)
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min={1}
                          max={selectedItem?.quantity || 1}
                          required
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            setRackItemsToMove((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, quantity: qty } : r
                              )
                            );
                          }}
                          disabled={movingItems}
                          className="w-20 bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none font-mono text-center"
                        />

                        {rackItemsToMove.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRackItemsToMove((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs font-medium">
                    This rack currently has 0 items stored. Add products to this rack first.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveRack(null)}
                  disabled={movingItems}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    movingItems ||
                    !targetRackId ||
                    !moveRack.assignedItems ||
                    moveRack.assignedItems.length === 0
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {movingItems ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  )}
                  <span>Transfer Items Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== VIEW RACK CONTENTS MODAL ==================== */}
      {viewRack && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {viewRack.name} Stored Products
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    RACK CODE: {viewRack.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewRack(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {viewRack.assignedItems && viewRack.assignedItems.length > 0 ? (
                <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Barcode</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {viewRack.assignedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500">
                            {item.barcodeId}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                            {item.quantity} units
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-neutral-50 rounded-xl border border-neutral-200">
                  <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-neutral-700">
                    No items currently stored in this rack
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Click "+ Add Items" in the rack row to select products from your store.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewRack(null)}
                className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
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
