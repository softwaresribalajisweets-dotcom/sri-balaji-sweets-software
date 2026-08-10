"use client";

import React from "react";
import AppLayout from "../components/AppLayout";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  FolderTree,
  DollarSign,
  ArrowUpRight,
  Plus,
  BarChart3,
  Calendar,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <AppLayout>
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neutral-900 text-white shadow-xs">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Dashboard
            </h1>
            <p className="text-xs text-neutral-500">
              Overview of store activity and sales summary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <span>Last 30 days</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Top Shopify-style KPI Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Daily Revenue Target</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900 font-mono">
              ₹0.00
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3 h-3" />
              0.0%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 border-t border-neutral-100 pt-2">
            No sales recorded today yet
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Total Inventory Items</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900 font-mono">
              0 Items
            </span>
            <span className="text-xs text-neutral-400 font-medium">Ready</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 border-t border-neutral-100 pt-2">
            Items page ready to add products
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Active Categories</span>
            <FolderTree className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900 font-mono">
              0 Categories
            </span>
            <span className="text-xs text-neutral-400 font-medium">Ready</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 border-t border-neutral-100 pt-2">
            Categories page ready to configure
          </div>
        </div>
      </div>

      {/* Main Content Area Card */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-8 shadow-2xs text-center flex flex-col items-center justify-center min-h-[380px]">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-4 border border-neutral-200/60">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">
          Welcome to Sri Balaji Sweets Admin
        </h2>
        <p className="text-sm text-neutral-500 max-w-md mb-6">
          This dashboard will display real-time sales metrics, inventory status,
          and daily performance reports once features are added.
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Dashboard layout ready for feature setup
        </div>
      </div>
    </AppLayout>
  );
}
