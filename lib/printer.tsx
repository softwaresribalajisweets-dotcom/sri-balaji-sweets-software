"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import JsBarcode from "jsbarcode";

export interface ConnectedPrinterInfo {
  type: "usb" | "bluetooth";
  name: string;
  device: any;
  isConnected: boolean;
}

export interface PrintableSaleItem {
  itemName: string;
  totalQuantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  batchAllocations?: Array<{
    batchCodeString?: string;
    allocatedQty?: number;
  }>;
}

export interface PrintableSaleDoc {
  billNumber: string;
  storeName: string;
  customerName?: string;
  customerMobile?: string;
  items: PrintableSaleItem[];
  subtotal: number;
  discountAmount?: number;
  discountPercent?: number;
  grandTotal: number;
  paymentMode: string;
  createdAt?: any;
}

export interface PrintableBarcodeSticker {
  businessName: string;
  itemTitle: string;
  unitLabel: string;
  barcodeId: string;
  batchCode: string | number;
  encodedBarcode: string; // itembarcodeid*weight*batchnumber
  mrp: number;
  quantity: number;
}

export type PrinterProtocolMode = "escpos" | "tspl" | "auto";

interface PrinterContextType {
  connectedPrinter: ConnectedPrinterInfo | null;
  isConnecting: boolean;
  error: string | null;
  printerMode: PrinterProtocolMode;
  setPrinterMode: (mode: PrinterProtocolMode) => void;
  connectUSB: () => Promise<boolean>;
  connectBluetooth: () => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  printReceipt: (sale: PrintableSaleDoc) => Promise<boolean>;
  printBarcodeStickers: (stickers: PrintableBarcodeSticker[], mode?: PrinterProtocolMode) => Promise<boolean>;
  printTestPage: () => Promise<boolean>;
  printTestSticker: () => Promise<boolean>;
  printRawText: (text: string) => Promise<boolean>;
  sendBytes: (data: Uint8Array) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

// Helper: Convert Canvas to ESC/POS Monochrome Raster Bit Image (GS v 0)
export function canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array();

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Width in bytes (must be multiple of 8)
  const widthBytes = Math.ceil(width / 8);
  const totalImageBytes = widthBytes * height;

  const header = [
    0x1b, 0x40,             // ESC @: Init printer
    0x1b, 0x61, 0x01,       // ESC a 1: Center
    0x1d, 0x76, 0x30, 0x00, // GS v 0 0: Raster bit image (normal mode)
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ];

  const rasterData = new Uint8Array(header.length + totalImageBytes + 6);
  rasterData.set(header, 0);

  let offset = header.length;

  for (let y = 0; y < height; y++) {
    for (let bx = 0; bx < widthBytes; bx++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit;
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          // If pixel is dark and opaque -> black dot (1)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (a > 128 && brightness < 180) {
            byteVal |= (1 << (7 - bit));
          }
        }
      }
      rasterData[offset++] = byteVal;
    }
  }

  // Feed 2 lines and clear
  rasterData[offset++] = 0x1b;
  rasterData[offset++] = 0x64;
  rasterData[offset++] = 0x02; // ESC d 2: Feed 2 lines
  rasterData[offset++] = 0x0a; // LF

  return rasterData;
}

// Helper: Build ESC/POS raster bitmap for Barcode Sticker
export function buildEscPosBarcodeSticker(sticker: PrintableBarcodeSticker): Uint8Array {
  if (typeof document === "undefined") return new Uint8Array();

  const canvas = document.createElement("canvas");
  const width = 384; // Standard 203 DPI 2-inch width (48 bytes wide)
  const height = 180;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array();

  // White Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Outer Border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  // Left space for pre-printed logo (width 70px)
  const logoColWidth = 70;
  const contentX = logoColWidth + (width - logoColWidth) / 2;

  // 1. Business Name (Header)
  ctx.fillStyle = "#000000";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText((sticker.businessName || "SRI BALAJI SWEETS").toUpperCase(), contentX, 22);

  // 2. Item Title (Left) & Unit (Right)
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  const title = (sticker.itemTitle || "SWEET").toUpperCase();
  const truncatedTitle = title.length > 20 ? title.substring(0, 18) + ".." : title;
  ctx.fillText(truncatedTitle, logoColWidth + 8, 42);

  ctx.textAlign = "right";
  ctx.fillText((sticker.unitLabel || "1 PC").toUpperCase(), width - 10, 42);

  // 3. Render Barcode directly to temporary offscreen canvas
  try {
    const bcCanvas = document.createElement("canvas");
    const payload = (sticker.encodedBarcode || `${sticker.barcodeId}*250*${sticker.batchCode}`).toString().trim();
    JsBarcode(bcCanvas, payload, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 34,
      width: 1.3,
      lineColor: "#000000",
    });
    const barcodeWidth = width - logoColWidth - 18;
    ctx.drawImage(bcCanvas, logoColWidth + 8, 48, barcodeWidth, 38);
  } catch (e) {
    console.warn("JsBarcode raster generation error:", e);
  }

  // 4. Bottom Row: #BarcodeId • B#BatchCode & MRP
  ctx.fillStyle = "#000000";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`#${sticker.barcodeId} • B#${sticker.batchCode}`, logoColWidth + 8, 114);

  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`MRP: Rs.${sticker.mrp}/-`, width - 10, 114);

  return canvasToEscPosRaster(canvas);
}

// Helper: Build Native TSPL-2 commands for dedicated Barcode Label Printers (TSC, Xprinter, TVS, Rongta)
export function buildTsplBarcodeSticker(sticker: PrintableBarcodeSticker): Uint8Array {
  const encoder = new TextEncoder();
  const copies = Math.max(1, sticker.quantity || 1);
  const cleanTitle = (sticker.itemTitle || "SWEET").replace(/["\r\n]/g, "").toUpperCase();
  const cleanUnit = (sticker.unitLabel || "1 PC").replace(/["\r\n]/g, "").toUpperCase();
  const cleanBiz = (sticker.businessName || "SRI BALAJI SWEETS").replace(/["\r\n]/g, "").toUpperCase();
  const cleanPayload = (sticker.encodedBarcode || `${sticker.barcodeId}*250*${sticker.batchCode}`)
    .replace(/["\r\n]/g, "")
    .trim();

  // 50mm x 25mm Label Size, 2mm gap
  const commands = [
    "SIZE 50 mm, 25 mm",
    "GAP 2 mm, 0 mm",
    "DIRECTION 1",
    "CLS",
    `TEXT 380,10,"3",0,1,1,"${cleanBiz}"`,
    `TEXT 80,36,"2",0,1,1,"${cleanTitle.substring(0, 18)} ${cleanUnit}"`,
    `BARCODE 80,62,"128",45,1,0,2,2,"${cleanPayload}"`,
    `TEXT 80,126,"2",0,1,1,"#${sticker.barcodeId} • B#${sticker.batchCode}"`,
    `TEXT 270,126,"3",0,1,1,"MRP: Rs.${sticker.mrp}/-"`,
    `PRINT ${copies},1`,
    "",
  ].join("\r\n");

  return encoder.encode(commands);
}

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinterInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printerMode, setPrinterModeState] = useState<PrinterProtocolMode>("auto");

  // Reference to active Bluetooth characteristic or USB endpoint
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [usbEndpoint, setUsbEndpoint] = useState<{ device: any; endpointNumber: number } | null>(null);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("sri_balaji_printer_mode") as PrinterProtocolMode;
      if (savedMode && ["escpos", "tspl", "auto"].includes(savedMode)) {
        setPrinterModeState(savedMode);
      }
    } catch (e) {}
  }, []);

  const setPrinterMode = (mode: PrinterProtocolMode) => {
    setPrinterModeState(mode);
    try {
      localStorage.setItem("sri_balaji_printer_mode", mode);
    } catch (e) {}
  };

  // Helper to build ESC/POS commands for Sales Receipt
  const buildEscPosReceipt = (sale: PrintableSaleDoc): Uint8Array => {
    const encoder = new TextEncoder();
    const commands: number[] = [];

    // ESC @: Initialize printer
    commands.push(0x1b, 0x40);

    // ESC a 1: Center align
    commands.push(0x1b, 0x61, 0x01);

    // GS ! 0x11: Double width & height
    commands.push(0x1d, 0x21, 0x11);
    // ESC E 1: Bold on
    commands.push(0x1b, 0x45, 0x01);
    const storeTitle = "SRI BALAJI SWEETS\n";
    commands.push(...Array.from(encoder.encode(storeTitle)));

    // Reset size & bold
    commands.push(0x1d, 0x21, 0x00);
    commands.push(0x1b, 0x45, 0x00);

    if (sale.storeName) {
      commands.push(...Array.from(encoder.encode(`${sale.storeName}\n`)));
    }
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));

    // ESC a 0: Left align
    commands.push(0x1b, 0x61, 0x00);
    const dateStr = new Date().toLocaleString();
    commands.push(...Array.from(encoder.encode(`Bill #: ${sale.billNumber}\n`)));
    commands.push(...Array.from(encoder.encode(`Date  : ${dateStr}\n`)));
    if (sale.customerName) {
      commands.push(...Array.from(encoder.encode(`Cust  : ${sale.customerName} ${sale.customerMobile ? `(${sale.customerMobile})` : ""}\n`)));
    }
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));
    commands.push(...Array.from(encoder.encode("ITEM            QTY     PRICE   TOTAL\n")));
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));

    // Items
    for (const it of sale.items) {
      const itemTitle = it.itemName.length > 30 ? it.itemName.substring(0, 30) : it.itemName;
      commands.push(...Array.from(encoder.encode(`${itemTitle}\n`)));

      const qtyPrice = `  ${it.totalQuantity} ${it.unit} x ${it.unitPrice}`;
      const totalStr = `Rs.${it.totalAmount}`;
      const padLen = Math.max(1, 32 - qtyPrice.length - totalStr.length);
      const lineStr = qtyPrice + " ".repeat(padLen) + totalStr + "\n";
      commands.push(...Array.from(encoder.encode(lineStr)));

      if (it.batchAllocations && it.batchAllocations.length > 0) {
        const batchCodes = it.batchAllocations.map((b) => b.batchCodeString || "Batch").join(", ");
        commands.push(...Array.from(encoder.encode(`  [${batchCodes}]\n`)));
      }
    }

    commands.push(...Array.from(encoder.encode("--------------------------------\n")));

    // Subtotal & Grand Total
    const subtotalLine = `Subtotal:` + " ".repeat(Math.max(1, 32 - 9 - `Rs.${sale.subtotal}`.length)) + `Rs.${sale.subtotal}\n`;
    commands.push(...Array.from(encoder.encode(subtotalLine)));

    if (sale.discountAmount && sale.discountAmount > 0) {
      const discLine = `Discount (${sale.discountPercent || 0}%):` + " ".repeat(Math.max(1, 32 - 16 - `-Rs.${sale.discountAmount}`.length)) + `-Rs.${sale.discountAmount}\n`;
      commands.push(...Array.from(encoder.encode(discLine)));
    }

    // Grand Total (Bold)
    commands.push(0x1b, 0x45, 0x01);
    commands.push(0x1d, 0x21, 0x01); // double height
    const totalLine = `GRAND TOTAL:` + " ".repeat(Math.max(1, 16 - 12 - `Rs.${sale.grandTotal}`.length)) + `Rs.${sale.grandTotal}\n`;
    commands.push(...Array.from(encoder.encode(totalLine)));
    commands.push(0x1d, 0x21, 0x00);
    commands.push(0x1b, 0x45, 0x00);

    commands.push(...Array.from(encoder.encode(`Payment Mode: ${sale.paymentMode}\n`)));
    commands.push(...Array.from(encoder.encode("--------------------------------\n")));

    // Center Footer
    commands.push(0x1b, 0x61, 0x01);
    commands.push(...Array.from(encoder.encode("Thank You For Visiting!\n")));
    commands.push(...Array.from(encoder.encode("Have a Sweet Day\n\n\n")));

    // GS V 65 3: Paper cut with feed
    commands.push(0x1d, 0x56, 0x41, 0x03);

    return new Uint8Array(commands);
  };

  // Connect WebUSB Printer
  const connectUSB = async (): Promise<boolean> => {
    setError(null);
    if (typeof navigator === "undefined" || !(navigator as any).usb) {
      setError("WebUSB is not supported in this browser. Please use Google Chrome, Edge, or Brave on Windows/Mac/Linux.");
      return false;
    }

    try {
      setIsConnecting(true);
      const usb = (navigator as any).usb;
      const device = await usb.requestDevice({ filters: [] });

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Claim printer interface
      let endpointNumber = 1;
      let claimed = false;

      for (const iface of device.configuration.interfaces) {
        try {
          await device.claimInterface(iface.interfaceNumber);
          const outEndpoint = iface.alternate.endpoints.find(
            (e: any) => e.direction === "out" || e.direction === "outbound"
          );
          if (outEndpoint) {
            endpointNumber = outEndpoint.endpointNumber;
            claimed = true;
            break;
          }
        } catch (e) {
          // continue checking next interface
        }
      }

      if (!claimed) {
        // Fallback: claim interface 0
        try {
          await device.claimInterface(0);
        } catch (e) {}
      }

      setUsbEndpoint({ device, endpointNumber });
      setConnectedPrinter({
        type: "usb",
        name: device.productName || device.manufacturerName || "USB Thermal / Label Printer",
        device,
        isConnected: true,
      });

      return true;
    } catch (err: any) {
      console.error("WebUSB connection error:", err);
      if (err.name !== "NotFoundError") {
        setError(err.message || "Failed to connect to USB printer.");
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect Web Bluetooth Printer
  const connectBluetooth = async (): Promise<boolean> => {
    setError(null);
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      setError("Web Bluetooth is not supported in this browser. Please use Chrome or Edge on Windows/Android/Mac.");
      return false;
    }

    try {
      setIsConnecting(true);
      const bluetooth = (navigator as any).bluetooth;

      // Common Thermal & Label Printer Bluetooth GATT Service UUIDs
      const commonServices = [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        "0000ff00-0000-1000-8000-00805f9b34fb",
        "0000ffe0-0000-1000-8000-00805f9b34fb",
        "0000af30-0000-1000-8000-00805f9b34fb",
      ];

      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: commonServices,
      });

      const server = await device.gatt.connect();

      // Find writable characteristic
      let writeChar: any = null;

      for (const serviceUuid of commonServices) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch (e) {
          // continue checking other services
        }
      }

      if (!writeChar) {
        // Fallback: search all available services
        try {
          const services = await server.getPrimaryServices();
          for (const s of services) {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                writeChar = c;
                break;
              }
            }
            if (writeChar) break;
          }
        } catch (e) {}
      }

      if (!writeChar) {
        throw new Error("Connected to device but no writable print characteristic found.");
      }

      setBtCharacteristic(writeChar);
      setConnectedPrinter({
        type: "bluetooth",
        name: device.name || "Bluetooth Thermal / Label Printer",
        device,
        isConnected: true,
      });

      // Handle disconnect event
      device.addEventListener("gattserverdisconnected", () => {
        setConnectedPrinter(null);
        setBtCharacteristic(null);
      });

      return true;
    } catch (err: any) {
      console.error("Bluetooth connection error:", err);
      if (err.name !== "NotFoundError") {
        setError(err.message || "Failed to connect to Bluetooth printer.");
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect active printer
  const disconnectPrinter = async () => {
    try {
      if (connectedPrinter?.type === "usb" && usbEndpoint?.device) {
        await usbEndpoint.device.close();
      } else if (connectedPrinter?.type === "bluetooth" && connectedPrinter.device?.gatt?.connected) {
        connectedPrinter.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn("Disconnect error:", e);
    } finally {
      setConnectedPrinter(null);
      setUsbEndpoint(null);
      setBtCharacteristic(null);
    }
  };

  // Send raw bytes to connected printer (chunked for bluetooth/usb transfer limits)
  const sendBytes = async (data: Uint8Array): Promise<boolean> => {
    if (!connectedPrinter || !connectedPrinter.isConnected) {
      setError("No printer connected.");
      return false;
    }

    try {
      if (connectedPrinter.type === "usb" && usbEndpoint) {
        // WebUSB transfer: chunk in 64-byte packets for maximum USB microcontroller compatibility
        const chunkSize = 64;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await usbEndpoint.device.transferOut(usbEndpoint.endpointNumber, chunk);
        }
        return true;
      } else if (connectedPrinter.type === "bluetooth" && btCharacteristic) {
        // Bluetooth BLE packets are typically 20 to 100 bytes chunk size
        const chunkSize = 50;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          if (btCharacteristic.properties.writeWithoutResponse) {
            await btCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await btCharacteristic.writeValue(chunk);
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        return true;
      }
    } catch (err: any) {
      console.error("Print send error:", err);
      setError(`Print failed: ${err.message || err}`);
      return false;
    }
    return false;
  };

  // Print formatted sales receipt
  const printReceipt = async (sale: PrintableSaleDoc): Promise<boolean> => {
    if (connectedPrinter && connectedPrinter.isConnected) {
      const bytes = buildEscPosReceipt(sale);
      const success = await sendBytes(bytes);
      if (success) return true;
    }

    // Fallback to system print dialog only if not connected
    if (typeof window !== "undefined") {
      window.print();
      return true;
    }
    return false;
  };

  // Print Barcode Stickers Directly to Connected Printer
  const printBarcodeStickers = async (
    stickers: PrintableBarcodeSticker[],
    mode: PrinterProtocolMode = printerMode
  ): Promise<boolean> => {
    if (!connectedPrinter || !connectedPrinter.isConnected) {
      setError("No printer connected. Please connect your USB or Bluetooth printer first.");
      return false;
    }

    try {
      setError(null);
      for (const sticker of stickers) {
        const qty = Math.max(1, sticker.quantity || 1);

        if (mode === "tspl") {
          // Native TSPL Label Printer Mode (TSC, Xprinter, TVS LP 46)
          const tsplBytes = buildTsplBarcodeSticker(sticker);
          const ok = await sendBytes(tsplBytes);
          if (!ok) return false;
        } else {
          // ESC/POS Monochrome Raster Bitmap Mode (Works on all thermal/POS printers)
          const rasterBytes = buildEscPosBarcodeSticker(sticker);
          for (let q = 0; q < qty; q++) {
            const ok = await sendBytes(rasterBytes);
            if (!ok) return false;
            if (qty > 1) {
              await new Promise((r) => setTimeout(r, 60));
            }
          }
        }
      }
      return true;
    } catch (err: any) {
      console.error("Barcode sticker print error:", err);
      setError(`Barcode print failed: ${err.message || err}`);
      return false;
    }
  };

  // Print test receipt page
  const printTestPage = async (): Promise<boolean> => {
    const testDoc: PrintableSaleDoc = {
      billNumber: "TEST-001",
      storeName: "Sri Balaji Sweets (Main Branch)",
      customerName: "Test Customer",
      customerMobile: "9876543210",
      items: [
        {
          itemName: "Kaju Katli (250g)",
          totalQuantity: 1,
          unit: "Box",
          unitPrice: 200,
          totalAmount: 200,
          batchAllocations: [{ batchCodeString: "Batch #1", allocatedQty: 1 }],
        },
        {
          itemName: "Motichoor Laddu (500g)",
          totalQuantity: 1,
          unit: "Box",
          unitPrice: 150,
          totalAmount: 150,
          batchAllocations: [{ batchCodeString: "Batch #2", allocatedQty: 1 }],
        },
      ],
      subtotal: 350,
      discountAmount: 0,
      grandTotal: 350,
      paymentMode: "Cash",
    };

    return printReceipt(testDoc);
  };

  // Print test barcode sticker
  const printTestSticker = async (): Promise<boolean> => {
    const testSticker: PrintableBarcodeSticker = {
      businessName: "SRI BALAJI SWEETS",
      itemTitle: "KAJU KATLI 250G BOX",
      unitLabel: "1 PC",
      barcodeId: "7707",
      batchCode: "1",
      encodedBarcode: "7707*250*1",
      mrp: 200,
      quantity: 1,
    };
    return printBarcodeStickers([testSticker]);
  };

  const printRawText = async (text: string): Promise<boolean> => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text + "\n\n\n\x1d\x56\x41\x03");
    return sendBytes(bytes);
  };

  return (
    <PrinterContext.Provider
      value={{
        connectedPrinter,
        isConnecting,
        error,
        printerMode,
        setPrinterMode,
        connectUSB,
        connectBluetooth,
        disconnectPrinter,
        printReceipt,
        printBarcodeStickers,
        printTestPage,
        printTestSticker,
        printRawText,
        sendBytes,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
}
