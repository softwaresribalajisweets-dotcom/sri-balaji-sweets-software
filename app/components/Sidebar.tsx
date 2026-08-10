"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Wrench,
  Settings,
  ChevronRight,
  Store,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Items",
    href: "/items",
    icon: Package,
  },
  {
    name: "Categories",
    href: "/categories",
    icon: FolderTree,
  },
  {
    name: "Utilities",
    href: "/utilities",
    icon: Wrench,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-[#ebebeb] border-r border-neutral-300/60 flex flex-col justify-between h-full select-none shrink-0">
      {/* Navigation Main List */}
      <div className="p-3 pt-3 space-y-1">
        <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href)) ||
            (pathname === "/" && item.href === "/dashboard");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200/80 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? "text-neutral-900"
                      : "text-neutral-500 group-hover:text-neutral-800"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                  {item.badge}
                </span>
              ) : isActive ? (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Bottom Store Profile / Footer */}
      <div className="p-3 border-t border-neutral-300/60 bg-[#e5e5e5]/50">
        <div className="p-2.5 rounded-xl bg-white/70 border border-neutral-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-800 truncate">
                Sri Balaji Sweets
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                Main Branch (Active)
              </p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        </div>
      </div>
    </aside>
  );
}
