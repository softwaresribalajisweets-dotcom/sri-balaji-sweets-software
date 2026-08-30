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
} from "lucide-react";

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

interface StickerItem {
  id: string;
  businessName: string;
  itemTitle: string;
  unitLabel: string;
  barcodeId: string;
  encodedBarcode: string; // barcodeId*weight
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemProduct | null>(null);

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

  // Print format layout: "thermal" (continuous single column) or "sheet" (A4 grid)
  const [printLayout, setPrintLayout] = useState<"thermal" | "sheet">("thermal");

  // Multi-item batch queue
  const [batchQueue, setBatchQueue] = useState<StickerItem[]>([]);
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  // Preview SVG Ref
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Encoded Barcode String: barcodeid*weight
  const encodedBarcode = `${(barcodeId || "7707").toString().trim()}*${(weightAmount || "1").toString().trim()}`;

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

        // Pre-select first item if available and none selected
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

  // When product is selected from dropdown/search
  const handleSelectProduct = (product: ItemProduct) => {
    setSelectedItem(product);
    setBarcodeId(product.barcodeId || "7707");

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
    const cleanPayload = (encodedBarcode || "7707*250").toString().trim();

    try {
      JsBarcode(previewSvgRef.current, cleanPayload, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 38,
        width: 1.5,
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

  // Download sticker as high-res PNG
  const handleDownloadPng = () => {
    const canvas = document.createElement("canvas");
    const width = 360;
    const height = 220;
    canvas.width = width * 2; // 2x for retina quality
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 1. Business Name (Centered Bold)
    ctx.fillStyle = "#000000";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(businessName.toUpperCase(), width / 2, 24);

    // 2. Item Title (Left) & Unit (Right)
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(itemTitle.toUpperCase(), 16, 48);

    ctx.textAlign = "right";
    ctx.fillText(unitLabel.toUpperCase(), width - 16, 48);

    // 3. Draw Barcode SVG onto Canvas
    if (previewSvgRef.current) {
      const svgData = new XMLSerializer().serializeToString(previewSvgRef.current);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const barcodeWidth = width - 32;
        const barcodeHeight = 70;
        ctx.drawImage(img, 16, 60, barcodeWidth, barcodeHeight);
        URL.revokeObjectURL(url);

        // 4. Bottom Line: Barcode ID (Left) & MRP (Right)
        ctx.fillStyle = "#000000";
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "left";
        ctx.fillText(barcodeId, 16, 158);

        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`MRP: ${mrp}/-`, width - 16, 158);

        // Save file
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `Barcode_${businessName.replace(/\s+/g, "_")}_${barcodeId}_${weightAmount}${weightUnit}.png`;
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
      id: `${barcodeId}_${weightAmount}_${Date.now()}`,
      businessName,
      itemTitle,
      unitLabel,
      barcodeId,
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
                Generate <strong>barcodeid*weight</strong> thermal stickers for <strong>SRI BALAJI SWEETS</strong> with custom weights & quantities
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

        {/* Main Grid: Left Controls & Right Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ==================== LEFT COLUMN: CONFIGURATION CONTROLS (7 Cols) ==================== */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Select Item Card */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-neutral-700" />
                  Step 1: Select Product
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {items.length} items in catalog
                </span>
              </div>

              {/* Searchable Picker */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search item name or barcode number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
                />
              </div>

              {/* Quick Select Chips / Product List */}
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
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSelected ? "bg-neutral-800 text-neutral-200" : "bg-neutral-200 text-neutral-700"
                          }`}>
                            {p.barcodeId}
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

            {/* Step 2: Weight & Quantity Pack Size Presets + Custom Input */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-700" />
                  Step 2: Pack Size / Weight (Presets & Custom Input)
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Scans as: {encodedBarcode}
                </span>
              </div>

              {/* Weight Presets Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5">
                  Quick Presets:
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
                    Custom Input
                  </button>
                </div>
              </div>

              {/* Custom Weight Amount & Unit Input Bar */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-amber-700" />
                    Enter Custom Weight / Pack Amount:
                  </label>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Auto pro-rates price & encodes into barcode
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      step="any"
                      placeholder="e.g. 400, 800, 1000, 350, 750..."
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

              {/* Form Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                    Sticker Item Text (e.g. 250 GRAMS BOX)
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
                    Pack Unit (e.g. 1 PC, 1 BOX, 1 KG)
                  </label>
                  <input
                    type="text"
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    className="w-full bg-white text-xs font-bold text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none uppercase"
                  />
                </div>

                {/* Barcode Number */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Barcode ID / Item Number
                  </label>
                  <input
                    type="text"
                    value={barcodeId}
                    onChange={(e) => setBarcodeId(e.target.value)}
                    className="w-full bg-white text-xs font-bold font-mono text-neutral-900 p-2 rounded-lg border border-neutral-300 focus:outline-none"
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

                {/* Encoded Scanned Payload Display */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <ScanLine className="w-3 h-3 text-purple-700" />
                    Encoded Barcode Payload (barcodeid*weight)
                  </label>
                  <div className="w-full bg-purple-50 text-xs font-bold font-mono text-purple-900 p-2 rounded-lg border border-purple-200 truncate">
                    {encodedBarcode}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Print Quantity Config */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-neutral-700" />
                  Step 3: Print Quantity
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
                    placeholder="Custom Quantity (e.g. 400, 800, 1000)"
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
          </div>

          {/* ==================== RIGHT COLUMN: LIVE STICKER PREVIEW (5 Cols) ==================== */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-neutral-700" />
                  Live Sticker Preview
                </span>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  50mm × 30mm Label
                </span>
              </div>

              {/* Exact Barcode Sticker Container matching User's Image */}
              <div className="flex justify-center p-4 bg-neutral-100/70 rounded-xl border border-dashed border-neutral-300">
                <div
                  className="bg-white text-black p-3.5 rounded-lg border border-neutral-400 shadow-md flex flex-col justify-between select-none"
                  style={{
                    width: "280px",
                    minHeight: "150px",
                    fontFamily: "Arial, Helvetica, sans-serif",
                  }}
                >
                  {/* Top Business Name */}
                  <div className="text-center font-black text-sm tracking-wide text-black uppercase">
                    {businessName || "SRI BALAJI SWEETS"}
                  </div>

                  {/* Line 2: Item Name (Left) & Unit (Right) */}
                  <div className="flex items-center justify-between text-[11px] font-black tracking-tight text-black mt-1 uppercase">
                    <span className="truncate pr-1">{itemTitle || "250 GRAMS BOX"}</span>
                    <span className="shrink-0">{unitLabel || "1 PC"}</span>
                  </div>

                  {/* Middle Barcode Graphic (Encodes barcodeid*weight) */}
                  <div className="my-1 flex justify-center items-center overflow-hidden">
                    <svg
                      ref={previewSvgRef}
                      className="w-full max-h-12"
                      style={{ shapeRendering: "crispEdges" }}
                    ></svg>
                  </div>

                  {/* Bottom Line: Barcode ID (Left) & MRP (Right) */}
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="font-bold font-mono tracking-wider text-black">
                      {barcodeId || "7707"}
                    </span>
                    <span className="font-black text-sm text-black">
                      MRP: {mrp}/-
                    </span>
                  </div>
                </div>
              </div>

              {/* Scan Info Badge */}
              <div className="p-2.5 rounded-lg bg-neutral-900 text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-neutral-300 text-[11px]">Hardware Scanner Reads:</span>
                </div>
                <span className="font-mono font-bold text-amber-300 text-xs">
                  {encodedBarcode}
                </span>
              </div>

              {/* Quick Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print {printQuantity} Stickers Now</span>
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
                    <span>Batch Queue ({batchQueue.length} items)</span>
                    <button
                      type="button"
                      onClick={() => setBatchQueue([])}
                      className="text-red-600 hover:text-red-800 text-[11px] font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                    {batchQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-1.5 bg-white rounded border border-neutral-200"
                      >
                        <div className="truncate text-[11px]">
                          <span className="font-bold">{item.itemTitle}</span> - ₹{item.mrp}/-
                          <span className="text-[10px] text-purple-700 font-mono ml-1">
                            ({item.encodedBarcode})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-[10px] bg-neutral-100 px-1 rounded">
                            ×{item.printQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setBatchQueue((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-neutral-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
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
      {/* PRINT-ONLY CONTAINER (Displayed strictly during window.print)  */}
      {/* ============================================================== */}
      <div className="hidden print:block">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              @page {
                margin: 2mm;
                size: auto;
              }
              .barcode-print-sheet {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 4mm !important;
                justify-content: flex-start !important;
              }
              .barcode-sticker-card {
                width: 50mm !important;
                height: 30mm !important;
                padding: 2mm !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                border: 0.5pt solid #000000 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                background: white !important;
                color: black !important;
                font-family: Arial, sans-serif !important;
              }
            }
          `
        }} />

        <div className="barcode-print-sheet">
          {activeTab === "single" ? (
            Array.from({ length: printQuantity }).map((_, i) => (
              <PrintableStickerCard
                key={`single-${i}`}
                businessName={businessName}
                itemTitle={itemTitle}
                unitLabel={unitLabel}
                barcodeId={barcodeId}
                encodedBarcode={encodedBarcode}
                mrp={Number(mrp) || 0}
              />
            ))
          ) : (
            batchQueue.flatMap((batchItem) =>
              Array.from({ length: batchItem.printQuantity }).map((_, i) => (
                <PrintableStickerCard
                  key={`${batchItem.id}-${i}`}
                  businessName={batchItem.businessName}
                  itemTitle={batchItem.itemTitle}
                  unitLabel={batchItem.unitLabel}
                  barcodeId={batchItem.barcodeId}
                  encodedBarcode={batchItem.encodedBarcode}
                  mrp={batchItem.mrp}
                />
              ))
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * Printable Individual Barcode Sticker Card
 */
function PrintableStickerCard({
  businessName,
  itemTitle,
  unitLabel,
  barcodeId,
  encodedBarcode,
  mrp,
}: {
  businessName: string;
  itemTitle: string;
  unitLabel: string;
  barcodeId: string;
  encodedBarcode: string;
  mrp: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const payload = (encodedBarcode || `${barcodeId}*250`).toString().trim();

    try {
      JsBarcode(svgRef.current, payload, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 30,
        width: 1.3,
        lineColor: "#000000",
      });
    } catch (e) {
      console.warn("Print barcode error:", e);
    }
  }, [encodedBarcode, barcodeId]);

  return (
    <div className="barcode-sticker-card">
      {/* Top Business Name */}
      <div
        style={{
          textAlign: "center",
          fontWeight: 900,
          fontSize: "10pt",
          lineHeight: "1.1",
          textTransform: "uppercase",
          letterSpacing: "0.2px",
        }}
      >
        {businessName || "SRI BALAJI SWEETS"}
      </div>

      {/* Line 2: Item Name (Left) & Unit (Right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 900,
          fontSize: "7.5pt",
          lineHeight: "1.1",
          textTransform: "uppercase",
          marginTop: "1mm",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>
          {itemTitle}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{unitLabel}</span>
      </div>

      {/* Middle Barcode (Encodes barcodeid*weight) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: "1mm 0",
          overflow: "hidden",
        }}
      >
        <svg ref={svgRef} style={{ width: "100%", maxHeight: "12mm", shapeRendering: "crispEdges" }}></svg>
      </div>

      {/* Bottom Line: Barcode ID (Left) & MRP (Right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "8.5pt",
          lineHeight: "1.1",
          fontWeight: 900,
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: "8pt" }}>
          {barcodeId}
        </span>
        <span style={{ fontSize: "9pt", fontWeight: 900 }}>
          MRP: {mrp}/-
        </span>
      </div>
    </div>
  );
}
