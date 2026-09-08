"use client";

import React, { useState } from "react";
import {
  Store,
  Printer,
  Usb,
  Bluetooth,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  LogOut,
  User,
  ShieldCheck,
} from "lucide-react";
import { usePrinter } from "../../lib/printer";

export default function Header() {
  const {
    connectedPrinter,
    isConnecting,
    error,
    connectUSB,
    connectBluetooth,
    disconnectPrinter,
    printTestPage,
  } = usePrinter();

  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);

  const handleTestPrint = async () => {
    const ok = await printTestPage();
    if (ok) {
      setTestPrintSuccess(true);
      setTimeout(() => setTestPrintSuccess(false), 3000);
    }
  };

  return (
    <>
      <header className="h-14 bg-[#0d0d0d] text-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 shadow-md border-b border-neutral-800/80">
        {/* Left: ONLY Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 flex items-center justify-center font-bold text-white shadow-sm text-sm shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-white">
            Sri Balaji Sweets
          </span>
        </div>

        {/* Right: Printer Button + Login Details */}
        <div className="flex items-center gap-3">
          {/* Printer Connect & Direct Print Button */}
          <button
            type="button"
            onClick={() => setIsPrinterModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs ${
              connectedPrinter?.isConnected
                ? "bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border-emerald-700/80"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
            }`}
            title={
              connectedPrinter?.isConnected
                ? `Connected: ${connectedPrinter.name} (${connectedPrinter.type.toUpperCase()})`
                : "Connect USB / Bluetooth Thermal Printer"
            }
          >
            {connectedPrinter?.isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {connectedPrinter.type === "usb" ? (
                  <Usb className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className="hidden sm:inline truncate max-w-[120px]">
                  {connectedPrinter.name}
                </span>
                <span className="sm:hidden">Printer</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5 text-neutral-400" />
                <span>Connect Printer</span>
              </>
            )}
          </button>

          {/* Login Details Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-600 to-red-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-neutral-200 leading-tight">
                Cashier / Admin
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Online
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* PRINTER CONNECTION MODAL (WebUSB & Web Bluetooth)              */}
      {/* ============================================================== */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden text-neutral-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Thermal Printer Setup
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    WebUSB & Web Bluetooth Direct Printing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrinterModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Connection Status Card */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  connectedPrinter?.isConnected
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                    : "bg-neutral-50 border-neutral-200 text-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      connectedPrinter?.isConnected
                        ? "bg-emerald-500 ring-4 ring-emerald-100"
                        : "bg-neutral-400"
                    }`}
                  ></div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Status
                    </span>
                    <strong className="text-xs">
                      {connectedPrinter?.isConnected
                        ? `Connected via ${connectedPrinter.type.toUpperCase()}: ${connectedPrinter.name}`
                        : "No Direct Thermal Printer Connected"}
                    </strong>
                  </div>
                </div>

                {connectedPrinter?.isConnected && (
                  <button
                    type="button"
                    onClick={disconnectPrinter}
                    className="text-[11px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Banner */}
              {testPrintSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Test print sent successfully to printer!</span>
                </div>
              )}

              {/* Connect Buttons */}
              <div className="space-y-2">
                <label className="block font-bold text-neutral-700 text-xs">
                  Connect Direct Thermal Printer:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* WebUSB Button */}
                  <button
                    type="button"
                    onClick={connectUSB}
                    disabled={isConnecting}
                    className="p-3 bg-white border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl text-left transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Usb className="w-4 h-4 text-neutral-700 group-hover:text-blue-600" />
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        USB Cable
                      </span>
                    </div>
                    <span className="font-bold text-neutral-900 text-xs block">
                      Connect WebUSB
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Standard POS USB Printers
                    </span>
                  </button>

                  {/* Web Bluetooth Button */}
                  <button
                    type="button"
                    onClick={connectBluetooth}
                    disabled={isConnecting}
                    className="p-3 bg-white border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl text-left transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Bluetooth className="w-4 h-4 text-neutral-700 group-hover:text-blue-600" />
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                        Wireless
                      </span>
                    </div>
                    <span className="font-bold text-neutral-900 text-xs block">
                      Connect Bluetooth
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Wireless Bluetooth 58/80mm
                    </span>
                  </button>
                </div>
              </div>

              {/* Actions: Test Print & System Print Fallback */}
              <div className="pt-2 border-t border-neutral-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="flex-1 py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Test Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer"
                >
                  System Print
                </button>
              </div>

              <p className="text-[10px] text-neutral-400 text-center">
                Supported on Chrome, Edge, Brave, and Chromium POS terminals.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
