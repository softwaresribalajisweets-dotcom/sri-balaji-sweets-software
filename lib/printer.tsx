"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

interface PrinterContextType {
  connectedPrinter: ConnectedPrinterInfo | null;
  isConnecting: boolean;
  error: string | null;
  connectUSB: () => Promise<boolean>;
  connectBluetooth: () => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  printReceipt: (sale: PrintableSaleDoc) => Promise<boolean>;
  printTestPage: () => Promise<boolean>;
  printRawText: (text: string) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinterInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference to active Bluetooth characteristic or USB endpoint
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [usbEndpoint, setUsbEndpoint] = useState<{ device: any; endpointNumber: number } | null>(null);

  // Helper to build ESC/POS commands
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
      setError("WebUSB is not supported in this browser. Please use Google Chrome, Edge, or Brave.");
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
        name: device.productName || device.manufacturerName || "USB Thermal Printer",
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

      // Common Thermal Printer Bluetooth GATT Service UUIDs
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
        throw new Error("Connected to device but no ESC/POS print channel characteristic found.");
      }

      setBtCharacteristic(writeChar);
      setConnectedPrinter({
        type: "bluetooth",
        name: device.name || "Bluetooth Thermal Printer",
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
    if (!connectedPrinter) {
      return false;
    }

    try {
      if (connectedPrinter.type === "usb" && usbEndpoint) {
        await usbEndpoint.device.transferOut(usbEndpoint.endpointNumber, data);
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
          await new Promise((r) => setTimeout(r, 25));
        }
        return true;
      }
    } catch (err: any) {
      console.error("Print send error:", err);
      setError(`Print failed: ${err.message}`);
      return false;
    }
    return false;
  };

  // Print formatted receipt
  const printReceipt = async (sale: PrintableSaleDoc): Promise<boolean> => {
    if (connectedPrinter && connectedPrinter.isConnected) {
      const bytes = buildEscPosReceipt(sale);
      const success = await sendBytes(bytes);
      if (success) return true;
    }

    // Fallback to system print dialog
    if (typeof window !== "undefined") {
      window.print();
      return true;
    }
    return false;
  };

  // Print test page
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
        connectUSB,
        connectBluetooth,
        disconnectPrinter,
        printReceipt,
        printTestPage,
        printRawText,
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
