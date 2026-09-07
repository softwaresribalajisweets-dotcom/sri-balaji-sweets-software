"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import AppLayout from "../components/AppLayout";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Users,
  Plus,
  Search,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  Briefcase,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Building2,
  Check,
  Power,
  RotateCcw,
} from "lucide-react";

export interface Employee {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  city: string;
  address: string;
  wageType: "monthly" | "daily";
  salary: number; // monthly salary or per-day amount
  photoUrl: string;
  status: "Active" | "Inactive";
  createdAt?: any;
}

const DEFAULT_AVATAR = "/default-img.png";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [wageFilter, setWageFilter] = useState<"all" | "monthly" | "daily">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [wageType, setWageType] = useState<"monthly" | "daily">("monthly");
  const [salary, setSalary] = useState<string>("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Photo State
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isCapturingLive, setIsCapturingLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Submitting state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStepText, setSaveStepText] = useState<string>("");

  // 1. Subscribe to employees
  useEffect(() => {
    const q = query(collection(db, "employees"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Employee[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Employee);
        });
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore employees error:", err);
        const qFallback = collection(db, "employees");
        onSnapshot(qFallback, (fallbackSnap) => {
          const list: Employee[] = [];
          fallbackSnap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Employee);
          });
          list.sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return tB - tA;
          });
          setEmployees(list);
          setLoading(false);
        });
      }
    );

    return () => unsub();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Helper to start live camera
  const startLiveCamera = async () => {
    try {
      setCameraError(null);
      setIsCapturingLive(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Could not access camera. Please allow camera permissions or upload an image file."
      );
      setIsCapturingLive(false);
    }
  };

  // Helper to stop live camera
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCapturingLive(false);
  };

  // Snap photo from camera stream
  const capturePhotoFromStream = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setPhotoPreview(dataUrl);
    }

    stopCameraStream();
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form
  const resetForm = () => {
    setName("");
    setMobile("");
    setEmail("");
    setCity("");
    setAddress("");
    setWageType("monthly");
    setSalary("");
    setStatus("Active");
    setPhotoPreview("");
    setEditingEmployee(null);
    stopCameraStream();
    setCameraError(null);
  };

  // Open modal for new employee
  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for editing employee
  const handleOpenEditModal = (emp: Employee) => {
    resetForm();
    setEditingEmployee(emp);
    setName(emp.name);
    setMobile(emp.mobile);
    setEmail(emp.email || "");
    setCity(emp.city);
    setAddress(emp.address);
    setWageType(emp.wageType);
    setSalary(emp.salary.toString());
    setStatus(emp.status);
    setPhotoPreview(emp.photoUrl);
    setIsModalOpen(true);
  };

  // Save Employee
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter Employee Name.");
      return;
    }
    if (!mobile.trim()) {
      alert("Please enter Mobile Number.");
      return;
    }
    if (!city.trim()) {
      alert("Please enter City.");
      return;
    }
    if (!address.trim()) {
      alert("Please enter Full Address.");
      return;
    }
    if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) {
      alert(
        wageType === "monthly"
          ? "Please enter a valid Monthly Salary amount."
          : "Please enter a valid Daily Wage per day amount."
      );
      return;
    }

    try {
      setIsSaving(true);
      let finalPhotoUrl = editingEmployee?.photoUrl || DEFAULT_AVATAR;

      // Upload to ImageKit if new image preview
      if (photoPreview && photoPreview.startsWith("data:image/")) {
        setSaveStepText("Uploading photo to ImageKit...");
        const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `emp_${cleanName}_${Date.now()}.jpg`;

        const ikRes = await fetch("/api/upload-imagekit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: photoPreview,
            fileName: fileName,
            folder: "/employees",
          }),
        });

        const ikData = await ikRes.json();
        if (!ikRes.ok || !ikData.url) {
          throw new Error(ikData.error || "Failed to upload photo to ImageKit");
        }

        finalPhotoUrl = ikData.url;
      } else if (photoPreview && !photoPreview.startsWith("data:")) {
        finalPhotoUrl = photoPreview;
      }

      setSaveStepText("Saving employee records...");

      const employeePayload = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || "",
        city: city.trim(),
        address: address.trim(),
        wageType: wageType,
        salary: Number(salary),
        photoUrl: finalPhotoUrl,
        status: status,
      };

      if (editingEmployee) {
        await updateDoc(doc(db, "employees", editingEmployee.id), {
          ...employeePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "employees"), {
          ...employeePayload,
          createdAt: serverTimestamp(),
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Error saving employee:", err);
      alert(`Failed to save employee: ${err.message}`);
    } finally {
      setIsSaving(false);
      setSaveStepText("");
    }
  };

  // Delete employee
  const handleDeleteEmployee = async (emp: Employee) => {
    if (confirm(`Are you sure you want to delete employee "${emp.name}"?`)) {
      try {
        await deleteDoc(doc(db, "employees", emp.id));
      } catch (err: any) {
        alert(`Failed to delete employee: ${err.message}`);
      }
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (emp: Employee) => {
    const nextStatus = emp.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDoc(doc(db, "employees", emp.id), {
        status: nextStatus,
      });
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesMobile = emp.mobile.includes(q);
        const matchesCity = emp.city.toLowerCase().includes(q);
        const matchesEmail = emp.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesMobile && !matchesCity && !matchesEmail) {
          return false;
        }
      }

      if (wageFilter !== "all" && emp.wageType !== wageFilter) {
        return false;
      }

      if (statusFilter !== "all" && emp.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [employees, searchQuery, wageFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "Active").length;
    const monthlyStaff = employees.filter((e) => e.wageType === "monthly");
    const dailyStaff = employees.filter((e) => e.wageType === "daily");

    const totalMonthlyPayroll = monthlyStaff.reduce((sum, e) => sum + (e.salary || 0), 0);
    const avgDailyWage =
      dailyStaff.length > 0
        ? Math.round(dailyStaff.reduce((sum, e) => sum + (e.salary || 0), 0) / dailyStaff.length)
        : 0;

    return {
      total,
      active,
      monthlyCount: monthlyStaff.length,
      dailyCount: dailyStaff.length,
      totalMonthlyPayroll,
      avgDailyWage,
    };
  }, [employees]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header - Compact, consistent with Stores & Store-Stock */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Employee Management
              </h1>
              <p className="text-xs text-neutral-500">
                Staff directory, live camera verification, wage structures, and payroll settings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>

        {/* 4 Compact Metric KPI Cards - Matching Store-Stock styling */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Staff */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Staff</span>
              <span className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700">
                <Users className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              {stats.total} <span className="text-xs font-normal text-neutral-500 font-sans">members</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              {stats.active} Active • {stats.total - stats.active} Inactive
            </div>
          </div>

          {/* Monthly Staff */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Monthly Staff</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              {stats.monthlyCount} <span className="text-xs font-normal text-neutral-500 font-sans">staff</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              Payroll: ₹{stats.totalMonthlyPayroll.toLocaleString("en-IN")}/mo
            </div>
          </div>

          {/* Daily Wage Staff */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Daily Wage Staff</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Briefcase className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              {stats.dailyCount} <span className="text-xs font-normal text-neutral-500 font-sans">workers</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
              Avg: ₹{stats.avgDailyWage.toLocaleString("en-IN")}/day
            </div>
          </div>

          {/* Active Workforce */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Status</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-emerald-700 font-mono">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100}%
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-600 font-medium truncate">
              {stats.active} operational staff
            </div>
          </div>
        </div>

        {/* Filter Bar & View Mode Toggle - Matching Stores page exactly */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, city, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 text-xs text-neutral-900 pl-9 pr-8 py-1.5 rounded-lg border border-neutral-300 focus:outline-none focus:bg-white focus:border-neutral-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Wage Filter */}
            <select
              value={wageFilter}
              onChange={(e) => setWageFilter(e.target.value as any)}
              className="bg-neutral-50 text-xs font-medium text-neutral-700 px-2.5 py-1.5 rounded-lg border border-neutral-300 outline-none cursor-pointer"
            >
              <option value="all">All Wages</option>
              <option value="monthly">Monthly Salary</option>
              <option value="daily">Daily Wage</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-neutral-50 text-xs font-medium text-neutral-700 px-2.5 py-1.5 rounded-lg border border-neutral-300 outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            {/* View Mode Toggle: Table / Grid */}
            <div className="flex items-center gap-0.5 bg-neutral-200/70 p-0.5 rounded-lg border border-neutral-300/60">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-neutral-900 shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-neutral-900 shadow-2xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT CONTAINER */}
        {loading ? (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center shadow-2xs">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-700 mx-auto mb-2" />
            <p className="text-xs text-neutral-500 font-medium">Loading employees...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center shadow-2xs">
            <Users className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-neutral-800">No Employees Found</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              {searchQuery || wageFilter !== "all" || statusFilter !== "all"
                ? "No employees match your search criteria. Try adjusting filters."
                : "No staff registered yet. Click 'Add Employee' to register your first team member."}
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ==================== 1. COMPACT TABLE VIEW (DEFAULT) ==================== */
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4">City & Address</th>
                    <th className="py-2.5 px-4">Wage Structure</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Employee Photo + Name */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={emp.photoUrl || DEFAULT_AVATAR}
                            alt={emp.name}
                            className="w-8 h-8 rounded-lg object-cover border border-neutral-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-900 block truncate">
                              {emp.name}
                            </span>
                            {emp.email && (
                              <span className="text-[10px] text-neutral-400 block truncate">
                                {emp.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-2.5 px-4 font-mono font-bold text-neutral-800">
                        <a
                          href={`tel:${emp.mobile}`}
                          className="hover:text-blue-600 inline-flex items-center gap-1.5"
                        >
                          <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span>{emp.mobile}</span>
                        </a>
                      </td>

                      {/* City & Address */}
                      <td className="py-2.5 px-4 max-w-xs">
                        <span className="font-semibold text-neutral-800">{emp.city}</span>
                        <p className="text-[11px] text-neutral-500 truncate" title={emp.address}>
                          {emp.address}
                        </p>
                      </td>

                      {/* Wage Type & Salary */}
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                            emp.wageType === "monthly"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {emp.wageType === "monthly" ? (
                            <>
                              <Calendar className="w-2.5 h-2.5" />
                              <span>Monthly: ₹{emp.salary.toLocaleString("en-IN")}/mo</span>
                            </>
                          ) : (
                            <>
                              <Briefcase className="w-2.5 h-2.5" />
                              <span>Daily: ₹{emp.salary.toLocaleString("en-IN")}/day</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.status === "Inactive"
                              ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingEmployee(emp)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 cursor-pointer"
                            title="View Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ==================== 2. COMPACT CARD VIEW ==================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <img
                      src={emp.photoUrl || DEFAULT_AVATAR}
                      alt={emp.name}
                      className="w-11 h-11 rounded-lg object-cover border border-neutral-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-xs font-bold text-neutral-900 truncate">{emp.name}</h3>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                            emp.status === "Active"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                            emp.wageType === "monthly"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {emp.wageType === "monthly"
                            ? `Monthly: ₹${emp.salary.toLocaleString("en-IN")}/mo`
                            : `Daily: ₹${emp.salary.toLocaleString("en-IN")}/day`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5 text-[11px] text-neutral-600">
                    <div className="flex items-center gap-1.5 font-mono text-neutral-800">
                      <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                      <a href={`tel:${emp.mobile}`} className="hover:underline">
                        {emp.mobile}
                      </a>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-neutral-400 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {emp.city} — {emp.address}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewingEmployee(emp)}
                    className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Profile</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(emp)}
                      className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-neutral-200 cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(emp)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== ADD / EDIT EMPLOYEE MODAL ==================== */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col my-6 max-h-[92vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3.5 px-5 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-neutral-900 text-white">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-neutral-900">
                    {editingEmployee ? `Edit Employee - ${editingEmployee.name}` : "Add New Employee"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setIsModalOpen(false);
                  }}
                  className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 text-xs">
                {/* 1. Photo Capture Section */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-800">
                      Employee Live Photo / Upload
                    </span>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview("");
                          stopCameraStream();
                        }}
                        className="text-[10px] font-semibold text-red-600 hover:underline cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {isCapturingLive ? (
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={capturePhotoFromStream}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Snap Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCameraStream}
                          className="px-2.5 py-1.5 bg-neutral-800/90 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="w-14 h-14 rounded-lg object-cover border border-neutral-300 shadow-2xs"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-neutral-200 flex items-center justify-center text-neutral-400 border border-neutral-300">
                            <Users className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={startLiveCamera}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Live Camera</span>
                        </button>

                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[11px] font-semibold rounded-lg cursor-pointer shadow-2xs">
                          <Upload className="w-3 h-3" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Employee Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                      Employee Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                      Email Address <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. ramesh@gmail.com"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                      City / Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Hyderabad"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                    Full Residential Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House/Plot No, Street, Landmark, Pin code..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs resize-none"
                  />
                </div>

                {/* 3. Wage Structure & Salary */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2.5">
                  <label className="text-[11px] font-bold text-neutral-800 block">
                    Wage Structure & Salary <span className="text-red-500">*</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWageType("monthly")}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        wageType === "monthly"
                          ? "bg-blue-50 border-blue-400 text-blue-900 font-bold"
                          : "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <div>
                          <div className="text-xs">Monthly Wage</div>
                          <div className="text-[10px] text-neutral-500 font-normal">Fixed salary</div>
                        </div>
                      </div>
                      {wageType === "monthly" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setWageType("daily")}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        wageType === "daily"
                          ? "bg-amber-50 border-amber-400 text-amber-900 font-bold"
                          : "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                        <div>
                          <div className="text-xs">Daily Wage</div>
                          <div className="text-[10px] text-neutral-500 font-normal">Per-day rate</div>
                        </div>
                      </div>
                      {wageType === "daily" && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                      {wageType === "monthly"
                        ? "Monthly Salary (₹)"
                        : "Daily Wage Amount per Day (₹)"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-neutral-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        placeholder={wageType === "monthly" ? "e.g. 20000" : "e.g. 700"}
                        className="w-full pl-7 pr-3 py-1.5 text-xs font-bold text-neutral-900 rounded-lg border border-neutral-300 focus:outline-none focus:border-neutral-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Status */}
                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-800">Employment Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="text-xs font-bold text-neutral-800 bg-white border border-neutral-300 rounded px-2.5 py-1 outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {isSaving && (
                  <div className="p-2.5 bg-neutral-900 text-white rounded-lg text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>{saveStepText || "Saving..."}</span>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      stopCameraStream();
                      setIsModalOpen(false);
                    }}
                    className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingEmployee ? "Update" : "Save Employee"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== VIEW EMPLOYEE PROFILE MODAL ==================== */}
        {viewingEmployee && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                <h3 className="text-xs font-bold text-neutral-900">Employee Profile</h3>
                <button
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                  className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 text-center border-b border-neutral-100">
                <img
                  src={viewingEmployee.photoUrl || DEFAULT_AVATAR}
                  alt={viewingEmployee.name}
                  className="w-16 h-16 rounded-xl object-cover mx-auto border border-neutral-200 shadow-2xs"
                />
                <h2 className="text-sm font-bold text-neutral-900 mt-2">
                  {viewingEmployee.name}
                </h2>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      viewingEmployee.status === "Active"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {viewingEmployee.status}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {viewingEmployee.wageType === "monthly" ? "Monthly Staff" : "Daily Wage"}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-2.5 text-xs">
                <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                  <span className="text-neutral-600 font-medium">
                    {viewingEmployee.wageType === "monthly" ? "Monthly Salary" : "Daily Wage"}
                  </span>
                  <span className="font-bold text-neutral-900">
                    ₹{viewingEmployee.salary.toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] text-neutral-500 font-normal">
                      {viewingEmployee.wageType === "monthly" ? "/mo" : "/day"}
                    </span>
                  </span>
                </div>

                <div className="space-y-1.5 text-neutral-700">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="font-mono font-bold">{viewingEmployee.mobile}</span>
                  </div>
                  {viewingEmployee.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{viewingEmployee.email}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-neutral-800">{viewingEmployee.city}</span>
                      <p className="text-[11px] text-neutral-500">{viewingEmployee.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployee;
                    setViewingEmployee(null);
                    handleOpenEditModal(emp);
                  }}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                  className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 text-xs font-semibold rounded-lg hover:bg-neutral-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
