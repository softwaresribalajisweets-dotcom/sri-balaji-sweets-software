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
  getCountFromServer,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import {
  Gift,
  Package,
  Search,
  Upload,
  Download,
  Plus,
  Trash2,
  Loader2,
  X,
  Tag,
  AlertTriangle,
  Barcode,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  CheckCircle2,
  Eye,
  Pencil,
  Save,
  Boxes,
  Box,
  Hash,
  LayoutGrid,
  List,
  Printer,
  Sparkles,
  Info,
  Check,
  Image as ImageIcon,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface RackAllocation {
  rackCode: string;
  rackName?: string;
  serialNumber: string;
  count: number;
}

interface GiftHamperProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: string;
  hsnCode: string;
  gstPercent: number;
  stockCount: number;
  bufferStockCount: number;
  isThirdParty: boolean;
  barcodeId: string;
  imageUrl: string;
  isGiftHamper?: boolean;
  rackAllocations?: RackAllocation[];
  notes?: string;
  createdAt?: any;
}

interface RackDoc {
  id: string;
  name: string;
  code: string;
  qrCodeUrl: string;
  assignedItems?: { itemId: string; name: string; barcodeId: string; quantity: number }[];
}

interface SerialDoc {
  id: string;
  serialNumber: string;
  itemName: string;
  qrCodeUrl: string;
  status?: string;
  assignedItems?: { itemId: string; name: string; barcodeId: string; quantity: number }[];
}

const DEFAULT_ITEM_IMAGE = "/default-img.png";
const ITEMS_PER_PAGE = 24;

export default function GiftHampersPage() {
  const [hampers, setHampers] = useState<GiftHamperProduct[]>([]);
  const [racks, setRacks] = useState<RackDoc[]>([]);
  const [serials, setSerials] = useState<SerialDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverHamperCount, setServerHamperCount] = useState<number | null>(null);

  // Pagination State (Limit 24 per page)
  const [currentPage, setCurrentPage] = useState(1);

  // View Mode
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [rackFilter, setRackFilter] = useState("all");

  // Reset pagination when search or rack filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rackFilter]);

  // Single Add Hamper Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [unit, setUnit] = useState<string>("Box");
  const [category, setCategory] = useState("Gift Hampers");
  const [hsnCode, setHsnCode] = useState("2106");
  const [gstPercent, setGstPercent] = useState<number>(5);
  const [stockCount, setStockCount] = useState<number | "">(20);
  const [bufferStockCount, setBufferStockCount] = useState<number | "">(5);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [barcodeId, setBarcodeId] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [savingItem, setSavingItem] = useState(false);
  const [saveProgressStep, setSaveProgressStep] = useState("");

  // Multiple Rack & Serial Allocations for Add Modal
  const [allocations, setAllocations] = useState<RackAllocation[]>([
    { rackCode: "", rackName: "", serialNumber: "", count: 10 },
  ]);

  // View Hamper Modal
  const [viewHamper, setViewHamper] = useState<GiftHamperProduct | null>(null);

  // Edit Hamper Modal
  const [editHamper, setEditHamper] = useState<GiftHamperProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editUnit, setEditUnit] = useState("Box");
  const [editCategory, setEditCategory] = useState("Gift Hampers");
  const [editHsnCode, setEditHsnCode] = useState("2106");
  const [editGstPercent, setEditGstPercent] = useState<number>(5);
  const [editStockCount, setEditStockCount] = useState<number | "">(0);
  const [editBufferStockCount, setEditBufferStockCount] = useState<number | "">(5);
  const [editIsThirdParty, setEditIsThirdParty] = useState(false);
  const [editBarcodeId, setEditBarcodeId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAllocations, setEditAllocations] = useState<RackAllocation[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>("");
  const [updatingHamper, setUpdatingHamper] = useState(false);
  const [editProgressStep, setEditProgressStep] = useState("");

  // Bulk Upload Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    step: string;
  } | null>(null);

  // Print Tag Modal
  const [printTag, setPrintTag] = useState<{
    title: string;
    subtitle: string;
    barcodeId: string;
    price: number;
    rackInfo?: string;
  } | null>(null);

  // Auto-generate 12-digit numeric barcode
  const generateNumericBarcode = () => {
    const prefix = "890888";
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}${randomDigits}`;
  };

  // Subscribe to real-time collections
  useEffect(() => {
    const qItems = query(collection(db, "items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(
      qItems,
      (snapshot) => {
        const hamperList: GiftHamperProduct[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (
            data.isGiftHamper === true ||
            data.category?.toLowerCase() === "gift hampers" ||
            data.name?.toLowerCase().includes("hamper")
          ) {
            hamperList.push({
              id: docSnap.id,
              ...data,
            } as GiftHamperProduct);
          }
        });
        setHampers(hamperList);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore items error:", err);
        setLoading(false);
      }
    );

    const qRacks = query(collection(db, "racks"), orderBy("createdAt", "desc"));
    const unsubscribeRacks = onSnapshot(qRacks, (snapshot) => {
      const rackList: RackDoc[] = [];
      snapshot.forEach((docSnap) => {
        rackList.push({ id: docSnap.id, ...docSnap.data() } as RackDoc);
      });
      setRacks(rackList);
    });

    const qSerials = query(collection(db, "serials"), orderBy("createdAt", "desc"));
    const unsubscribeSerials = onSnapshot(qSerials, (snapshot) => {
      const serialList: SerialDoc[] = [];
      snapshot.forEach((docSnap) => {
        serialList.push({ id: docSnap.id, ...docSnap.data() } as SerialDoc);
      });
      setSerials(serialList);
    });

    return () => {
      unsubscribeItems();
      unsubscribeRacks();
      unsubscribeSerials();
    };
  }, []);

  // Fetch count using Firestore getCountFromServer aggregation function
  const fetchHamperServerCount = async () => {
    try {
      const qHamper = query(collection(db, "items"), where("isGiftHamper", "==", true));
      const countSnap = await getCountFromServer(qHamper);
      setServerHamperCount(countSnap.data().count);
    } catch (err) {
      console.warn("Could not fetch server count for hampers:", err);
    }
  };

  useEffect(() => {
    fetchHamperServerCount();
  }, []);

  // Update total stock count when allocations change in Add form
  useEffect(() => {
    const totalAllocated = allocations.reduce(
      (acc, r) => acc + (Number(r.count) || 0),
      0
    );
    if (totalAllocated > 0) {
      setStockCount(totalAllocated);
    }
  }, [allocations]);

  // Open Edit Modal
  const handleOpenEdit = (h: GiftHamperProduct) => {
    setEditHamper(h);
    setEditName(h.name);
    setEditPrice(h.price);
    setEditUnit(h.unit || "Box");
    setEditCategory(h.category || "Gift Hampers");
    setEditHsnCode(h.hsnCode || "2106");
    setEditGstPercent(h.gstPercent || 5);
    setEditStockCount(h.stockCount || 0);
    setEditBufferStockCount(h.bufferStockCount || 5);
    setEditIsThirdParty(h.isThirdParty || false);
    setEditBarcodeId(h.barcodeId || "");
    setEditNotes(h.notes || "");
    setEditImageFile(null);
    setEditImagePreview(h.imageUrl || "");
    setEditAllocations(
      h.rackAllocations && h.rackAllocations.length > 0
        ? [...h.rackAllocations]
        : [{ rackCode: "", rackName: "", serialNumber: "", count: h.stockCount || 10 }]
    );
  };

  // Image Selection Handler (Add Modal)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  // Image Selection Handler (Edit Modal)
  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview("");
  };

  // Helper: assign or update item in a Rack
  const assignItemToRack = async (
    rackCode: string,
    rackName: string,
    itemInfo: { itemId: string; name: string; barcodeId: string; quantity: number }
  ) => {
    if (!rackCode.trim()) return;
    const cleanCode = rackCode.trim();
    const existingRack = racks.find(
      (r) => r.code?.toLowerCase() === cleanCode.toLowerCase()
    );

    if (existingRack) {
      const assigned = [...(existingRack.assignedItems || [])];
      const existIdx = assigned.findIndex((i) => i.itemId === itemInfo.itemId);
      if (existIdx >= 0) {
        assigned[existIdx].quantity += itemInfo.quantity;
      } else {
        assigned.push(itemInfo);
      }
      await updateDoc(doc(db, "racks", existingRack.id), { assignedItems: assigned });
    } else {
      // Create new Rack with QR code
      const rName = rackName.trim() || `Rack ${cleanCode}`;
      const qrPayload = JSON.stringify({
        type: "RACK",
        code: cleanCode,
        name: rName,
        timestamp: Date.now(),
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: { dark: "#0d0d0d", light: "#ffffff" },
      });

      await addDoc(collection(db, "racks"), {
        name: rName,
        code: cleanCode,
        qrCodeUrl: qrDataUrl,
        notes: "Auto-created from Gift Hamper allocation",
        assignedItems: [itemInfo],
        createdAt: serverTimestamp(),
      });
    }
  };

  // Helper: assign or update item in a Serial Number
  const assignItemToSerial = async (
    serialNumber: string,
    hamperName: string,
    itemInfo: { itemId: string; name: string; barcodeId: string; quantity: number }
  ) => {
    if (!serialNumber.trim()) return;
    const cleanSN = serialNumber.trim();
    const existingSerial = serials.find(
      (s) => s.serialNumber?.toLowerCase() === cleanSN.toLowerCase()
    );

    if (existingSerial) {
      const assigned = [...(existingSerial.assignedItems || [])];
      const existIdx = assigned.findIndex((i) => i.itemId === itemInfo.itemId);
      if (existIdx >= 0) {
        assigned[existIdx].quantity += itemInfo.quantity;
      } else {
        assigned.push(itemInfo);
      }
      await updateDoc(doc(db, "serials", existingSerial.id), {
        assignedItems: assigned,
        status: "Assigned",
        itemName: hamperName,
      });
    } else {
      // Create new Serial Number with QR code
      const qrPayload = JSON.stringify({
        type: "SERIAL",
        sn: cleanSN,
        item: hamperName,
        timestamp: Date.now(),
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: { dark: "#0d0d0d", light: "#ffffff" },
      });

      await addDoc(collection(db, "serials"), {
        serialNumber: cleanSN,
        itemName: hamperName,
        qrCodeUrl: qrDataUrl,
        status: "Assigned",
        notes: "Auto-created from Gift Hamper allocation",
        assignedItems: [itemInfo],
        createdAt: serverTimestamp(),
      });
    }
  };

  // Create Single Gift Hamper
  const handleCreateHamper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

    try {
      setSavingItem(true);
      setSaveProgressStep("Preparing gift hamper...");

      const finalBarcode = isThirdParty
        ? barcodeId.trim() || generateNumericBarcode()
        : generateNumericBarcode();

      let finalImageUrl = DEFAULT_ITEM_IMAGE;
      if (imageFile && imagePreview) {
        setSaveProgressStep("Uploading hamper image to ImageKit...");
        try {
          const uploadRes = await fetch("/api/upload-imagekit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: imagePreview,
              fileName: `hamper_${finalBarcode}_${Date.now()}.png`,
              folder: "/gift_hampers",
            }),
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.url) {
            finalImageUrl = uploadData.url;
          } else {
            console.error("ImageKit upload response error:", uploadData);
            alert(`Notice: ImageKit upload failed (${uploadData?.error || "Unknown error"}). Hamper will be saved with default image.`);
            finalImageUrl = DEFAULT_ITEM_IMAGE;
          }
        } catch (uploadErr: any) {
          console.error("ImageKit upload failed:", uploadErr);
          alert(`Notice: ImageKit upload request failed (${uploadErr.message}). Hamper will be saved with default image.`);
          finalImageUrl = DEFAULT_ITEM_IMAGE;
        }
      }

      const validAllocations = allocations.filter(
        (a) => a.rackCode.trim() || a.serialNumber.trim()
      );

      const totalStock =
        validAllocations.length > 0
          ? validAllocations.reduce((acc, a) => acc + (Number(a.count) || 0), 0)
          : Number(stockCount) || 0;

      setSaveProgressStep("Saving Gift Hamper to inventory...");
      const docRef = await addDoc(collection(db, "items"), {
        name: name.trim(),
        price: Number(price),
        unit: unit.trim() || "Box",
        category: category.trim() || "Gift Hampers",
        hsnCode: hsnCode.trim() || "2106",
        gstPercent: Number(gstPercent) || 5,
        stockCount: totalStock,
        bufferStockCount: Number(bufferStockCount) || 5,
        isThirdParty,
        barcodeId: finalBarcode,
        imageUrl: finalImageUrl,
        isGiftHamper: true,
        rackAllocations: validAllocations,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      });

      // Synchronize with Racks and Serials
      for (const alloc of validAllocations) {
        const itemInfo = {
          itemId: docRef.id,
          name: name.trim(),
          barcodeId: finalBarcode,
          quantity: Number(alloc.count) || 1,
        };

        if (alloc.rackCode.trim()) {
          setSaveProgressStep(`Assigning to Rack ${alloc.rackCode}...`);
          await assignItemToRack(alloc.rackCode, alloc.rackName || "", itemInfo);
        }

        if (alloc.serialNumber.trim()) {
          setSaveProgressStep(`Assigning to Serial ${alloc.serialNumber}...`);
          await assignItemToSerial(alloc.serialNumber, name.trim(), itemInfo);
        }
      }

      // Reset form
      setName("");
      setPrice("");
      setUnit("Box");
      setCategory("Gift Hampers");
      setHsnCode("2106");
      setGstPercent(5);
      setStockCount(20);
      setBufferStockCount(5);
      setIsThirdParty(false);
      setBarcodeId("");
      setNotes("");
      setImageFile(null);
      setImagePreview("");
      setAllocations([{ rackCode: "", rackName: "", serialNumber: "", count: 10 }]);
      setIsAddModalOpen(false);
      fetchHamperServerCount();
      alert(`Gift Hamper "${name}" created and assigned successfully!`);
    } catch (err: any) {
      console.error("Failed to create hamper:", err);
      alert(`Error creating hamper: ${err.message}`);
    } finally {
      setSavingItem(false);
      setSaveProgressStep("");
    }
  };

  // Update Hamper
  const handleUpdateHamperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editHamper || !editName.trim() || editPrice === "") return;

    try {
      setUpdatingHamper(true);
      setEditProgressStep("Processing hamper changes...");

      let finalImageUrl = editHamper.imageUrl || DEFAULT_ITEM_IMAGE;
      if (editImageFile && editImagePreview && editImagePreview.startsWith("data:")) {
        setEditProgressStep("Uploading new image to ImageKit...");
        try {
          const uploadRes = await fetch("/api/upload-imagekit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: editImagePreview,
              fileName: `hamper_${editBarcodeId.trim() || editHamper.barcodeId}_${Date.now()}.png`,
              folder: "/gift_hampers",
            }),
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.url) {
            finalImageUrl = uploadData.url;
          }
        } catch (uploadErr) {
          console.error("ImageKit upload error in edit:", uploadErr);
        }
      } else if (!editImagePreview) {
        finalImageUrl = DEFAULT_ITEM_IMAGE;
      }

      const validAllocations = editAllocations.filter(
        (a) => a.rackCode.trim() || a.serialNumber.trim()
      );

      const totalStock =
        validAllocations.length > 0
          ? validAllocations.reduce((acc, a) => acc + (Number(a.count) || 0), 0)
          : Number(editStockCount) || 0;

      setEditProgressStep("Saving updates to inventory...");
      await updateDoc(doc(db, "items", editHamper.id), {
        name: editName.trim(),
        price: Number(editPrice),
        unit: editUnit.trim() || "Box",
        category: editCategory.trim() || "Gift Hampers",
        hsnCode: editHsnCode.trim() || "2106",
        gstPercent: Number(editGstPercent) || 5,
        stockCount: totalStock,
        bufferStockCount: Number(editBufferStockCount) || 5,
        isThirdParty: editIsThirdParty,
        barcodeId: editBarcodeId.trim() || editHamper.barcodeId,
        imageUrl: finalImageUrl,
        notes: editNotes.trim(),
        rackAllocations: validAllocations,
        isGiftHamper: true,
      });

      // Synchronize allocations
      for (const alloc of validAllocations) {
        const itemInfo = {
          itemId: editHamper.id,
          name: editName.trim(),
          barcodeId: editBarcodeId.trim() || editHamper.barcodeId,
          quantity: Number(alloc.count) || 1,
        };

        if (alloc.rackCode.trim()) {
          await assignItemToRack(alloc.rackCode, alloc.rackName || "", itemInfo);
        }
        if (alloc.serialNumber.trim()) {
          await assignItemToSerial(alloc.serialNumber, editName.trim(), itemInfo);
        }
      }

      setEditHamper(null);
      alert("Gift Hamper updated successfully!");
    } catch (err: any) {
      alert(`Failed to update hamper: ${err.message}`);
    } finally {
      setUpdatingHamper(false);
    }
  };

  // Delete Hamper
  const handleDeleteHamper = async (id: string, hamperName: string) => {
    if (confirm(`Are you sure you want to delete Gift Hamper "${hamperName}"?`)) {
      try {
        await deleteDoc(doc(db, "items", id));
        fetchHamperServerCount();
      } catch (err: any) {
        alert(`Failed to delete: ${err.message}`);
      }
    }
  };

  // ==================== GENERATE & DOWNLOAD 60 GIFT HAMPERS EXCEL ====================
  const handleDownloadSampleExcel = () => {
    const giftHamperNames = [
      "Royal Kaju Celebration Gift Box",
      "Dryfruit Delight Luxury Wooden Chest",
      "Diwali Grandeur Mithai Basket",
      "Silver Filigree Kaju Katli Box",
      "Kesar Pista Supreme Gift Hamper",
      "Assorted Luxury Sweets Platter",
      "Maharaja Gold Embossed Sweet Box",
      "Traditional Sweets & Savories Basket",
      "Anjeer & Dates Dryfruit Hamper",
      "Shahi Mithai Festive Potli Hamper",
      "Special Mysore Pak Festive Box",
      "Badam Halwa & Kaju Roll Treasure",
      "Executive Corporate Gift Hamper",
      "Wedding Auspicious Sweet Trunk",
      "Premium Motichoor & Dry Fruit Box",
      "Artisanal Sweet & Namkeen Caddy",
      "Diamond Kaju Katli Heritage Tin",
      "Festive Glow Diya & Sweet Hamper",
      "Ghee Sweets Royal Assortment",
      "Premium Cashew & Almond Royale",
      "Sri Balaji Signature Sweets Box",
      "Gold Leaf Kaju Barfi Hamper",
      "Grand Festive Family Feast Hamper",
      "Pure Ghee Special Laddu Box",
      "Rose & Kesar Petal Peda Basket",
      "Velvet Touch Sweet Treasure",
      "Royal Velvet Kaju Anjeer Hamper",
      "Celebration Bites Sweet Box",
      "Heritage Mithai Cane Basket",
      "Akhrot & Badam Halwa Deluxe",
      "Traditional South Indian Sweets Casket",
      "Pista & Kaju Roll Festival Box",
      "Dryfruit Chikki & Sweet Delicacy",
      "Shahi Gulab Jamun & Rasgulla Gift Tin",
      "Golden Peacock Mithai Box",
      "Floral Theme Luxury Mithai Hamper",
      "Royal Treat Dryfruit & Ladoo Trunk",
      "Kaju Kalash Special Gift Pack",
      "Besan & Rava Laddu Traditional Hamper",
      "Sweet Bond Celebration Hamper",
      "Malai Peda & Milk Cake Celebration",
      "Handcrafted Jute Sweet Basket",
      "Exotic Dryfruit Laddoo Hamper",
      "Shahi Doodh Peda Gift Box",
      "Supreme Ghee Halwa Tri-Combo",
      "Festive Crunchy Mixture & Sweet Crate",
      "Royal Brass Finish Mithai Box",
      "Almond & Cashew Silver Plated Box",
      "Special Chekkalu & Sweets Combo Box",
      "Sweet Symphony Mixed Mithai Tray",
      "Special Karachi & Bombay Halwa Hamper",
      "Kaju Chocolate Fusion Gift Box",
      "Grand Festive Ribbon Hamper",
      "Pure Pistachio & Walnut Sweet Casket",
      "Imperial Sweets & Savories Gift Hamper",
      "Golden Twilight Sweet Box",
      "Royal Heritage Dryfruit Box",
      "Special Ghee Jalebi & Imarti Hamper",
      "Royal Celebrations Elite Sweet Trunk",
      "Balaji Masterpiece Grand Hamper",
    ];

    const rackList = [
      { code: "RCK-GH-1", name: "Hamper Showcase Rack A1" },
      { code: "RCK-GH-2", name: "Hamper Showcase Rack A2" },
      { code: "RCK-GH-3", name: "Royal Trunks Section B1" },
      { code: "RCK-GH-4", name: "Dryfruit Wooden Chest Section" },
      { code: "RCK-GH-5", name: "Diwali Special Display Rack" },
      { code: "RCK-GH-6", name: "Executive Hampers Shelf C1" },
      { code: "RCK-GH-7", name: "Corporate Bulk Hampers Rack" },
      { code: "RCK-GH-8", name: "Wedding Trunks Storage D1" },
      { code: "RCK-GH-9", name: "Festive Basket Display Rack" },
      { code: "RCK-GH-10", name: "Premium Kaju Hampers Shelf" },
      { code: "RCK-GH-11", name: "Cold Storage Ghee Hampers" },
      { code: "RCK-GH-12", name: "Front Counter Showcase Hampers" },
    ];

    const rows = [];
    for (let i = 0; i < 60; i++) {
      const hamperName = giftHamperNames[i] || `Gift Hamper #${i + 1}`;
      const price = Math.floor(750 + (i % 15) * 190);
      const rackObj = rackList[i % rackList.length];
      const serialNum = `SN-GH-${String(i + 1).padStart(3, "0")}`;
      const count = Math.floor(10 + (i % 6) * 5); // 10, 15, 20, 25, 30, 35
      const barcodeId = `890888${String(100001 + i)}`;
      const unit = i % 3 === 0 ? "Hamper" : i % 2 === 0 ? "Box" : "Set";

      rows.push({
        "Hamper Name": hamperName,
        "Price": price,
        "Unit": unit,
        "Category": "Gift Hampers",
        "HSN Code": "2106",
        "GST Percent": 5,
        "Stock Count": count,
        "Buffer Stock Count": 5,
        "Is Third Party": "No",
        "Barcode ID": barcodeId,
        "Rack Code": rackObj.code,
        "Rack Name": rackObj.name,
        "Serial Number": serialNum,
        "Allocation Count": count,
        "Image URL": "", // Optional: ImageKit or hosted image URL. If blank, default image is used.
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 38 }, // Hamper Name
      { wch: 10 }, // Price
      { wch: 10 }, // Unit
      { wch: 16 }, // Category
      { wch: 12 }, // HSN Code
      { wch: 12 }, // GST Percent
      { wch: 12 }, // Stock Count
      { wch: 18 }, // Buffer Stock Count
      { wch: 14 }, // Is Third Party
      { wch: 16 }, // Barcode ID
      { wch: 14 }, // Rack Code
      { wch: 28 }, // Rack Name
      { wch: 16 }, // Serial Number
      { wch: 16 }, // Allocation Count
      { wch: 32 }, // Image URL
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "60 Gift Hampers");
    XLSX.writeFile(workbook, "Sri_Balaji_Sweets_60_Gift_Hampers.xlsx");
  };

  // ==================== BULK IMPORT 60 GIFT HAMPERS ====================
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) {
      alert("Please select an Excel (.xlsx, .xls) file.");
      return;
    }

    try {
      setBulkUploading(true);
      const dataBuffer = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (jsonRows.length === 0) {
        alert("The uploaded Excel file contains no data rows.");
        setBulkUploading(false);
        return;
      }

      const total = jsonRows.length;

      // In-memory lookup maps to prevent duplicate queries and optimize speed
      const rackMap = new Map<string, RackDoc>();
      racks.forEach((r) => rackMap.set(r.code.toLowerCase(), r));

      const serialMap = new Map<string, SerialDoc>();
      serials.forEach((s) => serialMap.set(s.serialNumber.toLowerCase(), s));

      for (let i = 0; i < total; i++) {
        const row = jsonRows[i];

        const rowName =
          row["Hamper Name"] || row["Item Name"] || row["name"] || `Gift Hamper #${i + 1}`;
        const rowPrice = Number(row["Price"] || row["price"]) || 999;
        const rowUnit = String(row["Unit"] || row["unit"] || "Box").trim();
        const rowCategory = "Gift Hampers";
        const rowHsn = String(row["HSN Code"] || row["hsnCode"] || "2106").trim();
        const rowGst = Number(row["GST Percent"] || row["gstPercent"]) || 5;
        const rowStock = Number(row["Stock Count"] || row["stockCount"]) || 20;
        const rowBuffer = Number(row["Buffer Stock Count"] || row["bufferStockCount"]) || 5;
        const thirdPartyRaw = String(row["Is Third Party"] || "").toLowerCase();
        const rowThirdParty = thirdPartyRaw === "yes" || thirdPartyRaw === "true";
        const rowBarcode =
          String(row["Barcode ID"] || row["barcodeId"] || "").trim() ||
          generateNumericBarcode();

        const rowRawImageUrl = String(
          row["Image URL"] ||
          row["Image"] ||
          row["imageUrl"] ||
          row["image"] ||
          row["Image Link"] ||
          ""
        ).trim();
        // If no image URL in bulk file, use default image
        const rowImageUrl = rowRawImageUrl || DEFAULT_ITEM_IMAGE;

        const rowRackCode = String(row["Rack Code"] || row["Rack Number"] || row["rackCode"] || "").trim();
        const rowRackName = String(row["Rack Name"] || row["rackName"] || "").trim();
        const rowSerial = String(row["Serial Number"] || row["serialNumber"] || "").trim();
        const rowAllocCount = Number(row["Allocation Count"] || row["Count"] || row["Quantity"] || rowStock) || 10;

        setBulkProgress({
          current: i + 1,
          total,
          step: `Creating Hamper: ${rowName}...`,
        });

        const allocationsData: RackAllocation[] = [];
        if (rowRackCode || rowSerial) {
          allocationsData.push({
            rackCode: rowRackCode,
            rackName: rowRackName,
            serialNumber: rowSerial,
            count: rowAllocCount,
          });
        }

        // 1. Create Gift Hamper Item in Firestore
        const docRef = await addDoc(collection(db, "items"), {
          name: rowName.toString().trim(),
          price: rowPrice,
          unit: rowUnit || "Box",
          category: rowCategory,
          hsnCode: rowHsn,
          gstPercent: rowGst,
          stockCount: rowAllocCount || rowStock,
          bufferStockCount: rowBuffer,
          isThirdParty: rowThirdParty,
          barcodeId: rowBarcode,
          imageUrl: rowImageUrl,
          isGiftHamper: true,
          rackAllocations: allocationsData,
          notes: "Imported via Bulk Excel Upload",
          createdAt: serverTimestamp(),
        });

        const hamperItemObj = {
          itemId: docRef.id,
          name: rowName.toString().trim(),
          barcodeId: rowBarcode,
          quantity: rowAllocCount,
        };

        // 2. Handle Rack creation & assignment
        if (rowRackCode) {
          const rackKey = rowRackCode.toLowerCase();
          const existingRack = rackMap.get(rackKey);

          if (existingRack) {
            const assigned = [...(existingRack.assignedItems || [])];
            const idx = assigned.findIndex((it) => it.itemId === docRef.id);
            if (idx >= 0) {
              assigned[idx].quantity += rowAllocCount;
            } else {
              assigned.push(hamperItemObj);
            }
            await updateDoc(doc(db, "racks", existingRack.id), { assignedItems: assigned });
            existingRack.assignedItems = assigned;
          } else {
            setBulkProgress({
              current: i + 1,
              total,
              step: `Creating Rack ${rowRackCode} & QR...`,
            });
            const rName = rowRackName || `Rack ${rowRackCode}`;
            const qrPayload = JSON.stringify({
              type: "RACK",
              code: rowRackCode,
              name: rName,
              timestamp: Date.now(),
            });
            const qrDataUrl = await QRCode.toDataURL(qrPayload, {
              width: 400,
              margin: 2,
              color: { dark: "#0d0d0d", light: "#ffffff" },
            });

            const newRackRef = await addDoc(collection(db, "racks"), {
              name: rName,
              code: rowRackCode,
              qrCodeUrl: qrDataUrl,
              notes: "Auto-created from Gift Hamper bulk upload",
              assignedItems: [hamperItemObj],
              createdAt: serverTimestamp(),
            });

            rackMap.set(rackKey, {
              id: newRackRef.id,
              name: rName,
              code: rowRackCode,
              qrCodeUrl: qrDataUrl,
              assignedItems: [hamperItemObj],
            });
          }
        }

        // 3. Handle Serial Number creation & assignment
        if (rowSerial) {
          const serialKey = rowSerial.toLowerCase();
          const existingSerial = serialMap.get(serialKey);

          if (existingSerial) {
            const assigned = [...(existingSerial.assignedItems || [])];
            const idx = assigned.findIndex((it) => it.itemId === docRef.id);
            if (idx >= 0) {
              assigned[idx].quantity += rowAllocCount;
            } else {
              assigned.push(hamperItemObj);
            }
            await updateDoc(doc(db, "serials", existingSerial.id), {
              assignedItems: assigned,
              status: "Assigned",
              itemName: rowName.toString().trim(),
            });
            existingSerial.assignedItems = assigned;
            existingSerial.status = "Assigned";
          } else {
            setBulkProgress({
              current: i + 1,
              total,
              step: `Creating Serial ${rowSerial} & QR...`,
            });
            const qrPayload = JSON.stringify({
              type: "SERIAL",
              sn: rowSerial,
              item: rowName.toString().trim(),
              timestamp: Date.now(),
            });
            const qrDataUrl = await QRCode.toDataURL(qrPayload, {
              width: 400,
              margin: 2,
              color: { dark: "#0d0d0d", light: "#ffffff" },
            });

            const newSerialRef = await addDoc(collection(db, "serials"), {
              serialNumber: rowSerial,
              itemName: rowName.toString().trim(),
              qrCodeUrl: qrDataUrl,
              status: "Assigned",
              notes: "Auto-created from Gift Hamper bulk upload",
              assignedItems: [hamperItemObj],
              createdAt: serverTimestamp(),
            });

            serialMap.set(serialKey, {
              id: newSerialRef.id,
              serialNumber: rowSerial,
              itemName: rowName.toString().trim(),
              qrCodeUrl: qrDataUrl,
              status: "Assigned",
              assignedItems: [hamperItemObj],
            });
          }
        }
      }

      setIsBulkModalOpen(false);
      setBulkFile(null);
      setBulkProgress(null);
      fetchHamperServerCount();
      alert(`Successfully imported all ${total} Gift Hampers with automatic Rack and Serial allocations!`);
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      alert(`Bulk upload error: ${err.message}`);
    } finally {
      setBulkUploading(false);
      setBulkProgress(null);
    }
  };

  // Filtered Hampers
  const filteredHampers = hampers.filter((h) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      h.name.toLowerCase().includes(q) ||
      h.barcodeId.toLowerCase().includes(q) ||
      h.rackAllocations?.some(
        (a) =>
          a.rackCode.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q)
      );

    const matchesRack =
      rackFilter === "all" ||
      h.rackAllocations?.some(
        (a) => a.rackCode.toLowerCase() === rackFilter.toLowerCase()
      );

    return matchesSearch && matchesRack;
  });

  // Calculate Pagination Slices (Strict Limit of 24 items per page)
  const totalPages = Math.ceil(filteredHampers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedHampers = filteredHampers.slice(startIndex, endIndex);

  // Reusable Pagination Bar (rendered if totalPages > 1)
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="p-3.5 bg-neutral-50/90 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-neutral-600 font-medium">
          <span>
            Showing <strong className="font-mono text-neutral-900">{filteredHampers.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
            <strong className="font-mono text-neutral-900">
              {Math.min(endIndex, filteredHampers.length)}
            </strong>{" "}
            of <strong className="font-mono text-neutral-900">{filteredHampers.length}</strong> gift hampers
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-pink-100 text-pink-700 text-[11px] font-semibold">
            24 items / page
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {/* First Page Button */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="p-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
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

          {/* Next Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page Button */}
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
      </div>
    );
  };

  // Calculate KPIs
  const totalStockCount = hampers.reduce((acc, h) => acc + (h.stockCount || 0), 0);
  const uniqueRacksUsed = new Set(
    hampers.flatMap((h) => h.rackAllocations?.map((a) => a.rackCode.toLowerCase()) || [])
  ).size;
  const uniqueSerialsUsed = new Set(
    hampers.flatMap((h) => h.rackAllocations?.map((a) => a.serialNumber.toLowerCase()) || [])
  ).size;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-pink-600 via-rose-600 to-amber-600 text-white shadow-xs">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Gift Hampers & Multi-Rack Inventory
              </h1>
              <p className="text-xs text-neutral-500">
                Manage festival hampers, track multiple rack and serial allocations, and bulk upload 60 items
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Download 60 Hampers Excel Template */}
            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
              title="Download pre-filled Excel with 60 Gift Hampers with Rack and Serial details"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Download 60 Hampers Excel</span>
            </button>

            {/* Bulk Upload Excel */}
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100/80 border border-blue-300 text-blue-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-blue-700" />
              <span>Bulk Upload</span>
            </button>

            {/* Add Hamper Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Gift Hamper</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 font-medium">Total Gift Hampers</p>
              <h3 className="text-base font-bold text-neutral-900">
                {serverHamperCount !== null ? Math.max(serverHamperCount, hampers.length) : hampers.length} Items
              </h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 font-medium">Total Hamper Units</p>
              <h3 className="text-base font-bold text-neutral-900">{totalStockCount} Units</h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 font-medium">Assigned Racks</p>
              <h3 className="text-base font-bold text-neutral-900">{uniqueRacksUsed} Racks</h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 font-medium">Assigned Serials</p>
              <h3 className="text-base font-bold text-neutral-900">{uniqueSerialsUsed} Serials</h3>
            </div>
          </div>
        </div>

        {/* Filter & View Switcher Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, barcode, rack code, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 text-xs text-neutral-800 placeholder-neutral-400 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500"
              />
            </div>

            {/* Filter by Rack */}
            <select
              value={rackFilter}
              onChange={(e) => setRackFilter(e.target.value)}
              className="bg-neutral-50 text-xs text-neutral-800 py-2 px-3 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Racks</option>
              {racks.map((r) => (
                <option key={r.id} value={r.code}>
                  Rack: {r.code} ({r.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-neutral-700" />
            <span className="text-xs font-medium">Loading Gift Hampers from Firebase...</span>
          </div>
        ) : filteredHampers.length === 0 ? (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mb-3 border border-pink-200">
              <Gift className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No Gift Hampers Found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mb-5">
              Click "Bulk Upload" to import 60 pre-configured gift hampers with Rack & Serial allocations, or click "Add Gift Hamper".
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadSampleExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Download 60 Hampers Template</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Upload Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Hamper</span>
              </button>
            </div>
          </div>
        ) : viewMode === "list" ? (
          /* ==================== LIST VIEW TABLE ==================== */
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-16">Image</th>
                    <th className="py-3 px-4">Hamper Details</th>
                    <th className="py-3 px-4">Price & Unit</th>
                    <th className="py-3 px-4">Stock Units</th>
                    <th className="py-3 px-4">Rack & Serial Allocations</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {paginatedHampers.map((hamper) => {
                    return (
                      <tr
                        key={hamper.id}
                        className="hover:bg-neutral-50/60 transition-colors group"
                      >
                        {/* Thumbnail */}
                        <td className="py-3 px-4">
                          <img
                            src={hamper.imageUrl || DEFAULT_ITEM_IMAGE}
                            alt={hamper.name}
                            className="w-11 h-11 object-cover rounded-lg border border-neutral-200 bg-white"
                          />
                        </td>

                        {/* Name & Barcode */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-neutral-900 text-sm">
                            {hamper.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-300">
                              {hamper.barcodeId}
                            </span>
                            <span className="text-[10px] text-pink-700 font-semibold bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200">
                              {hamper.category || "Gift Hampers"}
                            </span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-neutral-900 text-sm">
                            ₹{hamper.price}
                          </span>
                          <span className="text-neutral-500 text-[11px] ml-1">
                            / {hamper.unit || "Box"}
                          </span>
                          <div className="text-[10px] text-neutral-400">
                            GST: {hamper.gstPercent}% | HSN: {hamper.hsnCode}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              hamper.stockCount > 10
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            <Package className="w-3 h-3" />
                            {hamper.stockCount} {hamper.unit || "Units"}
                          </span>
                        </td>

                        {/* Rack & Serial Allocations */}
                        <td className="py-3 px-4">
                          {hamper.rackAllocations && hamper.rackAllocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {hamper.rackAllocations.map((alloc, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.8 rounded-lg bg-neutral-50 border border-neutral-200 text-[11px] font-medium text-neutral-800"
                                >
                                  {alloc.rackCode && (
                                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                                      Rack: {alloc.rackCode}
                                    </span>
                                  )}
                                  {alloc.serialNumber && (
                                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1 rounded">
                                      SN: {alloc.serialNumber}
                                    </span>
                                  )}
                                  <span className="font-bold text-emerald-800 bg-emerald-50 px-1 rounded">
                                    {alloc.count} units
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">
                              No rack/serial allocated
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View */}
                            <button
                              type="button"
                              onClick={() => setViewHamper(hamper)}
                              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="View details & rack breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(hamper)}
                              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Edit hamper & allocations"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Print Tag */}
                            <button
                              type="button"
                              onClick={() =>
                                setPrintTag({
                                  title: hamper.name,
                                  subtitle: `GIFT HAMPER | ${hamper.category}`,
                                  barcodeId: hamper.barcodeId,
                                  price: hamper.price,
                                  rackInfo:
                                    hamper.rackAllocations &&
                                    hamper.rackAllocations.length > 0
                                      ? hamper.rackAllocations
                                          .map((a) => `${a.rackCode}(${a.count})`)
                                          .join(", ")
                                      : undefined,
                                })
                              }
                              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Print Barcode Tag"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteHamper(hamper.id, hamper.name)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Delete Hamper"
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
            {renderPagination()}
          </div>
        ) : (
          /* ==================== GRID VIEW ==================== */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedHampers.map((hamper) => {
              return (
                <div
                  key={hamper.id}
                  className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Name & Price */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200">
                          {hamper.category || "Gift Hamper"}
                        </span>
                        <h3 className="text-sm font-bold text-neutral-900 mt-1 line-clamp-1">
                          {hamper.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-neutral-900">
                          ₹{hamper.price}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">
                          / {hamper.unit || "Box"}
                        </span>
                      </div>
                    </div>

                    {/* Image */}
                    <div className="w-full h-40 bg-neutral-50 rounded-xl overflow-hidden my-2.5 border border-neutral-200 flex items-center justify-center relative">
                      <img
                        src={hamper.imageUrl || DEFAULT_ITEM_IMAGE}
                        alt={hamper.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
                        Stock: {hamper.stockCount}
                      </div>
                    </div>

                    {/* Barcode */}
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-2 font-mono">
                      <span>Barcode: {hamper.barcodeId}</span>
                      <span>GST: {hamper.gstPercent}%</span>
                    </div>

                    {/* Rack & Serial Allocations */}
                    <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200 space-y-1.5 mb-2">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-neutral-600" />
                        <span>Rack & Serial Allocations</span>
                      </div>
                      {hamper.rackAllocations && hamper.rackAllocations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {hamper.rackAllocations.map((alloc, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-800"
                            >
                              <strong className="text-amber-700">{alloc.rackCode}</strong>
                              {" : "}
                              <strong className="text-blue-700">{alloc.serialNumber}</strong>
                              {" -> "}
                              <strong className="text-emerald-700">{alloc.count} pcs</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-neutral-400 italic">
                          No allocation configured
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-neutral-100 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewHamper(hamper)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(hamper)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPrintTag({
                          title: hamper.name,
                          subtitle: `GIFT HAMPER | ${hamper.category}`,
                          barcodeId: hamper.barcodeId,
                          price: hamper.price,
                        })
                      }
                      className="flex items-center justify-center gap-1 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid View Pagination */}
          {totalPages > 1 && (
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
              {renderPagination()}
            </div>
          )}
        </div>
      )}

        {/* ==================== ADD GIFT HAMPER MODAL ==================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-pink-50/60">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-pink-600 text-white">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Add New Gift Hamper
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Set hamper details, price, and assign multiple racks and serial numbers
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingItem && setIsAddModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateHamper} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* 1. Basic Item Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Gift Hamper Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Dryfruit Festive Hamper"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Selling Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="e.g. 1450"
                      value={price}
                      onChange={(e) =>
                        setPrice(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                    >
                      <option value="Box">Box</option>
                      <option value="Hamper">Hamper</option>
                      <option value="Set">Set</option>
                      <option value="Piece">Piece</option>
                      <option value="Pack">Pack</option>
                      <option value="KG">KG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      GST Percent (%)
                    </label>
                    <select
                      value={gstPercent}
                      onChange={(e) => setGstPercent(Number(e.target.value))}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5% (Standard for Sweets)</option>
                      <option value={12}>12% (Standard for Gift Trunks)</option>
                      <option value={18}>18%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Buffer Stock Alert Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={bufferStockCount}
                      onChange={(e) =>
                        setBufferStockCount(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Barcode ID (Auto-generated 12-digit numeric if left blank)
                    </label>
                    <input
                      type="text"
                      placeholder="Leave blank to auto-generate unique barcode"
                      value={barcodeId}
                      onChange={(e) => setBarcodeId(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Hamper Contents / Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 500g Kaju Katli + 250g Almonds + 2 Brass Diyas"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>

                  {/* Hamper Image Upload with ImageKit */}
                  <div className="sm:col-span-2 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-pink-600" />
                        <span>Hamper Image</span>
                        <span className="text-[10px] font-normal text-neutral-500">(Optional)</span>
                      </label>
                      <span className="text-[10px] bg-pink-100 text-pink-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <UploadCloud className="w-3 h-3" />
                        Uploads to ImageKit on Save
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-neutral-300 hover:border-pink-500 text-neutral-700 hover:text-pink-700 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                        <UploadCloud className="w-4 h-4 text-neutral-500" />
                        <span>{imageFile ? "Change Image" : "Choose Image"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={savingItem}
                          className="hidden"
                        />
                      </label>

                      {imagePreview ? (
                        <div className="flex items-center gap-3 bg-white p-1.5 pr-3 rounded-lg border border-neutral-200">
                          <img
                            src={imagePreview}
                            alt="Selected Hamper"
                            className="w-12 h-12 object-cover rounded-md border border-neutral-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800 truncate max-w-[180px]">
                              {imageFile?.name || "hamper-image.png"}
                            </p>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready for ImageKit upload
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearImage}
                            disabled={savingItem}
                            className="ml-2 p-1 text-neutral-400 hover:text-red-500 rounded-md cursor-pointer"
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                          <img
                            src={DEFAULT_ITEM_IMAGE}
                            alt="Default Hamper"
                            className="w-8 h-8 object-cover rounded border border-neutral-200 opacity-60"
                          />
                          <span>No file chosen. Default gift hamper image will be used.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Multiple Rack & Serial Allocations */}
                <div className="pt-4 border-t border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-amber-600" />
                        <span>Rack & Serial Allocations</span>
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        In what rack and what serial number is this hamper stored, and how much count is present?
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAllocations((prev) => [
                          ...prev,
                          { rackCode: "", rackName: "", serialNumber: "", count: 10 },
                        ])
                      }
                      className="flex items-center gap-1 text-xs font-bold text-pink-700 hover:text-pink-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Another Allocation</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {allocations.map((alloc, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        {/* Rack Code & Input */}
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Rack Code / Location
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. RCK-A1 or choose"
                            value={alloc.rackCode}
                            list={`rack-datalist-${idx}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, rackCode: val } : a
                                )
                              );
                            }}
                            disabled={savingItem}
                            className="w-full bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 font-mono"
                          />
                          <datalist id={`rack-datalist-${idx}`}>
                            {racks.map((r) => (
                              <option key={r.id} value={r.code}>
                                {r.name}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        {/* Serial Number Input */}
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. SN-GH-001"
                            value={alloc.serialNumber}
                            list={`serial-datalist-${idx}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, serialNumber: val } : a
                                )
                              );
                            }}
                            disabled={savingItem}
                            className="w-full bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 font-mono"
                          />
                          <datalist id={`serial-datalist-${idx}`}>
                            {serials.map((s) => (
                              <option key={s.id} value={s.serialNumber}>
                                {s.itemName}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        {/* Count / Quantity */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Units Count
                          </label>
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={alloc.count}
                            onChange={(e) => {
                              const qty = Number(e.target.value);
                              setAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, count: qty } : a
                                )
                              );
                            }}
                            disabled={savingItem}
                            className="w-full bg-white text-xs text-neutral-900 p-2 rounded-lg border border-neutral-300 font-mono text-center"
                          />
                        </div>

                        {/* Remove button */}
                        <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-0">
                          {allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer"
                              title="Remove allocation row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-pink-50/60 rounded-lg border border-pink-200 text-xs text-pink-900 flex items-center justify-between font-medium">
                    <span>Total Hamper Stock Count:</span>
                    <strong className="font-mono text-sm">
                      {allocations.reduce(
                        (acc, a) => acc + (Number(a.count) || 0),
                        0
                      )}{" "}
                      Units
                    </strong>
                  </div>
                </div>

                {savingItem && (
                  <div className="p-3 bg-pink-50 rounded-lg border border-pink-200 text-pink-900 text-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-pink-700 shrink-0" />
                    <span className="font-semibold">{saveProgressStep}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={savingItem}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingItem || !name.trim() || price === ""}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingItem ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Gift className="w-3.5 h-3.5" />
                    )}
                    <span>Save Gift Hamper</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== VIEW HAMPER MODAL ==================== */}
        {viewHamper && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-pink-600 text-white">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      {viewHamper.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      BARCODE: {viewHamper.barcodeId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewHamper(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center gap-4">
                  <img
                    src={viewHamper.imageUrl || DEFAULT_ITEM_IMAGE}
                    alt={viewHamper.name}
                    className="w-24 h-24 object-cover rounded-xl border border-neutral-200 shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="text-lg font-bold text-neutral-900">
                      ₹{viewHamper.price}{" "}
                      <span className="text-xs font-normal text-neutral-500">
                        / {viewHamper.unit || "Box"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600">
                      <strong>Category:</strong> {viewHamper.category}
                    </div>
                    <div className="text-xs text-neutral-600">
                      <strong>HSN Code:</strong> {viewHamper.hsnCode} |{" "}
                      <strong>GST:</strong> {viewHamper.gstPercent}%
                    </div>
                    <div className="text-xs text-neutral-600">
                      <strong>Total Stock:</strong>{" "}
                      <span className="font-bold text-emerald-700">
                        {viewHamper.stockCount} {viewHamper.unit || "Units"}
                      </span>
                    </div>
                  </div>
                </div>

                {viewHamper.notes && (
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                    <strong>Notes / Contents:</strong> {viewHamper.notes}
                  </div>
                )}

                {/* Rack & Serial Breakdown Table */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-600" />
                    <span>Rack & Serial Location Breakdown</span>
                  </h4>

                  {viewHamper.rackAllocations &&
                  viewHamper.rackAllocations.length > 0 ? (
                    <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Rack Number</th>
                            <th className="py-2 px-3">Serial Number</th>
                            <th className="py-2 px-3 text-right">Units Stored</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {viewHamper.rackAllocations.map((alloc, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50">
                              <td className="py-2 px-3 font-mono font-bold text-amber-800">
                                {alloc.rackCode || "-"}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-blue-800">
                                {alloc.serialNumber || "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                                {alloc.count} units
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500">
                      No rack/serial allocations configured.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const cur = viewHamper;
                    setViewHamper(null);
                    handleOpenEdit(cur);
                  }}
                  className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Edit Hamper
                </button>
                <button
                  type="button"
                  onClick={() => setViewHamper(null)}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== EDIT HAMPER MODAL ==================== */}
        {editHamper && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-neutral-900 text-white">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Edit Gift Hamper
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      ID: {editHamper.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !updatingHamper && setEditHamper(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateHamperSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Hamper Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={updatingHamper}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editPrice}
                      onChange={(e) =>
                        setEditPrice(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      disabled={updatingHamper}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      disabled={updatingHamper}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    >
                      <option value="Box">Box</option>
                      <option value="Hamper">Hamper</option>
                      <option value="Set">Set</option>
                      <option value="Piece">Piece</option>
                      <option value="Pack">Pack</option>
                      <option value="KG">KG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Barcode ID
                    </label>
                    <input
                      type="text"
                      value={editBarcodeId}
                      onChange={(e) => setEditBarcodeId(e.target.value)}
                      disabled={updatingHamper}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      GST Percent (%)
                    </label>
                    <select
                      value={editGstPercent}
                      onChange={(e) => setEditGstPercent(Number(e.target.value))}
                      disabled={updatingHamper}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                    </select>
                  </div>

                  {/* Hamper Image Upload for Edit */}
                  <div className="sm:col-span-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-pink-600" />
                        <span>Hamper Image</span>
                      </label>
                      <span className="text-[10px] bg-pink-100 text-pink-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <UploadCloud className="w-3 h-3" />
                        ImageKit Cloud
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-300 hover:border-pink-500 text-neutral-700 hover:text-pink-700 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                        <UploadCloud className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{editImagePreview ? "Replace Image" : "Upload Image"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageChange}
                          disabled={updatingHamper}
                          className="hidden"
                        />
                      </label>

                      {editImagePreview ? (
                        <div className="flex items-center gap-3 bg-white p-1.5 pr-3 rounded-lg border border-neutral-200">
                          <img
                            src={editImagePreview}
                            alt="Hamper"
                            className="w-10 h-10 object-cover rounded-md border border-neutral-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800 truncate max-w-[160px]">
                              {editImageFile ? editImageFile.name : "Current image"}
                            </p>
                            <span className="text-[10px] text-neutral-500">
                              {editImageFile ? "Will upload to ImageKit on save" : "Active hamper image"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearEditImage}
                            disabled={updatingHamper}
                            className="ml-2 p-1 text-neutral-400 hover:text-red-500 rounded-md cursor-pointer"
                            title="Reset to default image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                          <img
                            src={DEFAULT_ITEM_IMAGE}
                            alt="Default"
                            className="w-7 h-7 object-cover rounded border border-neutral-200 opacity-60"
                          />
                          <span>Using default gift hamper image.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Rack & Serial Allocations */}
                <div className="pt-4 border-t border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-amber-600" />
                        <span>Rack & Serial Allocations</span>
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Adjust rack locations, serial numbers, and unit counts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditAllocations((prev) => [
                          ...prev,
                          { rackCode: "", rackName: "", serialNumber: "", count: 10 },
                        ])
                      }
                      className="flex items-center gap-1 text-xs font-bold text-pink-700 hover:text-pink-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Row</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editAllocations.map((alloc, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Rack Code
                          </label>
                          <input
                            type="text"
                            value={alloc.rackCode}
                            placeholder="e.g. RCK-A1"
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, rackCode: val } : a
                                )
                              );
                            }}
                            className="w-full bg-white text-xs p-2 rounded-lg border border-neutral-300 font-mono"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            value={alloc.serialNumber}
                            placeholder="e.g. SN-GH-001"
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, serialNumber: val } : a
                                )
                              );
                            }}
                            className="w-full bg-white text-xs p-2 rounded-lg border border-neutral-300 font-mono"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Units
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={alloc.count}
                            onChange={(e) => {
                              const qty = Number(e.target.value);
                              setEditAllocations((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, count: qty } : a
                                )
                              );
                            }}
                            className="w-full bg-white text-xs p-2 rounded-lg border border-neutral-300 font-mono text-center"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-center pt-3 sm:pt-0">
                          {editAllocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditAllocations((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {updatingHamper && (
                  <div className="p-3 bg-pink-50 rounded-lg border border-pink-200 text-pink-900 text-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-pink-700 shrink-0" />
                    <span className="font-semibold">{editProgressStep || "Updating Gift Hamper..."}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditHamper(null)}
                    disabled={updatingHamper}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingHamper}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    {updatingHamper ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Update Hamper</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== BULK UPLOAD EXCEL MODAL ==================== */}
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
              <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/60">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-600 text-white">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Bulk Upload Gift Hampers
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Upload Excel file with up to 60 gift hampers, auto-create racks & serials
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !bulkUploading && setIsBulkModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBulkImportSubmit} className="p-5 space-y-4">
                {/* Step 1: Download pre-filled template */}
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">
                      Step 1: Download Sample 60-Hamper Excel
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadSampleExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Excel Template</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    This file contains 60 realistic Sri Balaji Sweets gift hampers with Rack numbers, Serial numbers, counts, and an optional Image URL column. If no image URL is provided, the default hamper image is automatically used.
                  </p>
                </div>

                {/* Step 2: Choose Excel file */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700">
                    Step 2: Choose & Select Excel File (.xlsx, .xls) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    required
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setBulkFile(e.target.files[0]);
                      }
                    }}
                    disabled={bulkUploading}
                    className="w-full text-xs text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-neutral-300 rounded-lg p-2 bg-white"
                  />
                  {bulkFile && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected: {bulkFile.name} ({(bulkFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                {/* Live Progress Bar */}
                {bulkProgress && (
                  <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                        Uploading & Assigning Racks/Serials...
                      </span>
                      <span>
                        {bulkProgress.current} / {bulkProgress.total}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-blue-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                        style={{
                          width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-blue-800 font-mono truncate">
                      {bulkProgress.step}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px]">
                  <strong>Automatic Sync:</strong> All Racks and Serial Numbers listed in the Excel file will be automatically created in the Utilities page if they don't already exist, and hamper products with their respective counts will be automatically assigned.
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    disabled={bulkUploading}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkUploading || !bulkFile}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {bulkUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Upload & Create 60 Hampers</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== PRINT TAG MODAL ==================== */}
        {printTag && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 border border-neutral-300 text-center">
              <div className="border-2 border-dashed border-neutral-800 rounded-xl p-6 bg-white flex flex-col items-center justify-center">
                <h2 className="text-lg font-extrabold text-neutral-900 uppercase tracking-tight">
                  Sri Balaji Sweets
                </h2>
                <p className="text-xs font-bold text-neutral-800 mt-1">
                  {printTag.title}
                </p>
                <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded mt-1 border border-neutral-300">
                  {printTag.subtitle}
                </span>

                <div className="my-3 text-2xl font-extrabold text-neutral-900 font-mono">
                  ₹{printTag.price}
                </div>

                <div className="font-mono text-xs font-bold text-neutral-700 border-t border-b border-neutral-200 py-1 w-full my-2">
                  * {printTag.barcodeId} *
                </div>

                {printTag.rackInfo && (
                  <p className="text-[10px] text-amber-800 font-mono font-semibold">
                    Locations: {printTag.rackInfo}
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPrintTag(null)}
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
      </div>
    </AppLayout>
  );
}
