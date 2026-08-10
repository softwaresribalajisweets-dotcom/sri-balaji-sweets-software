"use client";

import React from "react";
import { Search, Eye, Bell, Shield, Store } from "lucide-react";

export default function Header() {
  return (
    <header className="h-14 bg-[#0d0d0d] text-white flex items-center justify-between px-4 sticky top-0 z-50 shadow-md">
      {/* Left: Brand Logo & Workspace Pill */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center font-bold text-white shadow-sm text-sm">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight text-white flex items-center gap-2">
            Sri Balaji Sweets
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
              v1.0
            </span>
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-xl mx-6">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Search items, categories, or utilities..."
            className="w-full bg-[#1c1c1c] text-sm text-neutral-200 placeholder-neutral-400 pl-9 pr-20 py-1.5 rounded-lg border border-neutral-700/60 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all"
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-800 border border-neutral-700 rounded shadow-xs">
              CTRL
            </kbd>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-800 border border-neutral-700 rounded shadow-xs">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div className="flex items-center gap-3">
        {/* View Store Action Button */}
        <button
          type="button"
          className="hidden md:flex items-center gap-1.5 text-xs font-medium bg-[#1e1e1e] hover:bg-[#282828] text-neutral-200 border border-neutral-700/70 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-neutral-400" />
          <span>View POS</span>
        </button>

        {/* Mask / Admin Role Icon */}
        <button
          type="button"
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Admin Mode"
        >
          <Shield className="w-4 h-4" />
        </button>

        {/* Notifications Icon with Badge */}
        <button
          type="button"
          className="relative p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0d0d0d]"></span>
        </button>

        {/* Profile / Admin Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
          <div className="w-7 h-7 rounded-full bg-pink-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            SBS
          </div>
          <span className="hidden lg:inline-block text-xs font-medium text-neutral-200">
            Sri Balaji Sweets
          </span>
        </div>
      </div>
    </header>
  );
}
