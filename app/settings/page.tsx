"use client";

import React, { useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  Settings,
  Store,
  Receipt,
  Percent,
  Users,
  Printer,
  Save,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", name: "General Profile", icon: Store },
    { id: "tax", name: "Tax & Billing", icon: Percent },
    { id: "pos", name: "POS & Receipts", icon: Receipt },
    { id: "printer", name: "Printer Setup", icon: Printer },
    { id: "users", name: "Users & Roles", icon: Users },
  ];

  return (
    <AppLayout>
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neutral-900 text-white shadow-xs">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Settings
            </h1>
            <p className="text-xs text-neutral-500">
              Manage store profile, tax rules, receipt printing, and access controls
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Main Settings Section Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Navigation Tabs */}
        <div className="md:col-span-1 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200/90 font-bold"
                    : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-neutral-900" : "text-neutral-500"
                  }`}
                />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Content Card */}
        <div className="md:col-span-3 bg-white border border-neutral-200/90 rounded-xl p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
            <div>
              <h2 className="text-base font-bold text-neutral-900 capitalize">
                {tabs.find((t) => t.id === activeTab)?.name} Settings
              </h2>
              <p className="text-xs text-neutral-500">
                Configure your preference options below.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Page ready for configuration
            </span>
          </div>

          <div className="p-8 text-center flex flex-col items-center justify-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
            <Settings className="w-8 h-8 text-neutral-400 mb-2" />
            <p className="text-sm font-semibold text-neutral-800">
              {tabs.find((t) => t.id === activeTab)?.name} Options
            </p>
            <p className="text-xs text-neutral-500 max-w-sm mt-1">
              This settings panel is initialized and ready for customization.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
