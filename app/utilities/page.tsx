"use client";

import React from "react";
import AppLayout from "../components/AppLayout";
import {
  Wrench,
  Printer,
  Sliders,
  FileSpreadsheet,
  Database,
  ArrowRight,
} from "lucide-react";

export default function UtilitiesPage() {
  const utilityTools = [
    {
      title: "Bulk Price Adjustment",
      description: "Quickly update prices across entire categories or items.",
      icon: Sliders,
      badge: "Ready",
    },
    {
      title: "Weight & Barcode Label Printer",
      description: "Generate and print price tags and barcode stickers.",
      icon: Printer,
      badge: "Ready",
    },
    {
      title: "Inventory Stock Reconciliation",
      description: "Audit physical stock levels and record adjustments.",
      icon: FileSpreadsheet,
      badge: "Ready",
    },
    {
      title: "Backup & Data Export",
      description: "Export full store inventory, sales reports, and customer records.",
      icon: Database,
      badge: "Ready",
    },
  ];

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
              Utilities
            </h1>
            <p className="text-xs text-neutral-500">
              System management tools, batch price editing, and label printing
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Utility Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {utilityTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.title}
              className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs hover:border-neutral-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-neutral-100 text-neutral-800">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                    {tool.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-neutral-900 mb-1">
                  {tool.title}
                </h3>
                <p className="text-xs text-neutral-500">{tool.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-400">
                  Tool ready for setup
                </span>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-neutral-800 hover:text-neutral-950 cursor-pointer"
                >
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
