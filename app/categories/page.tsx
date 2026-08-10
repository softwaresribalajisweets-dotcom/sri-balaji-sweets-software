"use client";

import React from "react";
import AppLayout from "../components/AppLayout";
import {
  FolderTree,
  Plus,
  Search,
  Download,
  Upload,
  ChevronDown,
  Layers,
} from "lucide-react";

export default function CategoriesPage() {
  return (
    <AppLayout>
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neutral-900 text-white shadow-xs">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Categories
            </h1>
            <p className="text-xs text-neutral-500">
              Organize sweets, savories, and product groups
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add category</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Total Categories
          </span>
          <div className="mt-2 text-xl font-bold text-neutral-900 font-mono">
            0 Categories
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Ready to add product groupings
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Primary Groups
          </span>
          <div className="mt-2 text-xl font-semibold text-neutral-400">
            Sweets, Savories, Bakery
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Default structure available
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Category Visibility
          </span>
          <div className="mt-2 text-xl font-bold text-emerald-600 font-mono">
            100% Active
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Visible on POS and store catalog
          </div>
        </div>
      </div>

      {/* Main Category Area Container */}
      <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-neutral-200/80 flex items-center justify-between bg-neutral-50/50">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search categories..."
              className="w-full bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200/60">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 mb-1">
            No categories defined
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mb-5">
            Create categories like Kaju Sweets, Ghee Sweets, Hot Snacks, or Bakery Items to organize your products.
          </p>
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
