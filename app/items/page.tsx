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
  updateDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  Package,
  Search,
  Upload,
  Download,
  Plus,
  Trash2,
  Loader2,
  X,
  Tag,
  AlertTriangle,
  Barcode,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Save,
  DollarSign,
  Boxes,
} from "lucide-react";

interface ItemProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  hsnCode: string;
  gstPercent: number;
  stockCount: number;
  bufferStockCount: number;
  isThirdParty: boolean;
  barcodeId: string;
  imageUrl: string;
  createdAt?: any;
}

interface CategoryDoc {
  id: string;
  name: string;
  slug: string;
}

// Default sweet product image fallback from public folder
const DEFAULT_ITEM_IMAGE = "/default-img.png";
const ITEMS_PER_PAGE = 45;

export default function ItemsPage() {
  const [items, setItems] = useState<ItemProduct[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [hsnCode, setHsnCode] = useState("2106");
  const [gstPercent, setGstPercent] = useState<number>(5);
  const [stockCount, setStockCount] = useState<number | "">(50);
  const [bufferStockCount, setBufferStockCount] = useState<number | "">(10);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [barcodeId, setBarcodeId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [savingItem, setSavingItem] = useState(false);
  const [saveProgressStep, setSaveProgressStep] = useState("");

  // Edit Item Modal State
  const [editItem, setEditItem] = useState<ItemProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editCategory, setEditCategory] = useState("");
  const [editHsnCode, setEditHsnCode] = useState("");
  const [editGstPercent, setEditGstPercent] = useState<number>(5);
  const [editStockCount, setEditStockCount] = useState<number | "">(0);
  const [editBufferStockCount, setEditBufferStockCount] = useState<number | "">(0);
  const [editIsThirdParty, setEditIsThirdParty] = useState(false);
  const [editBarcodeId, setEditBarcodeId] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>("");
  const [updatingItem, setUpdatingItem] = useState(false);

  // View Item Modal State
  const [viewItem, setViewItem] = useState<ItemProduct | null>(null);

  // Bulk Upload Excel / CSV Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    step: string;
  } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter]);

  // Generate 12-digit numeric unique barcode for internal items
  const generateNumericBarcode = () => {
    const prefix = "890123";
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}${randomDigits}`;
  };

  // Subscribe to Realtime Firestore collections
  useEffect(() => {
    const qItems = query(collection(db, "items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(
      qItems,
      (snapshot) => {
        const productList: ItemProduct[] = [];
        snapshot.forEach((docSnap) => {
          productList.push({ id: docSnap.id, ...docSnap.data() } as ItemProduct);
        });
        setItems(productList);
        setLoadingItems(false);
      },
      (err) => {
        console.error("Firestore items error:", err);
        setLoadingItems(false);
      }
    );

    const qCats = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      const catList: CategoryDoc[] = [];
      snapshot.forEach((docSnap) => {
        catList.push({ id: docSnap.id, ...docSnap.data() } as CategoryDoc);
      });
      setCategories(catList);
    });

    return () => {
      unsubscribeItems();
      unsubscribeCats();
    };
  }, []);

  // Open Edit Modal with prefilled data
  const handleOpenEdit = (item: ItemProduct) => {
    setEditItem(item);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditCategory(item.category);
    setEditHsnCode(item.hsnCode || "2106");
    setEditGstPercent(item.gstPercent || 5);
    setEditStockCount(item.stockCount || 0);
    setEditBufferStockCount(item.bufferStockCount || 0);
    setEditIsThirdParty(item.isThirdParty || false);
    setEditBarcodeId(item.barcodeId || "");
    setEditImagePreview(item.imageUrl || DEFAULT_ITEM_IMAGE);
    setEditImageFile(null);
  };

  // Image Selection Handlers
  const handleAddImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Single Item Creation Handler
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

    try {
      setSavingItem(true);
      const selectedCategory =
        category === "__new__" ? customCategory.trim() : category.trim();

      if (!selectedCategory) {
        alert("Please select or enter a Category");
        setSavingItem(false);
        return;
      }

      setSaveProgressStep("Checking category...");
      const catSlug = selectedCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const existingCat = categories.find(
        (c) => c.slug === catSlug || c.name.toLowerCase() === selectedCategory.toLowerCase()
      );
      if (!existingCat) {
        await addDoc(collection(db, "categories"), {
          name: selectedCategory,
          slug: catSlug,
          createdAt: serverTimestamp(),
        });
      }

      const finalBarcode = isThirdParty
        ? barcodeId.trim() || generateNumericBarcode()
        : generateNumericBarcode();

      let finalImageUrl = DEFAULT_ITEM_IMAGE;
      if (imageFile && imagePreview) {
        setSaveProgressStep("Uploading image to ImageKit...");
        const uploadRes = await fetch("/api/upload-imagekit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: imagePreview,
            fileName: `item_${finalBarcode}_${Date.now()}.png`,
            folder: "/items",
          }),
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          finalImageUrl = uploadData.url;
        }
      }

      setSaveProgressStep("Saving item to Firebase...");
      await addDoc(collection(db, "items"), {
        name: name.trim(),
        price: Number(price),
        category: selectedCategory,
        hsnCode: hsnCode.trim() || "2106",
        gstPercent: Number(gstPercent) || 5,
        stockCount: Number(stockCount) || 0,
        bufferStockCount: Number(bufferStockCount) || 0,
        isThirdParty,
        barcodeId: finalBarcode,
        imageUrl: finalImageUrl,
        createdAt: serverTimestamp(),
      });

      setName("");
      setPrice("");
      setCategory("");
      setCustomCategory("");
      setHsnCode("2106");
      setGstPercent(5);
      setStockCount(50);
      setBufferStockCount(10);
      setIsThirdParty(false);
      setBarcodeId("");
      setImageFile(null);
      setImagePreview("");
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error creating item:", err);
      alert(`Error saving item: ${err.message}`);
    } finally {
      setSavingItem(false);
      setSaveProgressStep("");
    }
  };

  // Edit Item Submit Handler
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !editName.trim() || editPrice === "") return;

    try {
      setUpdatingItem(true);

      let updatedImageUrl = editItem.imageUrl || DEFAULT_ITEM_IMAGE;
      if (editImageFile && editImagePreview.startsWith("data:")) {
        const uploadRes = await fetch("/api/upload-imagekit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: editImagePreview,
            fileName: `item_${editItem.barcodeId}_${Date.now()}.png`,
            folder: "/items",
          }),
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          updatedImageUrl = uploadData.url;
        }
      }

      await updateDoc(doc(db, "items", editItem.id), {
        name: editName.trim(),
        price: Number(editPrice),
        category: editCategory.trim(),
        hsnCode: editHsnCode.trim() || "2106",
        gstPercent: Number(editGstPercent) || 5,
        stockCount: Number(editStockCount) || 0,
        bufferStockCount: Number(editBufferStockCount) || 0,
        isThirdParty: editIsThirdParty,
        barcodeId: editBarcodeId.trim() || editItem.barcodeId,
        imageUrl: updatedImageUrl,
      });

      setEditItem(null);
    } catch (err: any) {
      console.error("Failed to update item:", err);
      alert(`Error updating item: ${err.message}`);
    } finally {
      setUpdatingItem(false);
    }
  };

  // Delete Item Handler
  const handleDeleteItem = async (id: string, itemName: string) => {
    if (confirm(`Are you sure you want to delete item "${itemName}"?`)) {
      try {
        await deleteDoc(doc(db, "items", id));
      } catch (err: any) {
        alert(`Failed to delete item: ${err.message}`);
      }
    }
  };

  // Download Sample 100-Item Excel File (.xlsx)
  const handleDownloadSampleExcel = () => {
    const sampleCategories = [
      "Kaju Sweets",
      "Ghee Sweets",
      "Milk Sweets",
      "Bengali Sweets",
      "Hot Savories",
      "Dry Fruit Sweets",
      "Bakery & Cookies",
    ];

    const sampleSweetNames = [
      "Kaju Katli", "Special Mysore Pak", "Motichoor Ladoo", "Gulab Jamun",
      "Rasgulla", "Badam Halwa", "Dry Fruit Ladoo", "Sonpapdi", "Jalebi",
      "Milk Peda", "Basundi", "Kaju Roll", "Anjeer Barfi", "Rasmalai",
      "Soan Papdi", "Besan Ladoo", "Champakali", "Kala Jamun", "Malai Peda",
      "Sandesh", "Cham Cham", "Kaju Anjeer Cassatta", "Doodh Peda", "Gajar Ka Halwa",
      "Moong Dal Halwa", "Agra Petha", "Coconut Ladoo", "Rava Ladoo", "Balushahi",
      "Imarti", "Kalakand", "Rajbhog", "Kaju Pista Roll", "Milk Cake",
      "Special Bombay Halwa", "Karachi Halwa", "Dry Fruit Halwa", "Thabdi Peda",
      "Kesar Peda", "Malai Roll", "Shrikhand", "Kaju Kalash", "Chocolates Peda",
      "Kaju Chocolate Roll", "Special Ghee Jalebi", "Moong Dal Barfi", "Rava Kesari",
      "Special Badam Peda", "Dry Fruit Anjeer Roll", "Chana Dal Barfi",
      "Special Chekkalu", "Kara Sev", "Butter Murukku", "Ribbon Pakoda", "Mixture",
      "Karam Gavvalu", "Cornflakes Mixture", "Special Dal Moth", "Omapodi",
      "Kaju Pakoda", "Alo Bhujia", "Navratan Mixture", "Khatto Meetha Mixture",
      "Methi Mathri", "Namak Para", "Shakarpara", "Papdi", "Pani Puri Puri",
      "Special Garlic Sev", "Boondi", "Carrot Halwa", "Dates Halwa",
      "Coconut Barfi", "Til Ladoo", "Gud Ladoo", "Pinni", "Panjeeri",
      "Peanut Chikki", "Kaju Chikki", "Sesame Chikki", "Dry Fruit Chikki",
      "Pista Barfi", "Badam Barfi", "Akhrot Halwa", "Khoya Burfi", "Dry Jamun",
      "Angoori Jamun", "Kesar Rasgulla", "Chocolate Sandesh", "Mango Sandesh",
      "Pineapple Sandesh", "Apple Peda", "Orange Barfi", "Strawberry Peda",
      "Kiwi Barfi", "Paan Peda", "Rose Ladoo", "Kesar Pista Ladoo", "Badam Katli"
    ];

    const sampleRows = [];
    for (let i = 0; i < 100; i++) {
      const name = sampleSweetNames[i] || `Sweet Item #${i + 1}`;
      const price = Math.floor(150 + (i % 20) * 45);
      const category = sampleCategories[i % sampleCategories.length];
      const hsnCode = i % 5 === 0 ? "1905" : "2106";
      const gstPercent = i % 4 === 0 ? 12 : 5;
      const stockCount = Math.floor(20 + (i % 15) * 10);
      const bufferStockCount = 10;
      const isThirdParty = i % 8 === 0;
      const barcodeId = isThirdParty
        ? `890${100000000 + i}`
        : `890123${String(i + 1).padStart(6, "0")}`;

      sampleRows.push({
        "Item Name": name,
        "Price": price,
        "Category": category,
        "HSN Code": hsnCode,
        "GST Percent": gstPercent,
        "Stock Count": stockCount,
        "Buffer Stock Count": bufferStockCount,
        "Is Third Party": isThirdParty ? "Yes" : "No",
        "Barcode ID": barcodeId,
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet["!cols"] = [
      { wch: 28 },
      { wch: 10 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items Template");
    XLSX.writeFile(workbook, "Sri_Balaji_Sweets_100_Items_Sample.xlsx");
  };

  // Bulk Import Excel / CSV Handler
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) {
      alert("Please select an Excel (.xlsx, .xls) or CSV file to upload.");
      return;
    }

    try {
      setBulkUploading(true);

      const dataBuffer = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (jsonRows.length === 0) {
        alert("The uploaded Excel/CSV file contains no rows.");
        setBulkUploading(false);
        return;
      }

      const total = jsonRows.length;
      const categorySet = new Set(categories.map((c) => c.name.toLowerCase()));

      for (let i = 0; i < total; i++) {
        const row = jsonRows[i];

        const rowName =
          row["Item Name"] || row["name"] || row["Name"] || `Item #${i + 1}`;
        const rowPrice =
          Number(row["Price"] || row["price"] || row["PRICE"]) || 100;
        const rowCategory =
          row["Category"] || row["category"] || row["Category Name"] || "General Sweets";
        const rowHsn =
          String(row["HSN Code"] || row["hsnCode"] || row["HSN"] || "2106");
        const rowGst =
          Number(row["GST Percent"] || row["gstPercent"] || row["GST%"]) || 5;
        const rowStock =
          Number(row["Stock Count"] || row["stockCount"] || row["Stock"]) || 50;
        const rowBuffer =
          Number(row["Buffer Stock Count"] || row["bufferStockCount"] || row["Buffer Stock"]) || 10;
        
        const thirdPartyRaw = String(row["Is Third Party"] || row["isThirdParty"] || "").toLowerCase();
        const rowThirdParty = thirdPartyRaw === "yes" || thirdPartyRaw === "true" || thirdPartyRaw === "1";

        const rowBarcode =
          String(row["Barcode ID"] || row["barcodeId"] || row["Barcode"] || "").trim() ||
          generateNumericBarcode();

        setBulkProgress({
          current: i + 1,
          total,
          step: `Processing ${rowName}...`,
        });

        const catLower = rowCategory.toString().trim().toLowerCase();
        if (!categorySet.has(catLower)) {
          const catSlug = catLower.replace(/[^a-z0-9]+/g, "-");
          await addDoc(collection(db, "categories"), {
            name: rowCategory.toString().trim(),
            slug: catSlug,
            createdAt: serverTimestamp(),
          });
          categorySet.add(catLower);
        }

        await addDoc(collection(db, "items"), {
          name: rowName.toString().trim(),
          price: rowPrice,
          category: rowCategory.toString().trim(),
          hsnCode: rowHsn.trim(),
          gstPercent: rowGst,
          stockCount: rowStock,
          bufferStockCount: rowBuffer,
          isThirdParty: rowThirdParty,
          barcodeId: rowBarcode,
          imageUrl: DEFAULT_ITEM_IMAGE,
          createdAt: serverTimestamp(),
        });
      }

      setIsBulkModalOpen(false);
      setBulkFile(null);
      setBulkProgress(null);
      alert(`Successfully imported ${total} items from Excel/CSV into inventory!`);
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      alert(`Bulk upload error: ${err.message}`);
    } finally {
      setBulkUploading(false);
      setBulkProgress(null);
    }
  };

  // Filtered Items List
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat =
      categoryFilter === "all" || item.category.toLowerCase() === categoryFilter.toLowerCase();

    return matchesSearch && matchesCat;
  });

  // Calculate Pagination Slices (Strict 45 Items per page)
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

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
              Items & Product Catalog
            </h1>
            <p className="text-xs text-neutral-500">
              Manage sweet products, prices, stock levels, GST rates, and numeric barcodes
            </p>
          </div>
        </div>

        {/* Action Buttons matching Shopify Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bulk Upload Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Total Inventory Products
          </span>
          <div className="mt-2 text-xl font-bold text-neutral-900 font-mono">
            {items.length} Products
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Live synchronized with Firebase
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Low Stock Alerts
          </span>
          <div className="mt-2 text-xl font-bold text-amber-600 font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {items.filter((i) => i.stockCount <= i.bufferStockCount).length} Low Items
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Items at or below buffer stock threshold
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500">
            Active Categories
          </span>
          <div className="mt-2 text-xl font-bold text-purple-600 font-mono flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            {categories.length} Categories
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Organized in product catalog
          </div>
        </div>
      </div>

      {/* Main Items Data Table Card */}
      <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Filter Header Bar */}
        <div className="p-3 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, barcode ID, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white text-xs text-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-300 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            Page <strong className="font-mono text-neutral-900">{currentPage}</strong> of{" "}
            <strong className="font-mono text-neutral-900">{totalPages}</strong>
          </div>
        </div>

        {/* Data Table */}
        {loadingItems ? (
          <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-700" />
            <span className="text-xs font-medium">Loading Items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3 border border-neutral-200/60">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No items in catalog
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mb-5">
              Click "Add Item" to add single sweet items or "Bulk Upload Excel" to load 100 sample items at once.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Bulk Upload Excel / CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-14">Image</th>
                    <th className="py-3 px-4">Item & Barcode</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price (₹)</th>
                    <th className="py-3 px-4">Stock Status</th>
                    <th className="py-3 px-4">Tax / HSN</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {paginatedItems.map((item) => {
                    const isLowStock = item.stockCount <= item.bufferStockCount;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-neutral-50/60 transition-colors group"
                      >
                        {/* Image Thumbnail */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            className="cursor-pointer block"
                            title="Click to view details"
                          >
                            <img
                              src={item.imageUrl || DEFAULT_ITEM_IMAGE}
                              alt={item.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                              }}
                              className="w-10 h-10 object-cover rounded-lg border border-neutral-200 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                          </button>
                        </td>

                        {/* Name & Barcode */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            className="font-bold text-neutral-900 text-sm hover:text-blue-600 transition-colors text-left cursor-pointer"
                          >
                            {item.name}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-neutral-500" />
                              {item.barcodeId}
                            </span>
                            {item.isThirdParty && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                Third Party
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 font-semibold text-neutral-700">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 border border-neutral-200">
                            <Tag className="w-3 h-3 text-neutral-500" />
                            {item.category}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 font-bold text-neutral-900 font-mono text-sm">
                          ₹{item.price.toFixed(2)}
                        </td>

                        {/* Stock Status */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isLowStock
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                              {item.stockCount} in stock
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              (Min: {item.bufferStockCount})
                            </span>
                          </div>
                        </td>

                        {/* Tax & HSN */}
                        <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">
                          GST: {item.gstPercent}% | HSN: {item.hsnCode}
                        </td>

                        {/* Actions (View, Edit, Delete) */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Item */}
                            <button
                              type="button"
                              onClick={() => setViewItem(item)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                              title="View Product Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-neutral-600" />
                            </button>

                            {/* Edit Item */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Edit Product"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Item */}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Bar */}
            <div className="p-3.5 bg-neutral-50/80 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-neutral-600 font-medium">
                Showing <strong className="font-mono text-neutral-900">{startIndex + 1}</strong> to{" "}
                <strong className="font-mono text-neutral-900">
                  {Math.min(endIndex, filteredItems.length)}
                </strong>{" "}
                of <strong className="font-mono text-neutral-900">{filteredItems.length}</strong> products
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-neutral-900 text-white shadow-xs"
                          : "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-lg font-semibold shadow-2xs hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== VIEW ITEM DETAILS MODAL ==================== */}
      {viewItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Product Details
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    ID: {viewItem.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-start gap-4">
                <img
                  src={viewItem.imageUrl || DEFAULT_ITEM_IMAGE}
                  alt={viewItem.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_ITEM_IMAGE;
                  }}
                  className="w-24 h-24 object-cover rounded-xl border border-neutral-300 shadow-xs shrink-0"
                />

                <div className="space-y-1.5 flex-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                    <Tag className="w-3 h-3 text-neutral-500" />
                    {viewItem.category}
                  </span>
                  <h2 className="text-lg font-bold text-neutral-900">
                    {viewItem.name}
                  </h2>
                  <div className="text-xl font-bold text-neutral-900 font-mono">
                    ₹{viewItem.price.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100 text-xs">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                    Barcode ID
                  </span>
                  <span className="font-mono font-bold text-neutral-900 text-sm flex items-center gap-1">
                    <Barcode className="w-4 h-4 text-neutral-600" />
                    {viewItem.barcodeId}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                    Stock Level
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                      viewItem.stockCount <= viewItem.bufferStockCount
                        ? "bg-amber-100 text-amber-900 border border-amber-200"
                        : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                    }`}
                  >
                    {viewItem.stockCount} units (Min: {viewItem.bufferStockCount})
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                    Taxation & HSN
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    GST: {viewItem.gstPercent}% | HSN: {viewItem.hsnCode}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                    Item Source
                  </span>
                  <span className="font-bold text-neutral-800">
                    {viewItem.isThirdParty ? "Third-Party Vendor" : "In-House Sweet"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewItem(null);
                  handleOpenEdit(viewItem);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                <span>Edit Item</span>
              </button>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT ITEM MODAL ==================== */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-blue-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Edit Product - {editItem.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    ID: {editItem.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !updatingItem && setEditItem(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={updatingItem}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={editPrice}
                    onChange={(e) =>
                      setEditPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={editHsnCode}
                    onChange={(e) => setEditHsnCode(e.target.value)}
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    GST Percentage (%)
                  </label>
                  <select
                    value={editGstPercent}
                    onChange={(e) => setEditGstPercent(Number(e.target.value))}
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono cursor-pointer"
                  >
                    <option value={5}>5% (Standard Sweets)</option>
                    <option value={12}>12% (Processed Savories)</option>
                    <option value={18}>18% (Confectionery)</option>
                    <option value={0}>0% (Exempted)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Stock Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editStockCount}
                    onChange={(e) =>
                      setEditStockCount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Buffer Stock Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editBufferStockCount}
                    onChange={(e) =>
                      setEditBufferStockCount(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIsThirdParty}
                    onChange={(e) => setEditIsThirdParty(e.target.checked)}
                    disabled={updatingItem}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-800 cursor-pointer"
                  />
                  <span>Is Third Party Item?</span>
                </label>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Barcode ID
                  </label>
                  <input
                    type="text"
                    value={editBarcodeId}
                    onChange={(e) => setEditBarcodeId(e.target.value)}
                    disabled={updatingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Change Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  disabled={updatingItem}
                  className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer"
                />

                {editImagePreview && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg border border-neutral-300 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              {updatingItem && (
                <div className="p-3 bg-blue-50 rounded-lg text-xs font-semibold text-blue-900 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                  <span>Updating product details...</span>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  disabled={updatingItem}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingItem || !editName.trim() || editPrice === ""}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updatingItem ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD ITEM MODAL ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-neutral-200 my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-900 text-white">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Add New Item
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !savingItem && setIsAddModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaju Katli (1 KG)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingItem}
                  className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) =>
                      setPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Category...</option>
                  </select>
                </div>
              </div>

              {category === "__new__" && (
                <div>
                  <label className="block text-xs font-bold text-purple-700 mb-1">
                    New Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Special Ghee Sweets"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    disabled={savingItem}
                    className="w-full bg-purple-50 text-xs text-purple-900 p-2.5 rounded-lg border border-purple-300 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2106"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    GST Percentage (%)
                  </label>
                  <select
                    value={gstPercent}
                    onChange={(e) => setGstPercent(Number(e.target.value))}
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono cursor-pointer"
                  >
                    <option value={5}>5% (Standard Sweets)</option>
                    <option value={12}>12% (Processed Savories)</option>
                    <option value={18}>18% (Confectionery)</option>
                    <option value={0}>0% (Exempted)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Stock Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="50"
                    value={stockCount}
                    onChange={(e) =>
                      setStockCount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Buffer Stock Count (Alert Threshold)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="10"
                    value={bufferStockCount}
                    onChange={(e) =>
                      setBufferStockCount(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={savingItem}
                    className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-neutral-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isThirdParty}
                    onChange={(e) => setIsThirdParty(e.target.checked)}
                    disabled={savingItem}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-800 cursor-pointer"
                  />
                  <span>Is Third Party Item?</span>
                </label>

                {isThirdParty ? (
                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-1">
                      Third-Party Barcode ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={isThirdParty}
                      placeholder="e.g. 890105800123"
                      value={barcodeId}
                      onChange={(e) => setBarcodeId(e.target.value)}
                      disabled={savingItem}
                      className="w-full bg-white text-xs text-neutral-900 p-2.5 rounded-lg border border-purple-300 focus:outline-none font-mono"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    Numeric Barcode ID will be <strong>auto-generated (12-digit numeric)</strong> upon saving.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Item Image (Uploaded to ImageKit)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAddImageChange}
                  disabled={savingItem}
                  className="w-full text-xs text-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer"
                />

                {imagePreview ? (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg border border-neutral-300 shadow-2xs"
                    />
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Image ready for ImageKit upload
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 mt-1">
                    If no image is uploaded, a default sweet product image will be assigned.
                  </p>
                )}
              </div>

              {savingItem && (
                <div className="p-3 bg-neutral-100 rounded-lg text-xs font-semibold text-neutral-800 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
                  <span>{saveProgressStep}</span>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={savingItem}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem || !name.trim() || price === ""}
                  className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== BULK UPLOAD EXCEL / CSV MODAL ==================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Bulk Import Excel / CSV
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Supports .xlsx, .xls, and .csv files with auto-category creation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !bulkUploading && setIsBulkModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImportSubmit} className="p-5 space-y-4">
              {/* Download Sample Button */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800">
                    Need an Excel template?
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample Excel (.xlsx)</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Pre-filled with 100 realistic sweet products, prices, categories, HSN codes, and auto-generated barcodes.
                </p>
              </div>

              {/* Upload Excel / CSV */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Select Excel (.xlsx, .xls) or CSV File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  required
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  disabled={bulkUploading}
                  className="w-full text-xs text-neutral-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800 cursor-pointer"
                />
              </div>

              {bulkProgress && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                      Importing Products...
                    </span>
                    <span>
                      {bulkProgress.current} / {bulkProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
                      style={{
                        width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800 font-mono truncate">
                    {bulkProgress.step}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  disabled={bulkUploading}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkUploading || !bulkFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {bulkUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Start Excel Import</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
