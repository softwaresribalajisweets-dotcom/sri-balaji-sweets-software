"use client";

import React from "react";
import AppLayout from "../components/AppLayout";
import {
  Package,
  Search,
  Upload,
  Download,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";

export default function ItemsPage() {
  return (
    <AppLayout>
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neutral-900 text-white shadow-xs">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Items & Products
            </h1>
            <p className="text-xs text-neutral-500">
              Manage product inventory, pricing, and details
            </p>
          </div>
        </div>

        {/* Action Buttons Matching Shopify Header Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Export</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            <span>Import</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <span>More actions</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add item</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Bar matching Shopify layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-500">
            Average Sell-through Rate
          </span>
          <div className="mt-2 text-xl font-bold text-neutral-900 font-mono">
            0.00%
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Calculated over last 30 days
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-500">
            Days of Inventory Remaining
          </span>
          <div className="mt-2 text-xl font-semibold text-neutral-400">
            No data
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Inventory metrics will display here
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-neutral-500">
            ABC Product Analysis
          </span>
          <div className="mt-2 text-sm font-semibold text-neutral-700 flex items-center gap-3">
            <span>
              <strong className="font-mono text-neutral-900">₹0.00</strong> A
            </span>
            <span className="text-neutral-300">|</span>
            <span>
              <strong className="font-mono text-neutral-900">₹0.00</strong> B
            </span>
            <span className="text-neutral-300">|</span>
            <span>
              <strong className="font-mono text-neutral-900">₹0.00</strong> C
            </span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Classification based on sales volume
          </div>
        </div>
      </div>

      {/* Main Items Data Table Card */}
      <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Filter Header Bar */}
        <div className="p-3 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 shadow-2xs"
            >
              <span>All</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search and filter items..."
                className="w-full bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200"
              title="Column visibility"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty Table State Container */}
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200/60">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 mb-1">
            No items added yet
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mb-5">
            Start adding your sweet products, prices, and categories to manage your inventory.
          </p>
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Item</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
