"use client";

import React, { useState, useEffect, useRef } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import JsBarcode from "jsbarcode";
import {
  Barcode,
  Printer,
  Download,
  Search,
  Plus,
  Trash2,
  Check,
  Package,
  Layers,
  Sliders,
  Eye,
  ScanLine,
  Scale,
  Boxes,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface ItemProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  unit?: string;
  hsnCode?: string;
  gstPercent?: number;
  stockCount?: number;
  barcodeId: string;
  imageUrl?: string;
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
  unallocatedQuantity?: number;
  status?: string;
  createdAt?: any;
}

interface StickerItem {
  id: string;
  businessName: string;
  itemTitle: string;
  unitLabel: string;
  barcodeId: string;
  batchCode: number | string;
  expiryDate?: string;
  encodedBarcode: string; // itembarcodeid*weight*batchnumber
  mrp: number;
  printQuantity: number;
}

const PRESET_WEIGHTS = [
  { label: "100 GM", value: "100", unit: "GM", factor: 0.1 },
  { label: "250 GM BOX", value: "250", unit: "GM", factor: 0.25 },
  { label: "400 GM", value: "400", unit: "GM", factor: 0.4 },
  { label: "500 GM BOX", value: "500", unit: "GM", factor: 0.5 },
  { label: "800 GM", value: "800", unit: "GM", factor: 0.8 },
  { label: "1000 GM (1 KG)", value: "1000", unit: "GM", factor: 1.0 },
  { label: "1 PC", value: "1", unit: "PC", factor: 1.0 },
  { label: "1 BOX", value: "1", unit: "BOX", factor: 1.0 },
];

const PRESET_PRINT_QUANTITIES = [1, 5, 10, 25, 50, 100, 200, 400, 800, 1000];

export default function BarcodeGeneratorPage() {
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [batches, setBatches] = useState<ItemBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemProduct | null>(null);

  // Batch Selection State
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [customBatchNumber, setCustomBatchNumber] = useState<string>("1");

  // Sticker Configuration State
  const [businessName, setBusinessName] = useState("SRI BALAJI SWEETS");
  const [itemTitle, setItemTitle] = useState("250 GRAMS BOX");
  const [unitLabel, setUnitLabel] = useState("1 PC");
  const [barcodeId, setBarcodeId] = useState("7707");

  // Custom Weight / Pack Configuration
  const [weightAmount, setWeightAmount] = useState<string>("250");
  const [weightUnit, setWeightUnit] = useState<string>("GM");
  const [selectedPreset, setSelectedPreset] = useState<string>("250");

  const [mrp, setMrp] = useState<number | "">(6);
  const [printQuantity, setPrintQuantity] = useState<number>(50);

  // Multi-item batch queue
  const [batchQueue, setBatchQueue] = useState<StickerItem[]>([]);
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  // Preview SVG Ref
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Subscribe to items from Firestore
  useEffect(() => {
    const q = query(collection(db, "items"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const productList: ItemProduct[] = [];
        snapshot.forEach((docSnap) => {
          productList.push({ id: docSnap.id, ...docSnap.data() } as ItemProduct);
        });
        setItems(productList);
        setLoadingItems(false);

        // Pre-select first item if none selected
        if (productList.length > 0 && !selectedItem) {
          handleSelectProduct(productList[0]);
        }
      },
      (err) => {
        console.error("Error fetching items:", err);
        setLoadingItems(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to batches from Firestore
  useEffect(() => {
    const qBatches = query(collection(db, "batches"), orderBy("createdAt", "desc"));
    const unsubBatches = onSnapshot(
      qBatches,
      (snapshot) => {
        const bList: ItemBatch[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          bList.push({
            id: docSnap.id,
            ...d,
            batchCode: Number(d.batchCode) || 0,
            manufacturedQuantity: Number(d.manufacturedQuantity) || 0,
          } as ItemBatch);
        });
        setBatches(bList);
        setLoadingBatches(false);
      },
      (err) => {
        console.error("Error fetching batches:", err);
        setLoadingBatches(false);
      }
    );

    return () => unsubBatches();
  }, []);

  // Active batches for the currently selected item
  const activeBatchesForItem = selectedItem
    ? batches.filter(
        (b) =>
          b.itemId === selectedItem.id ||
          (selectedItem.barcodeId && b.itemBarcodeId === selectedItem.barcodeId)
      )
    : [];

  // Active batch object and number
  const currentBatch = activeBatchesForItem.find((b) => b.id === selectedBatchId);
  const activeBatchNumber = currentBatch
    ? String(currentBatch.batchCode)
    : customBatchNumber || "1";

  // ENCODED BARCODE STRING: itembarcodeid*weight*batchnumber
  const encodedBarcode = `${(barcodeId || selectedItem?.barcodeId || "7707")
    .toString()
    .trim()}*${(weightAmount || "250").toString().trim()}*${activeBatchNumber
    .toString()
    .trim()}`;

  // When product is selected
  const handleSelectProduct = (product: ItemProduct) => {
    setSelectedItem(product);
    setBarcodeId(product.barcodeId || "7707");

    // Automatically check for existing batches of this item
    const itemBatches = batches.filter(
      (b) => b.itemId === product.id || (product.barcodeId && b.itemBarcodeId === product.barcodeId)
    );
    if (itemBatches.length > 0) {
      setSelectedBatchId(itemBatches[0].id);
      setCustomBatchNumber(String(itemBatches[0].batchCode));
    } else {
      setSelectedBatchId("");
      setCustomBatchNumber("1");
    }

    const defaultPreset = PRESET_WEIGHTS[1]; // 250 GM
    setSelectedPreset(defaultPreset.value);
    setWeightAmount(defaultPreset.value);
    setWeightUnit(defaultPreset.unit);

    if (product.unit?.toLowerCase() === "piece") {
      setItemTitle(`${product.name.toUpperCase()} (1 PC)`);
      setUnitLabel("1 PC");
      setWeightAmount("1");
      setWeightUnit("PC");
      setSelectedPreset("1");
      setMrp(product.price);
    } else {
      setItemTitle(`${product.name.toUpperCase()} 250G BOX`);
      setUnitLabel("1 PC");
      setMrp(Math.round(product.price * defaultPreset.factor));
    }
  };

  // When a preset weight button is clicked
  const handlePresetWeightClick = (preset: typeof PRESET_WEIGHTS[0]) => {
    setSelectedPreset(preset.value);
    setWeightAmount(preset.value);
    setWeightUnit(preset.unit);

    const itemName = selectedItem ? selectedItem.name.toUpperCase() : "SWEET BOX";

    if (preset.unit === "PC" || preset.unit === "BOX") {
      setItemTitle(`${itemName} (${preset.label})`);
      setUnitLabel(preset.label);
      if (selectedItem) setMrp(selectedItem.price);
    } else {
      setItemTitle(`${itemName} ${preset.value}G BOX`);
      setUnitLabel("1 PC");
      if (selectedItem) {
        setMrp(Math.round(selectedItem.price * preset.factor));
      }
    }
  };

  // When custom weight input is changed
  const handleCustomWeightChange = (newVal: string, newUnit: string) => {
    setWeightAmount(newVal);
    setWeightUnit(newUnit);
    setSelectedPreset("custom");

    const numVal = parseFloat(newVal) || 0;
    const itemName = selectedItem ? selectedItem.name.toUpperCase() : "SWEET";

    if (newUnit === "GM") {
      setItemTitle(`${itemName} ${newVal ? `${newVal}G BOX` : ""}`);
      setUnitLabel("1 PC");
      if (selectedItem) {
        const factor = numVal / 1000;
        setMrp(Math.round(selectedItem.price * factor));
      }
    } else if (newUnit === "KG") {
      setItemTitle(`${itemName} ${newVal} KG`);
      setUnitLabel("1 PC");
      if (selectedItem) {
        setMrp(Math.round(selectedItem.price * numVal));
      }
    } else {
      setItemTitle(`${itemName} (${newVal} ${newUnit})`);
      setUnitLabel(`${newVal} ${newUnit}`);
      if (selectedItem) {
        setMrp(Math.round(selectedItem.price * (numVal || 1)));
      }
    }
  };

  // Generate barcode in preview SVG whenever encodedBarcode changes
  useEffect(() => {
    if (!previewSvgRef.current) return;
    const cleanPayload = (encodedBarcode || "7707*250*1").toString().trim();

    try {
      JsBarcode(previewSvgRef.current, cleanPayload, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 38,
        width: 1.4,
        lineColor: "#000000",
      });
    } catch (e) {
      console.warn("Barcode rendering fallback:", e);
    }
  }, [encodedBarcode]);

  // Filter items for searchable picker
  const filteredProducts = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcodeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Download sticker as high-res PNG (with Left Logo space)
  const handleDownloadPng = () => {
    const canvas = document.createElement("canvas");
    const width = 360;
    const height = 210;
    canvas.width = width * 2; // 2x for retina quality
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Left side: Empty Space for Logo (width: 75px)
    const logoColWidth = 75;

    // 1. Right Side: Business Name (Centered Bold)
    const contentX = logoColWidth + (width - logoColWidth) / 2;
    ctx.fillStyle = "#000000";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(businessName.toUpperCase(), contentX, 24);

    // 3. Right Side: Item Title (Left) & Unit (Right)
    ctx.font = "bold 10.5px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(itemTitle.toUpperCase(), logoColWidth + 10, 44);

    ctx.textAlign = "right";
    ctx.fillText(unitLabel.toUpperCase(), width - 12, 44);

    // 4. Draw Barcode SVG onto Right Side
    if (previewSvgRef.current) {
      const svgData = new XMLSerializer().serializeToString(previewSvgRef.current);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const barcodeWidth = width - logoColWidth - 20;
        const barcodeHeight = 75;
        ctx.drawImage(img, logoColWidth + 10, 54, barcodeWidth, barcodeHeight);
        URL.revokeObjectURL(url);

        // 5. Bottom Line: Barcode ID + Batch # (Left) & MRP (Right)
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`#${barcodeId} • B#${activeBatchNumber}`, logoColWidth + 10, 150);

        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`MRP: Rs.${mrp}/-`, width - 12, 150);

        // Save file
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `Barcode_${businessName.replace(/\s+/g, "_")}_${barcodeId}_${weightAmount}${weightUnit}_B${activeBatchNumber}.png`;
        a.click();

        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      };
      img.src = url;
    }
  };

  // Add current sticker to batch queue
  const handleAddToBatch = () => {
    const newItem: StickerItem = {
      id: `${barcodeId}_${weightAmount}_${activeBatchNumber}_${Date.now()}`,
      businessName,
      itemTitle,
      unitLabel,
      barcodeId,
      batchCode: activeBatchNumber,
      expiryDate: currentBatch?.expiryDate,
      encodedBarcode,
      mrp: Number(mrp) || 0,
      printQuantity: Number(printQuantity) || 1,
    };
    setBatchQueue((prev) => [...prev, newItem]);
  };

  // Total stickers in queue
  const totalBatchStickers = batchQueue.reduce((acc, curr) => acc + curr.printQuantity, 0);

  return (
    <AppLayout>
      {/* ============================================================== */}
      {/* SCREEN UI (Hidden during print via @media print styles below) */}
      {/* ============================================================== */}
      <div className="print:hidden space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Barcode Generator & Label Printer
              </h1>
              <p className="text-xs text-neutral-500">
                Item selection → Active batch → Weight → Print quantity with scanner payload:{" "}
                <strong className="font-mono text-neutral-900">itembarcodeid*weight*batchnumber</strong>
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-neutral-600" />
              )}
              <span>{downloadSuccess ? "Downloaded!" : "Download PNG"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>Print Stickers ({activeTab === "single" ? printQuantity : totalBatchStickers})</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation (Single Sticker vs Batch Queue) */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "single"
                ? "bg-neutral-900 text-white shadow-xs"
                : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
          >
            Single Item Generator
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "batch"
                ? "bg-neutral-900 text-white shadow-xs"
                : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Print Queue</span>
            {batchQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {batchQueue.length}
              </span>
            )}
          </button>
        </div>

        {/* Main Grid: LEFT SIDE STEP-BY-STEP FORM (7 cols) & RIGHT SIDE LIVE PREVIEW (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ==================== LEFT COLUMN: STEP-BY-STEP CONFIGURATION (7 Cols) ==================== */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Select Item */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-neutral-700" />
                  Step 1: Select Sweet Product
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {items.length} products available
                </span>
              </div>

              {/* Searchable Picker */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search sweet product name, category, or barcode number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-900 shadow-2xs"
                />
              </div>

              {/* Quick Select Product List */}
              <div className="max-h-40 overflow-y-auto divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-neutral-50/50">
                {loadingItems ? (
                  <div className="p-4 text-center text-xs text-neutral-400">Loading catalog items...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-400">No matching products found.</div>
                ) : (
                  filteredProducts.slice(0, 15).map((p) => {
                    const isSelected = selectedItem?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected ? "bg-neutral-900 text-white" : "hover:bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold truncate">{p.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              isSelected
                                ? "bg-neutral-800 text-neutral-200"
                                : "bg-neutral-200 text-neutral-700"
                            }`}
                          >
                            #{p.barcodeId}
                          </span>
                        </div>
                        <div className="font-mono font-bold shrink-0 ml-2">
                          ₹{p.price} / {p.unit || "KG"}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 2: Select Active Batch of That Item */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-neutral-700" />
                  Step 2: Active Batches of Selected Item
                </span>
                {selectedItem && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                    Batch #{activeBatchNumber}
                  </span>
                )}
              </div>

              {activeBatchesForItem.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-neutral-500">
                    Choose from active created batches for {selectedItem?.name}:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeBatchesForItem.slice(0, 6).map((b) => {
                      const isSelected = selectedBatchId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBatchId(b.id);
                            setCustomBatchNumber(String(b.batchCode));
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-purple-50/80 border-purple-400 shadow-xs ring-1 ring-purple-300"
                              : "bg-white hover:bg-neutral-50 border-neutral-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-xs text-neutral-900">
                              {b.batchCodeString || `Batch #${b.batchCode}`}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold font-mono">
                              Avail: {b.unallocatedQuantity ?? b.manufacturedQuantity} {selectedItem?.unit || "KG"}
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-500 flex items-center gap-2">
                            <span>Mfg: {b.manufacturingDate || "N/A"}</span>
                            <span>•</span>
                            <span>Exp: {b.expiryDate || "N/A"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold block">No batches created for this item yet.</span>
                    <span className="text-[11px] text-amber-700">
                      Using default batch #1 or enter a custom batch number below.
                    </span>
                  </div>
                  <Link
                    href="/batches"
                    target="_blank"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
                  >
                    <span>Create Batch</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Custom / Manual Batch Code Input Override */}
              <div className="pt-2 border-t border-neutral-100 flex items-center gap-3">
                <label className="text-[11px] font-bold text-neutral-700 shrink-0">
                  Batch Number:
                </label>
                <div className="relative flex-1 max-w-[160px]">
                  <input
                    type="text"
                    value={customBatchNumber}
                    onChange={(e) => {
                      setCustomBatchNumber(e.target.value);
                      setSelectedBatchId(""); // Deselect specific batch if manually customized
                    }}
                    placeholder="e.g. 1, 2, 3..."
                    className="w-full bg-white text-xs font-bold font-mono text-neutral-900 py-1.5 px-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <span className="text-[10px] text-neutral-400">
                  Encoded as 3rd part in barcode payload
                </span>
              </div>
            </div>

            {/* Step 3: Weight / Pack Size */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-700" />
                  Step 3: Weight & Pack Size
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                  Weight: {weightAmount} {weightUnit}
                </span>
              </div>

              {/* Weight Presets Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5">
                  Quick Weight Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_WEIGHTS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetWeightClick(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedPreset === preset.value && weightUnit === preset.unit
                          ? "bg-neutral-900 text-white shadow-xs"
                          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedPreset("custom")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedPreset === "custom"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                    }`}
                  >
                    Custom Weight
                  </button>
                </div>
              </div>

              {/* Custom Weight Amount & Unit Input Bar */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-amber-700" />
                    Enter Exact Weight:
                  </label>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Auto pro-rates price & encodes into barcode
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      placeholder="e.g. 250, 500, 1000..."
                      value={weightAmount}
                      onChange={(e) => handleCustomWeightChange(e.target.value, weightUnit)}
                      className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2 rounded-lg border border-amber-300 focus:outline-none focus:border-amber-600 shadow-2xs"
                    />
                  </div>

                  <div>
                    <select
                      value={weightUnit}
                      onChange={(e) => handleCustomWeightChange(weightAmount, e.target.value)}
                      className="w-full bg-white text-xs font-bold text-neutral-800 p-2 rounded-lg border border-amber-300 focus:outline-none cursor-pointer"
                    >
                      <option value="GM">Grams (GM)</option>
                      <option value="KG">Kilograms (KG)</option>
                      <option value="PC">Piece (PC)</option>
                      <option value="BOX">Box</option>
                      <option value="LTR">Litre (LTR)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Print Quantity */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-neutral-700" />
                  Step 4: Print Quantity
                </span>
                <span className="text-xs font-bold font-mono text-neutral-900">
                  {printQuantity} Stickers
                </span>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PRINT_QUANTITIES.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setPrintQuantity(qty)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      printQuantity === qty
                        ? "bg-neutral-900 text-white shadow-xs"
                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none"
                    placeholder="Custom Quantity (e.g. 50, 100, 400)"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddToBatch}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Batch Queue</span>
                </button>
              </div>
            </div>

            {/* Step 5: Fine-Tune Label Text & MRP (Optional Details) */}
            <details className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <summary className="text-xs font-bold text-neutral-700 uppercase tracking-wider cursor-pointer hover:text-neutral-900 select-none">
                + Optional Label Customization (Business Name, Text & MRP)
              </summary>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                {/* Business Name */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Business Name Header
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-white text-xs font-bold text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                {/* Item / Pack Title (Left Label) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Sticker Item Text
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full bg-white text-xs font-bold text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none uppercase"
                  />
                </div>

                {/* Unit / Pack (Right Label) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Pack Unit
                  </label>
                  <input
                    type="text"
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    className="w-full bg-white text-xs font-bold text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none uppercase"
                  />
                </div>

                {/* Selling Price / MRP */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* ==================== RIGHT COLUMN: LIVE STICKER PREVIEW & ACTIONS (5 Cols) ==================== */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-neutral-700" />
                  2-Column Printer Row Preview
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase font-bold">
                  2 Stickers / Row (50mm × 30mm each)
                </span>
              </div>

              {/* 2-Columns Dual Sticker Row Preview Container */}
              <div className="p-3 bg-neutral-100/80 rounded-xl border border-dashed border-neutral-300 space-y-2">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">
                  Thermal Roll Preview (Left & Right Column)
                </div>

                <div className="grid grid-cols-2 gap-2 justify-center">
                  {/* Column 1 Sticker */}
                  <div
                    className="bg-white text-black p-2 rounded-md border border-neutral-400 shadow-sm flex flex-row items-stretch select-none"
                    style={{
                      height: "125px",
                      fontFamily: "Arial, Helvetica, sans-serif",
                    }}
                  >
                    {/* Left Side: Empty Space for Pre-printed Logo */}
                    <div className="w-12 border-r border-dashed border-neutral-300 pr-1 flex flex-col items-center justify-center shrink-0 bg-neutral-50/50 rounded-l">
                      <span className="text-[7px] font-bold text-neutral-400 -rotate-90 uppercase tracking-wider">
                        Logo Space
                      </span>
                    </div>

                    {/* Right Side: Sticker Content */}
                    <div className="flex-1 pl-2 flex flex-col justify-between overflow-hidden min-w-0">
                      <div className="text-center font-black text-[10px] tracking-tight text-black uppercase truncate">
                        {businessName || "SRI BALAJI SWEETS"}
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-black tracking-tight text-black uppercase">
                        <span className="truncate pr-0.5">{itemTitle || "250 GRAMS BOX"}</span>
                        <span className="shrink-0">{unitLabel || "1 PC"}</span>
                      </div>
                      <div className="my-0.5 flex justify-center items-center overflow-hidden h-7">
                        <svg
                          ref={previewSvgRef}
                          className="w-full h-full"
                          style={{ shapeRendering: "crispEdges" }}
                        ></svg>
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-bold">
                        <div className="flex items-center gap-1 font-mono text-[7px]">
                          <span>#{barcodeId || "7707"}</span>
                          <span>•</span>
                          <span>B#{activeBatchNumber}</span>
                        </div>
                        <span className="font-black text-[9px]">
                          MRP: {mrp}/-
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2 Sticker (Adjacent Label) */}
                  <div
                    className="bg-white text-black p-2 rounded-md border border-neutral-400 shadow-sm flex flex-row items-stretch select-none"
                    style={{
                      height: "125px",
                      fontFamily: "Arial, Helvetica, sans-serif",
                    }}
                  >
                    {/* Left Side: Empty Space for Pre-printed Logo */}
                    <div className="w-12 border-r border-dashed border-neutral-300 pr-1 flex flex-col items-center justify-center shrink-0 bg-neutral-50/50 rounded-l">
                      <span className="text-[7px] font-bold text-neutral-400 -rotate-90 uppercase tracking-wider">
                        Logo Space
                      </span>
                    </div>

                    {/* Right Side: Sticker Content */}
                    <div className="flex-1 pl-2 flex flex-col justify-between overflow-hidden min-w-0">
                      <div className="text-center font-black text-[10px] tracking-tight text-black uppercase truncate">
                        {businessName || "SRI BALAJI SWEETS"}
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-black tracking-tight text-black uppercase">
                        <span className="truncate pr-0.5">{itemTitle || "250 GRAMS BOX"}</span>
                        <span className="shrink-0">{unitLabel || "1 PC"}</span>
                      </div>
                      <div className="my-0.5 flex justify-center items-center overflow-hidden h-7">
                        <div className="font-mono text-[8px] text-neutral-400 text-center tracking-widest">
                          ||||||||||||||||||||||||||
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-bold">
                        <div className="flex items-center gap-1 font-mono text-[7px]">
                          <span>#{barcodeId || "7707"}</span>
                          <span>•</span>
                          <span>B#{activeBatchNumber}</span>
                        </div>
                        <span className="font-black text-[9px]">
                          MRP: {mrp}/-
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scan Info Badge (Scanner Reads: itembarcodeid*weight*batchnumber) */}
              <div className="p-3 rounded-xl bg-neutral-900 text-white space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-neutral-300 text-[11px] font-medium">Hardware Scanner Reads:</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    barcode*weight*batch
                  </span>
                </div>
                <div className="font-mono font-bold text-amber-300 text-sm tracking-wider p-2 bg-neutral-800 rounded-lg border border-neutral-700 text-center truncate">
                  {encodedBarcode}
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                  <span>Item ID: <strong className="text-white font-mono">{barcodeId}</strong></span>
                  <span>Weight: <strong className="text-white font-mono">{weightAmount}{weightUnit}</strong></span>
                  <span>Batch: <strong className="text-white font-mono">#{activeBatchNumber}</strong></span>
                </div>
              </div>

              {/* Primary Action Button: Print Now */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print {activeTab === "single" ? printQuantity : totalBatchStickers} Stickers (2-Col Printer)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="flex items-center justify-center gap-1.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToBatch}
                    className="flex items-center justify-center gap-1.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Queue Batch</span>
                  </button>
                </div>
              </div>

              {/* Batch Queue Preview Box if items exist */}
              {batchQueue.length > 0 && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                    <span>Batch Queue ({batchQueue.length} items • {totalBatchStickers} labels)</span>
                    <button
                      type="button"
                      onClick={() => setBatchQueue([])}
                      className="text-red-600 hover:text-red-800 text-[11px] font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
                    {batchQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200 text-xs"
                      >
                        <div className="truncate text-[11px] min-w-0 pr-2">
                          <div className="font-bold truncate">{item.itemTitle}</div>
                          <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="text-purple-700 font-bold">{item.encodedBarcode}</span>
                            <span>•</span>
                            <span>MRP ₹{item.mrp}/-</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                            ×{item.printQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setBatchQueue((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-neutral-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* PRINT-ONLY CONTAINER (2-Columns Layout for Dual Sticker Rolls) */}
      {/* ============================================================== */}
      <div className="hidden print:block">
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              @page {
                margin: 0 !important;
                size: auto;
              }
              .barcode-print-sheet {
                display: grid !important;
                grid-template-columns: 50mm 50mm !important;
                column-gap: 3mm !important;
                row-gap: 2mm !important;
                justify-content: center !important;
                width: 100% !important;
                padding: 1mm !important;
              }
              .barcode-sticker-card {
                width: 50mm !important;
                height: 30mm !important;
                padding: 1.2mm 1.5mm !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                border: 0.5pt solid #000000 !important;
                display: flex !important;
                flex-direction: row !important;
                align-items: stretch !important;
                gap: 1.5mm !important;
                background: white !important;
                color: black !important;
                font-family: Arial, sans-serif !important;
                overflow: hidden !important;
              }
              .sticker-logo-column {
                width: 11mm !important;
                flex-shrink: 0 !important;
                background: transparent !important;
              }
              .sticker-content-column {
                flex: 1 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                min-width: 0 !important;
                overflow: hidden !important;
              }
              .sticker-business-title {
                text-align: center !important;
                font-weight: 900 !important;
                font-size: 7pt !important;
                line-height: 1 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.2px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              .sticker-item-row {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                font-weight: 900 !important;
                font-size: 6pt !important;
                line-height: 1 !important;
                text-transform: uppercase !important;
                margin-top: 0.5mm !important;
              }
              .sticker-item-title {
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                max-width: 72% !important;
              }
              .sticker-item-unit {
                white-space: nowrap !important;
                font-size: 5.5pt !important;
              }
              .sticker-barcode-wrap {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                margin: 0.5mm 0 !important;
                overflow: hidden !important;
                height: 8mm !important;
              }
              .sticker-barcode-svg {
                width: 100% !important;
                height: 100% !important;
                shape-rendering: crispEdges !important;
              }
              .sticker-bottom-row {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                font-size: 6pt !important;
                line-height: 1 !important;
                font-weight: 900 !important;
              }
              .sticker-batch-info {
                display: flex !important;
                align-items: center !important;
                gap: 1mm !important;
                font-family: monospace !important;
                font-size: 5.5pt !important;
              }
              .sticker-mrp-info {
                font-size: 6.5pt !important;
                font-weight: 900 !important;
              }
            }
          `,
          }}
        />

        <div className="barcode-print-sheet">
          {activeTab === "single"
            ? Array.from({ length: printQuantity }).map((_, i) => (
                <PrintableStickerCard
                  key={`single-${i}`}
                  businessName={businessName}
                  itemTitle={itemTitle}
                  unitLabel={unitLabel}
                  barcodeId={barcodeId}
                  batchCode={activeBatchNumber}
                  encodedBarcode={encodedBarcode}
                  mrp={Number(mrp) || 0}
                />
              ))
            : batchQueue.flatMap((batchItem) =>
                Array.from({ length: batchItem.printQuantity }).map((_, i) => (
                  <PrintableStickerCard
                    key={`${batchItem.id}-${i}`}
                    businessName={batchItem.businessName}
                    itemTitle={batchItem.itemTitle}
                    unitLabel={batchItem.unitLabel}
                    barcodeId={batchItem.barcodeId}
                    batchCode={batchItem.batchCode}
                    encodedBarcode={batchItem.encodedBarcode}
                    mrp={batchItem.mrp}
                  />
                ))
              )}
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * Printable Individual Barcode Sticker Card (With Left Side Logo Space)
 */
function PrintableStickerCard({
  businessName,
  itemTitle,
  unitLabel,
  barcodeId,
  batchCode,
  encodedBarcode,
  mrp,
}: {
  businessName: string;
  itemTitle: string;
  unitLabel: string;
  barcodeId: string;
  batchCode: number | string;
  encodedBarcode: string;
  mrp: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const payload = (encodedBarcode || `${barcodeId}*250*${batchCode}`).toString().trim();

    try {
      JsBarcode(svgRef.current, payload, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 24,
        width: 1.15,
        lineColor: "#000000",
      });
    } catch (e) {
      console.warn("Print barcode error:", e);
    }
  }, [encodedBarcode, barcodeId, batchCode]);

  return (
    <div className="barcode-sticker-card">
      {/* Left Column: Empty Space for Pre-printed Logo */}
      <div className="sticker-logo-column"></div>

      {/* Right Column: Main Sticker Content */}
      <div className="sticker-content-column">
        {/* Top: Business Name */}
        <div className="sticker-business-title">
          {businessName || "SRI BALAJI SWEETS"}
        </div>

        {/* Subheader: Item Name (Left) & Unit (Right) */}
        <div className="sticker-item-row">
          <span className="sticker-item-title">{itemTitle}</span>
          <span className="sticker-item-unit">{unitLabel}</span>
        </div>

        {/* Middle: Barcode Graphic */}
        <div className="sticker-barcode-wrap">
          <svg ref={svgRef} className="sticker-barcode-svg"></svg>
        </div>

        {/* Bottom: ID + Batch (Left) & MRP (Right) */}
        <div className="sticker-bottom-row">
          <div className="sticker-batch-info">
            <span>#{barcodeId}</span>
            <span>•</span>
            <span>B#{batchCode}</span>
          </div>
          <span className="sticker-mrp-info">
            MRP: ₹{mrp}/-
          </span>
        </div>
      </div>
    </div>
  );
}
