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
  Usb,
  Bluetooth,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Zap,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePrinter, PrintableBarcodeSticker } from "../../lib/printer";

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
  { label: "1 BOX", value: "box", unit: "BOX", factor: 1.0 },
];

const PRESET_PRINT_QUANTITIES = [1, 5, 10, 25, 50, 100, 200, 400, 800, 1000];

export default function BarcodeGeneratorPage() {
  const {
    connectedPrinter,
    isConnecting: isConnectingPrinter,
    error: printerError,
    printerMode,
    setPrinterMode,
    connectUSB,
    connectBluetooth,
    printBarcodeStickers,
    printTestSticker,
  } = usePrinter();

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

  // Direct Printer UI state
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

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

    // Auto-select latest active batch for this product
    const prodBatches = batches.filter(
      (b) =>
        b.itemId === product.id ||
        (product.barcodeId && b.itemBarcodeId === product.barcodeId)
    );
    if (prodBatches.length > 0) {
      setSelectedBatchId(prodBatches[0].id);
    } else {
      setSelectedBatchId("");
      setCustomBatchNumber("1");
    }

    // Default weight preset 250g
    applyPreset("250", product);
  };

  // Preset Selection Helper
  const applyPreset = (presetVal: string, prod = selectedItem) => {
    setSelectedPreset(presetVal);

    if (presetVal === "100") {
      setWeightAmount("100");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 100G BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 0.1));
      }
    } else if (presetVal === "250") {
      setWeightAmount("250");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 250G BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 0.25));
      }
    } else if (presetVal === "400") {
      setWeightAmount("400");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 400G BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 0.4));
      }
    } else if (presetVal === "500") {
      setWeightAmount("500");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 500G BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 0.5));
      }
    } else if (presetVal === "800") {
      setWeightAmount("800");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 800G BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 0.8));
      }
    } else if (presetVal === "1000") {
      setWeightAmount("1000");
      setWeightUnit("GM");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 1 KG BOX`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price * 1.0));
      }
    } else if (presetVal === "1") {
      setWeightAmount("1");
      setWeightUnit("PC");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 1 PC`);
      setUnitLabel("1 PC");
      if (prod) {
        setMrp(Math.round(prod.price));
      }
    } else if (presetVal === "box") {
      setWeightAmount("1");
      setWeightUnit("BOX");
      const name = prod ? prod.name.toUpperCase() : "SWEET";
      setItemTitle(`${name} 1 BOX`);
      setUnitLabel("1 BOX");
      if (prod) {
        setMrp(Math.round(prod.price));
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

  // Direct 1-Click Print to Connected USB or Bluetooth Thermal / Barcode Printer
  const handlePrintDirect = async () => {
    if (!connectedPrinter?.isConnected) {
      setShowConnectModal(true);
      return;
    }

    setIsPrintingDirect(true);
    setPrintFeedback({
      type: "info",
      message: `Sending print commands directly to ${connectedPrinter.name}...`,
    });

    try {
      const stickersToPrint: PrintableBarcodeSticker[] =
        activeTab === "single"
          ? [
              {
                businessName,
                itemTitle,
                unitLabel,
                barcodeId,
                batchCode: activeBatchNumber,
                encodedBarcode,
                mrp: Number(mrp) || 0,
                quantity: Number(printQuantity) || 1,
              },
            ]
          : batchQueue.map((item) => ({
              businessName: item.businessName,
              itemTitle: item.itemTitle,
              unitLabel: item.unitLabel,
              barcodeId: item.barcodeId,
              batchCode: item.batchCode,
              encodedBarcode: item.encodedBarcode,
              mrp: item.mrp,
              quantity: item.printQuantity,
            }));

      const totalCount = stickersToPrint.reduce((acc, s) => acc + (s.quantity || 1), 0);
      const ok = await printBarcodeStickers(stickersToPrint);

      if (ok) {
        setPrintFeedback({
          type: "success",
          message: `Successfully printed ${totalCount} stickers directly to ${connectedPrinter.name}!`,
        });
        setTimeout(() => setPrintFeedback(null), 4500);
      } else {
        setPrintFeedback({
          type: "error",
          message: printerError || "Printing failed. Please check printer connection & label feed.",
        });
      }
    } catch (e: any) {
      setPrintFeedback({
        type: "error",
        message: e.message || "Failed to transmit print data.",
      });
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // Fallback to System Browser Print Dialog (if user specifically wants A4 / PDF modal)
  const handleSystemPrint = () => {
    window.print();
  };

  // Test Sticker Print
  const handleTestSticker = async () => {
    if (!connectedPrinter?.isConnected) {
      setShowConnectModal(true);
      return;
    }
    setIsPrintingDirect(true);
    setPrintFeedback({
      type: "info",
      message: "Transmitting test sticker to printer...",
    });
    const ok = await printTestSticker();
    setIsPrintingDirect(false);
    if (ok) {
      setPrintFeedback({
        type: "success",
        message: `Test sticker printed successfully on ${connectedPrinter.name}!`,
      });
      setTimeout(() => setPrintFeedback(null), 4000);
    } else {
      setPrintFeedback({
        type: "error",
        message: printerError || "Test sticker print failed.",
      });
    }
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

            {/* Fallback Browser Print Dialog Button */}
            <button
              type="button"
              onClick={handleSystemPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Open standard browser print preview modal"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-500" />
              <span>System Print (Modal)</span>
            </button>

            {/* Primary Direct Print Button */}
            <button
              type="button"
              onClick={handlePrintDirect}
              disabled={isPrintingDirect}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer ${
                connectedPrinter?.isConnected
                  ? "bg-emerald-600 hover:bg-emerald-700 active:scale-98"
                  : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              {isPrintingDirect ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : connectedPrinter?.isConnected ? (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              ) : (
                <Printer className="w-3.5 h-3.5 text-white" />
              )}
              <span>
                {isPrintingDirect
                  ? "Printing..."
                  : connectedPrinter?.isConnected
                  ? `Print Direct (${activeTab === "single" ? printQuantity : totalBatchStickers} Stickers)`
                  : `Connect & Print Direct (${activeTab === "single" ? printQuantity : totalBatchStickers})`}
              </span>
            </button>
          </div>
        </div>

        {/* Printer Status Banner */}
        <div
          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            connectedPrinter?.isConnected
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs"
              : "bg-amber-50/80 border-amber-200 text-amber-950 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                connectedPrinter?.isConnected
                  ? "bg-emerald-500 ring-4 ring-emerald-100 animate-pulse"
                  : "bg-amber-500 ring-4 ring-amber-100"
              }`}
            ></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">
                  {connectedPrinter?.isConnected
                    ? `Connected Printer: ${connectedPrinter.name} (${connectedPrinter.type.toUpperCase()})`
                    : "No Thermal / Barcode Printer Connected (Direct 1-Click Print Disabled)"}
                </span>
                {connectedPrinter?.isConnected && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-200/60 text-emerald-800 text-[10px] font-mono font-bold">
                    Mode: {printerMode.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {connectedPrinter?.isConnected
                  ? "Clicking 'Print Direct' sends sticker labels instantly to your printer without any browser print popup dialogs."
                  : "Connect via USB cable or Bluetooth to print stickers instantly with 1-click silent printing."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {connectedPrinter?.isConnected ? (
              <>
                <button
                  type="button"
                  onClick={handleTestSticker}
                  disabled={isPrintingDirect}
                  className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-lg font-bold text-[11px] cursor-pointer shadow-2xs"
                >
                  Test 1 Sticker
                </button>
                <div className="flex items-center bg-white border border-emerald-300 rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPrinterMode("auto")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      printerMode === "auto" ? "bg-emerald-600 text-white" : "text-neutral-700"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinterMode("escpos")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      printerMode === "escpos" ? "bg-emerald-600 text-white" : "text-neutral-700"
                    }`}
                  >
                    ESC/POS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinterMode("tspl")}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      printerMode === "tspl" ? "bg-emerald-600 text-white" : "text-neutral-700"
                    }`}
                  >
                    TSPL
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Connect Printer Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {printFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 font-semibold ${
              printFeedback.type === "success"
                ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                : printFeedback.type === "error"
                ? "bg-red-100 border-red-300 text-red-900"
                : "bg-blue-100 border-blue-300 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {printFeedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
              {printFeedback.type === "error" && <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />}
              {printFeedback.type === "info" && <RefreshCw className="w-4 h-4 text-blue-700 shrink-0 animate-spin" />}
              <span>{printFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintFeedback(null)}
              className="p-1 text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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

              {/* Products List Carousel / Grid */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {loadingItems ? (
                  <div className="p-4 text-center text-xs text-neutral-400">
                    Loading products...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-500">
                    No products matching &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const isSelected = selectedItem?.id === prod.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectProduct(prod)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                            : "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected
                                ? "bg-amber-500 text-neutral-900"
                                : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {prod.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs truncate">
                              {prod.name}
                            </div>
                            <div
                              className={`text-[10px] ${
                                isSelected ? "text-neutral-300" : "text-neutral-500"
                              }`}
                            >
                              Barcode ID: <strong className="font-mono">{prod.barcodeId || "N/A"}</strong> • Cat: {prod.category || "General"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <div className="font-bold text-xs">
                            ₹{prod.price}
                            <span className="text-[10px] font-normal opacity-80">
                              /{prod.unit || "kg"}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-amber-400 flex items-center justify-end gap-0.5">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 2: Select Manufacturing Batch */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-neutral-700" />
                  Step 2: Select Production Batch
                </span>
                <span className="text-[11px] text-neutral-500">
                  {activeBatchesForItem.length} active batches for {selectedItem?.name || "item"}
                </span>
              </div>

              {activeBatchesForItem.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeBatchesForItem.map((b) => {
                    const isSelected = selectedBatchId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBatchId(b.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                            : "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-mono text-xs text-amber-400">
                            Batch #{b.batchCode}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              isSelected
                                ? "bg-neutral-800 text-neutral-200"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            Qty: {b.manufacturedQuantity}
                          </span>
                        </div>

                        <div className="text-[10px] mt-1.5 opacity-80 flex items-center justify-between">
                          <span>Mfg: {b.manufacturingDate || "Today"}</span>
                          {b.expiryDate && <span>Exp: {b.expiryDate}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-amber-900 text-xs flex items-center justify-between">
                  <span>No active manufacturing batch found in inventory.</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold">Custom Batch #:</span>
                    <input
                      type="number"
                      min="1"
                      value={customBatchNumber}
                      onChange={(e) => {
                        setCustomBatchNumber(e.target.value);
                        setSelectedBatchId("");
                      }}
                      className="w-14 bg-white border border-amber-300 rounded px-1.5 py-0.5 text-center font-bold text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Weight & Packaging Configuration */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-neutral-700" />
                  Step 3: Weight / Package Preset
                </span>
                <span className="text-[11px] text-neutral-500">
                  Calculates MRP & sets encoded weight
                </span>
              </div>

              {/* Weight Presets Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_WEIGHTS.map((pw) => {
                  const isSelected = selectedPreset === pw.value;
                  return (
                    <button
                      key={pw.value}
                      type="button"
                      onClick={() => applyPreset(pw.value)}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-xs ${
                        isSelected
                          ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                          : "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200"
                      }`}
                    >
                      {pw.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Weight / Piece Input */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Custom Weight / Value
                  </label>
                  <div className="flex rounded-lg shadow-2xs">
                    <input
                      type="number"
                      value={weightAmount}
                      onChange={(e) => handleCustomWeightChange(e.target.value, weightUnit)}
                      className="w-full bg-neutral-50 text-xs pl-2.5 pr-1 py-1.5 rounded-l-lg border border-neutral-300 focus:outline-none focus:bg-white"
                      placeholder="e.g. 350"
                    />
                    <select
                      value={weightUnit}
                      onChange={(e) => handleCustomWeightChange(weightAmount, e.target.value)}
                      className="bg-neutral-100 text-xs px-2 py-1.5 rounded-r-lg border border-l-0 border-neutral-300 font-bold text-neutral-700"
                    >
                      <option value="GM">GM</option>
                      <option value="KG">KG</option>
                      <option value="PC">PC</option>
                      <option value="BOX">BOX</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    MRP / Sticker Price (₹)
                  </label>
                  <input
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-neutral-50 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white font-bold text-neutral-900 shadow-2xs"
                    placeholder="MRP ₹"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Print Quantity Configuration */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-neutral-700" />
                  Step 4: Print Quantity (Copies)
                </span>
                <span className="text-[11px] font-mono font-bold text-neutral-900">
                  {printQuantity} Stickers
                </span>
              </div>

              {/* Quantity Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_PRINT_QUANTITIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPrintQuantity(q)}
                    className={`py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      printQuantity === q
                        ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                        : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-neutral-500 font-medium">Custom Quantity:</span>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-900 focus:outline-none focus:bg-white"
                />
                <span className="text-[11px] text-neutral-400">stickers (will print dual columns)</span>
              </div>
            </div>
          </div>

          {/* ==================== RIGHT COLUMN: LIVE STICKER PREVIEW & ACTIONS (5 Cols) ==================== */}
          <div className="lg:col-span-5 space-y-4 sticky top-20">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-neutral-700" />
                  <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Actual Sticker Label Preview
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-bold">
                  50mm × 30mm
                </span>
              </div>

              {/* Exact Physical Sticker Rendering Preview (50mm x 30mm Proportions) */}
              <div className="flex justify-center p-3 bg-neutral-100/70 rounded-xl border border-dashed border-neutral-300">
                <div className="w-[330px] h-[198px] bg-white border border-neutral-900 rounded shadow-md p-2 flex flex-row gap-2 relative overflow-hidden text-neutral-900">
                  {/* Left Column: Reserved Space for Pre-printed Store Logo */}
                  <div className="w-14 shrink-0 border-r border-dashed border-neutral-300 flex flex-col items-center justify-center p-1 text-center bg-neutral-50/50 rounded">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center mb-1">
                      <Store className="w-4 h-4 text-neutral-500" />
                    </div>
                    <span className="text-[7.5px] font-bold text-neutral-400 leading-tight">
                      PRE-PRINTED LOGO
                    </span>
                  </div>

                  {/* Right Column: Dynamic Data (Header, Item, Barcode, Batch, MRP) */}
                  <div className="flex-1 flex flex-col justify-between overflow-hidden min-w-0">
                    {/* Top: Business Name */}
                    <div className="text-center font-black text-[12px] tracking-tight truncate border-b border-neutral-100 pb-0.5">
                      {businessName}
                    </div>

                    {/* Subtitle: Product Name & Unit */}
                    <div className="flex items-center justify-between text-[9px] font-black uppercase pt-0.5">
                      <span className="truncate max-w-[70%]">{itemTitle}</span>
                      <span className="shrink-0">{unitLabel}</span>
                    </div>

                    {/* Barcode Graphic */}
                    <div className="my-0.5 flex justify-center items-center overflow-hidden h-10">
                      <svg ref={previewSvgRef} className="w-full h-full max-h-10"></svg>
                    </div>

                    {/* Bottom Line: ID • Batch# and MRP */}
                    <div className="flex items-center justify-between text-[9px] font-black pt-0.5 border-t border-neutral-100">
                      <div className="flex items-center gap-1 font-mono text-[8.5px]">
                        <span>#{barcodeId || "7707"}</span>
                        <span>•</span>
                        <span>B#{activeBatchNumber}</span>
                      </div>
                      <span className="font-black text-[10px]">
                        MRP: ₹{mrp}/-
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware Scanner Payload Info Box */}
              <div className="p-3 rounded-xl bg-neutral-900 text-white space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-neutral-300 text-[11px] font-medium">POS Scanner Protocol:</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                    item*weight*batch
                  </span>
                </div>
                <div className="font-mono font-bold text-amber-300 text-sm tracking-wider p-2 bg-neutral-800 rounded-lg border border-neutral-700 text-center truncate select-all">
                  {encodedBarcode}
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                  <span>ID: <strong className="text-white font-mono">{barcodeId}</strong></span>
                  <span>Weight: <strong className="text-white font-mono">{weightAmount}{weightUnit}</strong></span>
                  <span>Batch: <strong className="text-white font-mono">#{activeBatchNumber}</strong></span>
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* 1-Click Direct Print Button */}
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  disabled={isPrintingDirect}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
                    connectedPrinter?.isConnected
                      ? "bg-emerald-600 hover:bg-emerald-700 active:scale-98"
                      : "bg-neutral-900 hover:bg-neutral-800"
                  }`}
                >
                  {isPrintingDirect ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : connectedPrinter?.isConnected ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                  ) : (
                    <Printer className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {isPrintingDirect
                      ? "Transmitting Print Data..."
                      : connectedPrinter?.isConnected
                      ? `Print ${activeTab === "single" ? printQuantity : totalBatchStickers} Stickers to ${connectedPrinter.name}`
                      : `Connect & Print Direct (${activeTab === "single" ? printQuantity : totalBatchStickers} Stickers)`}
                  </span>
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
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 mt-2">
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
      {/* QUICK PRINTER CONNECT POPUP MODAL                             */}
      {/* ============================================================== */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden text-neutral-900">
            <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Connect Label / Barcode Printer
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Select connection for 1-click silent direct printing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await connectUSB();
                    if (ok) setShowConnectModal(false);
                  }}
                  disabled={isConnectingPrinter}
                  className="p-3.5 bg-white border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Usb className="w-5 h-5 text-neutral-700" />
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      USB Cable
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900 text-xs block">
                    Connect WebUSB
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    TVS, TSC, Xprinter, Thermal POS
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const ok = await connectBluetooth();
                    if (ok) setShowConnectModal(false);
                  }}
                  disabled={isConnectingPrinter}
                  className="p-3.5 bg-white border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Bluetooth className="w-5 h-5 text-neutral-700" />
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                      Wireless
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900 text-xs block">
                    Connect Bluetooth
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Wireless Thermal Label Machine
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConnectModal(false);
                    handleSystemPrint();
                  }}
                  className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Use Browser Print Dialog (Normal Modal) Instead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
