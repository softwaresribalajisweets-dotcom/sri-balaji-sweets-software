"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  FolderTree,
  Plus,
  Search,
  Trash2,
  Loader2,
  Layers,
  X,
  Tag,
  CheckCircle2,
} from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  createdAt?: any;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Firestore Snapshot Listener
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: CategoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as CategoryItem);
        });
        setCategories(items);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore categories error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Create Category Handler
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      setSaving(true);
      const nameTrimmed = categoryName.trim();
      const slug = nameTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      await addDoc(collection(db, "categories"), {
        name: nameTrimmed,
        slug,
        createdAt: serverTimestamp(),
      });

      setCategoryName("");
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(`Error saving category: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Category Handler
  const handleDeleteCategory = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete category "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "categories", id));
      } catch (err: any) {
        alert(`Failed to delete category: ${err.message}`);
      }
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Organize sweets, savories, and product groupings
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add category</span>
        </button>
      </div>

      {/* Metric Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Total Categories
          </span>
          <div className="mt-2 text-xl font-bold text-neutral-900 font-mono">
            {categories.length} Categories
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Live synchronized with Firebase
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Default Sweet Groups
          </span>
          <div className="mt-2 text-sm font-bold text-neutral-800 truncate">
            Sweets, Savories, Bakery, Hot Snacks
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Categories auto-created during bulk import
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Catalog Status
          </span>
          <div className="mt-2 text-xl font-bold text-emerald-600 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            Active
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Ready for POS and online catalog
          </div>
        </div>
      </div>

      {/* Main Categories Container */}
      <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-neutral-200/80 flex items-center justify-between bg-neutral-50/50">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
            <span className="text-xs font-medium">Loading Categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200/60">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No categories found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mb-5">
              Create categories like Kaju Sweets, Ghee Sweets, Hot Snacks, or Bakery to organize your items.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Category</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200/60 text-xs">
            <div className="bg-neutral-50/80 px-4 py-3 font-bold text-neutral-500 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Category Name</span>
              <span>Actions</span>
            </div>
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-neutral-100 text-neutral-700">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 text-sm">
                      {cat.name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                      /{cat.slug}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  title="Delete category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== ADD CATEGORY MODAL ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <FolderTree className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Add New Category
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !saving && setIsAddModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaju Sweets, Ghee Sweets, Hot Snacks"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  disabled={saving}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !categoryName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
