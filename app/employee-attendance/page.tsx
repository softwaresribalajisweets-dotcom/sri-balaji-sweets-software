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
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  Users,
  UserCheck,
  Search,
  Camera,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Calendar as CalendarIcon,
  Eye,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Store,
  ScanFace,
  AlertTriangle,
} from "lucide-react";

interface Employee {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  city: string;
  address: string;
  latitude?: number | string;
  longitude?: number | string;
  wageType: "monthly" | "daily";
  salary: number;
  photoUrl: string;
  status: "Active" | "Inactive";
}

interface StoreBranch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  isMainBranch?: boolean;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeMobile: string;
  wageType: "monthly" | "daily";
  salary: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  status: "Present" | "Late" | "Half Day";
  deviceLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  targetLocation: {
    latitude: number;
    longitude: number;
    label?: string;
  };
  distanceMeters: number;
  faceMatchScore: number; // percentage e.g. 96
  faceDistance: number; // euclidean distance e.g. 0.32
  liveCapturePhotoUrl: string;
  createdAt?: any;
}

const DEFAULT_AVATAR = "/default-img.png";

// Haversine formula to compute distance in meters between two lat/lng coordinates
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Format date helper YYYY-MM-DD
function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EmployeeAttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<StoreBranch[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Date Filter (default today)
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateKey(new Date()));

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent">("all");
  const [wageFilter, setWageFilter] = useState<"all" | "monthly" | "daily">("all");

  // Verification Modal State
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [step, setStep] = useState<"gps" | "camera" | "result">("gps");

  // GPS Verification State
  const [isVerifyingGps, setIsVerifyingGps] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsPassed, setGpsPassed] = useState<boolean | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Face Recognition State
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isCapturingLive, setIsCapturingLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceMatchResult, setFaceMatchResult] = useState<{
    matched: boolean;
    distance: number;
    similarity: number;
    message: string;
    capturedImage: string;
  } | null>(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState("");

  // Audit Slip Modal
  const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceApiModuleRef = useRef<any>(null);

  // 1. Fetch Employees & Stores
  useEffect(() => {
    const qEmp = query(collection(db, "employees"), orderBy("name", "asc"));
    const unsubEmp = onSnapshot(qEmp, (snap) => {
      const list: Employee[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Employee));
      setEmployees(list);
    });

    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(qStores, (snap) => {
      const list: StoreBranch[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as StoreBranch));
      setStores(list);
    });

    return () => {
      unsubEmp();
      unsubStores();
    };
  }, []);

  // 2. Fetch Attendance for Selected Date
  useEffect(() => {
    setLoading(true);
    const qAtt = query(
      collection(db, "employee_attendance"),
      where("date", "==", selectedDate)
    );

    const unsub = onSnapshot(
      qAtt,
      (snap) => {
        const list: AttendanceRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AttendanceRecord));
        setAttendanceList(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching attendance:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedDate]);

  // Lazy load face-api models from /models
  const loadFaceApiModels = async () => {
    if (faceApiModuleRef.current && faceApiLoaded) return faceApiModuleRef.current;

    try {
      setModelsLoading(true);
      const faceapi = await import("@vladmandic/face-api");
      faceApiModuleRef.current = faceapi;

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      ]);

      setFaceApiLoaded(true);
      setModelsLoading(false);
      return faceapi;
    } catch (err: any) {
      console.error("Error loading face-api models:", err);
      setModelsLoading(false);
      throw new Error(`Failed to load AI Face Recognition models: ${err.message}`);
    }
  };

  // Cleanup camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCapturingLive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
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

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Could not access device camera. Please allow camera permissions in your browser."
      );
      setIsCapturingLive(false);
    }
  };

  // Helper to resolve target location for employee
  const resolveTargetLocation = (emp: Employee) => {
    if (emp.latitude && emp.longitude && !isNaN(Number(emp.latitude)) && !isNaN(Number(emp.longitude))) {
      return {
        lat: Number(emp.latitude),
        lng: Number(emp.longitude),
        label: `${emp.city} (Registered Workplace)`,
      };
    }

    const mainStore = stores.find((s) => s.isMainBranch) || stores[0];
    return {
      lat: 17.385044, // Default HQ
      lng: 78.486671,
      label: mainStore ? `${mainStore.name} Branch` : "Sri Balaji Sweets Main Store",
    };
  };

  // Open verification modal & execute GPS Geofence Check
  const handleStartAttendance = async (emp: Employee) => {
    const alreadyMarked = attendanceList.some((a) => a.employeeId === emp.id);
    if (alreadyMarked) {
      alert(`Attendance for ${emp.name} has already been recorded for today!`);
      return;
    }

    setActiveEmployee(emp);
    setStep("gps");
    setDeviceCoords(null);
    setDistanceMeters(null);
    setGpsPassed(null);
    setGpsError(null);
    setFaceMatchResult(null);

    const target = resolveTargetLocation(emp);
    setTargetCoords(target);

    executeGpsCheck(target);
  };

  // Execute GPS Geofence Check (Strict 50m radius)
  const executeGpsCheck = (target: { lat: number; lng: number; label: string }) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by this device.");
      setGpsPassed(false);
      return;
    }

    setIsVerifyingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const devLat = position.coords.latitude;
        const devLng = position.coords.longitude;
        setDeviceCoords({ lat: devLat, lng: devLng });

        const distance = getDistanceInMeters(devLat, devLng, target.lat, target.lng);
        setDistanceMeters(distance);

        const passed = distance <= 50;
        setGpsPassed(passed);
        setIsVerifyingGps(false);

        if (!passed) {
          setGpsError(
            `You are ${distance}m away from ${target.label}. Strict security requires attendance to be marked within a 50m radius.`
          );
        }
      },
      (err) => {
        console.error("GPS error:", err);
        setIsVerifyingGps(false);
        setGpsPassed(false);
        setGpsError(
          `Location check failed: ${err.message}. Please enable device location permissions.`
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Proceed to Face Recognition Camera after GPS passes
  const handleProceedToCamera = async () => {
    if (!gpsPassed) return;
    setStep("camera");
    await loadFaceApiModels();
    await startCamera();
  };

  // Run Strict Face Recognition Algorithm
  const handleVerifyFace = async () => {
    if (!videoRef.current || !activeEmployee) return;

    try {
      setIsProcessingFace(true);
      setProcessingStatusText("Initializing AI Face Recognition Neural Networks...");

      const faceapi = await loadFaceApiModels();
      const video = videoRef.current;

      // 1. Snapshot live frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize video canvas.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const capturedDataUrl = canvas.toDataURL("image/jpeg", 0.9);

      setProcessingStatusText("Scanning live camera frame for single face biometric...");

      // 2. Strict Detection on Live Frame: Must detect EXACTLY 1 face
      const liveDetections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (liveDetections.length === 0) {
        setProcessingStatusText("");
        setIsProcessingFace(false);
        alert("SECURITY REJECTED: No face detected in camera frame! Please look directly into the camera.");
        return;
      }

      if (liveDetections.length > 1) {
        setProcessingStatusText("");
        setIsProcessingFace(false);
        alert(
          `SECURITY ALERT: Multiple faces (${liveDetections.length}) detected in camera! Strict security allows only ONE person.`
        );
        return;
      }

      const liveDescriptor = liveDetections[0].descriptor;

      // 3. Extract Face Descriptor from Registered Employee Portrait
      setProcessingStatusText(`Comparing live face with ${activeEmployee.name}'s biometric profile...`);

      const refImg = await faceapi.fetchImage(activeEmployee.photoUrl || DEFAULT_AVATAR);
      let refDetection = await faceapi
        .detectSingleFace(
          refImg,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!refDetection) {
        refDetection = await faceapi
          .detectSingleFace(refImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (!refDetection) {
        setProcessingStatusText("");
        setIsProcessingFace(false);
        alert(
          `Registered photo for ${activeEmployee.name} does not contain a clear face. Please update employee portrait in Employees page.`
        );
        return;
      }

      // 4. Compute Euclidean Distance (Strict threshold <= 0.45)
      const distance = faceapi.euclideanDistance(liveDescriptor, refDetection.descriptor);
      const strictThreshold = 0.45;
      const isMatched = distance <= strictThreshold;
      const similarityPercentage = Math.round(
        Math.min(100, Math.max(0, (1 - distance / 0.65) * 100))
      );

      stopCamera();

      setFaceMatchResult({
        matched: isMatched,
        distance: Math.round(distance * 1000) / 1000,
        similarity: similarityPercentage,
        message: isMatched
          ? `Biometric Match Verified! (${similarityPercentage}% Confidence Score)`
          : `Face Mismatch Detected (${similarityPercentage}% Similarity). Access Denied.`,
        capturedImage: capturedDataUrl,
      });

      setStep("result");

      // 5. Save attendance record if matched
      if (isMatched && deviceCoords && targetCoords && distanceMeters !== null) {
        setProcessingStatusText("Saving verified attendance log...");

        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const currentHours = now.getHours();
        const statusVal: "Present" | "Late" = currentHours >= 10 ? "Late" : "Present";

        await addDoc(collection(db, "employee_attendance"), {
          employeeId: activeEmployee.id,
          employeeName: activeEmployee.name,
          employeeMobile: activeEmployee.mobile,
          wageType: activeEmployee.wageType,
          salary: activeEmployee.salary,
          date: selectedDate,
          time: timeStr,
          status: statusVal,
          deviceLocation: {
            latitude: deviceCoords.lat,
            longitude: deviceCoords.lng,
          },
          targetLocation: {
            latitude: targetCoords.lat,
            longitude: targetCoords.lng,
            label: targetCoords.label,
          },
          distanceMeters: distanceMeters,
          faceMatchScore: similarityPercentage,
          faceDistance: Math.round(distance * 1000) / 1000,
          liveCapturePhotoUrl: capturedDataUrl,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error("Face recognition error:", err);
      alert(`Face recognition error: ${err.message}`);
    } finally {
      setIsProcessingFace(false);
      setProcessingStatusText("");
    }
  };

  // Filtered roster data
  const rosterData = useMemo(() => {
    return employees.map((emp) => {
      const record = attendanceList.find((a) => a.employeeId === emp.id);
      return {
        emp,
        record: record || null,
        isPresent: !!record,
      };
    });
  }, [employees, attendanceList]);

  const filteredRoster = useMemo(() => {
    return rosterData.filter(({ emp, isPresent }) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesMobile = emp.mobile.includes(q);
        const matchesCity = emp.city.toLowerCase().includes(q);
        if (!matchesName && !matchesMobile && !matchesCity) return false;
      }

      if (statusFilter === "present" && !isPresent) return false;
      if (statusFilter === "absent" && isPresent) return false;

      if (wageFilter !== "all" && emp.wageType !== wageFilter) return false;

      return true;
    });
  }, [rosterData, searchQuery, statusFilter, wageFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const presentCount = attendanceList.length;
    const absentCount = Math.max(0, total - presentCount);
    const presentRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    const todayDailyWageCost = attendanceList
      .filter((a) => a.wageType === "daily")
      .reduce((sum, a) => sum + (a.salary || 0), 0);

    return {
      total,
      presentCount,
      absentCount,
      presentRate,
      todayDailyWageCost,
    };
  }, [employees, attendanceList]);

  // Date controls
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDateKey(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDateKey(d));
  };

  const isToday = selectedDate === formatDateKey(new Date());

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header - Matching compact design */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 text-white shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <span>Employee Daily Attendance</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Strict Security
                </span>
              </h1>
              <p className="text-xs text-neutral-500">
                GPS Geofence (50m radius) & AI Facial Biometric verification engine
              </p>
            </div>
          </div>

          {/* Date Picker Bar */}
          <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-lg p-1 shadow-2xs self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1 text-neutral-600 hover:text-neutral-900 rounded hover:bg-neutral-100 cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <CalendarIcon className="w-3.5 h-3.5 text-neutral-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold text-neutral-800 bg-transparent outline-none cursor-pointer"
              />
              {isToday && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Today
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1 text-neutral-600 hover:text-neutral-900 rounded hover:bg-neutral-100 cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Compact Metric Cards - Matching Stores & Store-Stock */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">Workforce roster</div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Present Today</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-emerald-700 font-mono">
              {stats.presentCount} <span className="text-xs font-normal text-neutral-500 font-sans">punched in</span>
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-600 font-medium truncate">
              {stats.presentRate}% attendance rate
            </div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Absent / Pending</span>
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-rose-700 font-mono">
              {stats.absentCount} <span className="text-xs font-normal text-neutral-500 font-sans">staff</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">Pending verification</div>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Daily Wage Cost</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Clock className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold text-neutral-900 font-mono">
              ₹{stats.todayDailyWageCost.toLocaleString("en-IN")}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500 truncate">Daily workers present</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search employee by name, mobile, or city..."
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-neutral-50 text-xs font-medium text-neutral-700 px-2.5 py-1.5 rounded-lg border border-neutral-300 outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="present">Present Only</option>
              <option value="absent">Absent / Not Marked</option>
            </select>

            <select
              value={wageFilter}
              onChange={(e) => setWageFilter(e.target.value as any)}
              className="bg-neutral-50 text-xs font-medium text-neutral-700 px-2.5 py-1.5 rounded-lg border border-neutral-300 outline-none cursor-pointer"
            >
              <option value="all">All Wages</option>
              <option value="monthly">Monthly Salary</option>
              <option value="daily">Daily Wage</option>
            </select>
          </div>
        </div>

        {/* Attendance Roster Table */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-2xs overflow-hidden">
          <div className="p-3.5 px-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <span className="text-xs font-bold text-neutral-900">
              Staff Daily Roster ({filteredRoster.length})
            </span>
            <span className="text-[11px] text-neutral-500">
              Date: <strong>{selectedDate}</strong>
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-700 mx-auto mb-2" />
              <p className="text-xs text-neutral-500 font-medium">Loading attendance data...</p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-800">No Employees Found</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                No employee records match the selected date or search filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Wage Type</th>
                    <th className="py-2.5 px-4">Work Location</th>
                    <th className="py-2.5 px-4">Today&apos;s Status</th>
                    <th className="py-2.5 px-4">Punch Time & Security</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-xs">
                  {filteredRoster.map(({ emp, record, isPresent }) => {
                    const target = resolveTargetLocation(emp);

                    return (
                      <tr key={emp.id} className="hover:bg-neutral-50/60 transition-colors">
                        {/* Employee Name + Photo */}
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
                              <span className="text-[10px] text-neutral-500 block font-mono">
                                {emp.mobile}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Wage Type */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              emp.wageType === "monthly"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {emp.wageType === "monthly"
                              ? `Monthly: ₹${emp.salary.toLocaleString("en-IN")}`
                              : `Daily: ₹${emp.salary.toLocaleString("en-IN")}/day`}
                          </span>
                        </td>

                        {/* Work Location */}
                        <td className="py-2.5 px-4 max-w-xs">
                          <div className="flex items-center gap-1 font-semibold text-neutral-800">
                            <Store className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate">{target.label}</span>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${target.lat},${target.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline font-mono inline-flex items-center gap-0.5 mt-0.5"
                          >
                            <Navigation className="w-2.5 h-2.5" />
                            <span>
                              {target.lat.toFixed(4)}, {target.lng.toFixed(4)}
                            </span>
                          </a>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-4">
                          {isPresent ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                record?.status === "Late"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{record?.status || "Present"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                              <Clock className="w-3 h-3 text-neutral-400" />
                              <span>Not Marked</span>
                            </span>
                          )}
                        </td>

                        {/* Punch Time & Security Stats */}
                        <td className="py-2.5 px-4">
                          {record ? (
                            <div className="space-y-0.5">
                              <div className="font-mono font-bold text-neutral-900 flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-neutral-400" />
                                <span>{record.time}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-emerald-700 font-bold">
                                  GPS: {record.distanceMeters}m away
                                </span>
                                <span>•</span>
                                <span className="text-blue-700 font-bold">
                                  Face: {record.faceMatchScore}% match
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-4 text-right">
                          {isPresent && record ? (
                            <button
                              type="button"
                              onClick={() => setViewingRecord(record)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-200 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Slip</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartAttendance(emp)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs cursor-pointer transition-colors"
                            >
                              <ScanFace className="w-3.5 h-3.5 text-amber-400" />
                              <span>Mark Attendance</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ==================== STRICT VERIFICATION MODAL ==================== */}
        {activeEmployee && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col my-6 max-h-[92vh]">
              {/* Modal Top Bar */}
              <div className="p-3.5 px-5 border-b border-neutral-100 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold">
                    Biometric Verification — {activeEmployee.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setActiveEmployee(null);
                  }}
                  className="text-neutral-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Security Steps Indicator */}
              <div className="bg-neutral-100 p-2.5 px-5 border-b border-neutral-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex items-center gap-1.5 font-bold ${
                      gpsPassed
                        ? "text-emerald-700"
                        : step === "gps"
                        ? "text-neutral-900"
                        : "text-neutral-400"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        gpsPassed
                          ? "bg-emerald-600 text-white"
                          : step === "gps"
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {gpsPassed ? "✓" : "1"}
                    </span>
                    <span>GPS 50m Radius</span>
                  </div>

                  <span className="text-neutral-300">→</span>

                  <div
                    className={`flex items-center gap-1.5 font-bold ${
                      step === "camera"
                        ? "text-neutral-900"
                        : step === "result"
                        ? "text-emerald-700"
                        : "text-neutral-400"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step === "camera"
                          ? "bg-neutral-900 text-white"
                          : step === "result"
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      2
                    </span>
                    <span>AI Face Recognition</span>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-neutral-500">
                  Strict Security Engine
                </span>
              </div>

              {/* Modal Body Content */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* STEP 1: GPS GEOFENCE CHECK */}
                {step === "gps" && (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-neutral-700" />
                          <span className="font-bold text-neutral-900">
                            Target Work Location
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono">
                          Limit: 50 Meters
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-600 space-y-1">
                        <div>
                          <strong>Premises:</strong> {targetCoords?.label}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-500">
                          Target GPS: {targetCoords?.lat.toFixed(6)}, {targetCoords?.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border text-center space-y-2 transition-all ${
                        isVerifyingGps
                          ? "bg-neutral-50 border-neutral-200"
                          : gpsPassed === true
                          ? "bg-emerald-50 border-emerald-300"
                          : gpsPassed === false
                          ? "bg-rose-50 border-rose-300"
                          : "bg-neutral-50 border-neutral-200"
                      }`}
                    >
                      {isVerifyingGps ? (
                        <div className="py-4 space-y-2">
                          <Loader2 className="w-7 h-7 animate-spin text-neutral-900 mx-auto" />
                          <p className="font-bold text-neutral-800">
                            Detecting Device GPS Location...
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Acquiring satellite coordinates with high accuracy
                          </p>
                        </div>
                      ) : gpsPassed === true ? (
                        <div className="space-y-1.5">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-emerald-900">
                            Location Verified (Within 50m Radius)
                          </h4>
                          <p className="text-xs text-emerald-800">
                            You are <strong>{distanceMeters} meters</strong> away from the work location.
                          </p>
                          {deviceCoords && (
                            <div className="text-[10px] font-mono text-emerald-700 pt-1">
                              Device GPS: {deviceCoords.lat.toFixed(6)}, {deviceCoords.lng.toFixed(6)}
                            </div>
                          )}
                        </div>
                      ) : gpsPassed === false ? (
                        <div className="space-y-1.5">
                          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-rose-900">
                            Geofence Security Check Failed!
                          </h4>
                          <p className="text-xs text-rose-800 max-w-sm mx-auto">
                            {gpsError ||
                              `You are ${distanceMeters} meters away. Attendance can ONLY be marked within 50 meters of the work premises.`}
                          </p>
                          <div className="pt-2 flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => targetCoords && executeGpsCheck(targetCoords)}
                              className="px-3 py-1.5 bg-rose-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              Retry GPS Check
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveEmployee(null)}
                        className="px-3.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>

                      {gpsPassed && (
                        <button
                          type="button"
                          onClick={handleProceedToCamera}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Proceed to AI Face Scan</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2: AI FACE RECOGNITION */}
                {step === "camera" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
                      <div className="flex items-center gap-2">
                        <img
                          src={activeEmployee.photoUrl || DEFAULT_AVATAR}
                          alt={activeEmployee.name}
                          className="w-10 h-10 rounded-lg object-cover border border-neutral-300"
                        />
                        <div>
                          <span className="text-xs font-bold text-neutral-900 block">
                            Target: {activeEmployee.name}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Registered portrait will be matched with live camera
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        GPS Passed: {distanceMeters}m
                      </span>
                    </div>

                    {modelsLoading && (
                      <div className="p-3 bg-neutral-100 rounded-lg text-xs flex items-center gap-2 text-neutral-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading neural network models...</span>
                      </div>
                    )}

                    {cameraError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    )}

                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center border-2 border-neutral-800 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-white/40 rounded-2xl flex items-center justify-center">
                        <div className="w-32 h-40 border-2 border-emerald-400 rounded-xl relative shadow-lg">
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-[9px] font-bold text-emerald-400 rounded">
                            Align Face Here
                          </span>
                        </div>
                      </div>

                      {isProcessingFace && (
                        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-4 text-white text-center space-y-2 z-10">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
                          <div className="text-xs font-bold text-amber-300">
                            {processingStatusText || "Processing Biometrics..."}
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            Checking facial landmarks & 128-d descriptor vector
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          setStep("gps");
                        }}
                        className="px-3.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                      >
                        Back to GPS
                      </button>

                      <button
                        type="button"
                        disabled={isProcessingFace}
                        onClick={handleVerifyFace}
                        className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 text-amber-400" />
                        <span>Scan & Verify Face</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: RESULT REVIEW */}
                {step === "result" && faceMatchResult && (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border text-center space-y-2 ${
                        faceMatchResult.matched
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-rose-50 border-rose-300"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${
                          faceMatchResult.matched
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {faceMatchResult.matched ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <ShieldAlert className="w-6 h-6" />
                        )}
                      </div>

                      <h4
                        className={`text-sm font-bold ${
                          faceMatchResult.matched ? "text-emerald-900" : "text-rose-900"
                        }`}
                      >
                        {faceMatchResult.matched
                          ? "Biometric Identity Confirmed & Attendance Marked!"
                          : "Biometric Identity Mismatch — Attendance Denied"}
                      </h4>

                      <p
                        className={`text-xs ${
                          faceMatchResult.matched ? "text-emerald-800" : "text-rose-800"
                        }`}
                      >
                        {faceMatchResult.message}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                          Registered Portrait
                        </span>
                        <img
                          src={activeEmployee.photoUrl || DEFAULT_AVATAR}
                          alt="Registered"
                          className="w-20 h-20 rounded-xl object-cover mx-auto border border-neutral-300 shadow-2xs"
                        />
                        <span className="text-[10px] text-neutral-600 block truncate font-medium">
                          {activeEmployee.name}
                        </span>
                      </div>

                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                          Live Camera Snapshot
                        </span>
                        <img
                          src={faceMatchResult.capturedImage}
                          alt="Live Capture"
                          className="w-20 h-20 rounded-xl object-cover mx-auto border border-neutral-300 shadow-2xs"
                        />
                        <span className="text-[10px] font-mono text-neutral-600 block">
                          Distance: {faceMatchResult.distance}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-100 rounded-lg space-y-1.5 text-[11px] text-neutral-700">
                      <div className="flex justify-between">
                        <span>GPS Location Check:</span>
                        <span className="font-bold text-emerald-700">
                          Passed ({distanceMeters}m from work premises)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Facial Match Confidence:</span>
                        <span
                          className={`font-bold ${
                            faceMatchResult.matched ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {faceMatchResult.similarity}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Euclidean Descriptor Distance:</span>
                        <span className="font-mono font-bold">
                          {faceMatchResult.distance} (Limit &le; 0.45)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveEmployee(null);
                        }}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== AUDIT SLIP MODAL ==================== */}
        {viewingRecord && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
              <div className="p-3.5 px-4 border-b border-neutral-100 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold">Attendance Security Audit Slip</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="text-neutral-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs overflow-y-auto">
                <div className="text-center space-y-1 pb-2 border-b border-neutral-100">
                  <img
                    src={viewingRecord.liveCapturePhotoUrl || DEFAULT_AVATAR}
                    alt={viewingRecord.employeeName}
                    className="w-16 h-16 rounded-xl object-cover mx-auto border border-neutral-300 shadow-xs"
                  />
                  <h4 className="text-sm font-bold text-neutral-900 mt-1">
                    {viewingRecord.employeeName}
                  </h4>
                  <div className="text-[10px] font-mono text-neutral-500">
                    {viewingRecord.employeeMobile}
                  </div>
                  <div className="pt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Verified Present ({viewingRecord.status})
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-neutral-700">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Date & Time:</span>
                    <span className="font-mono font-bold">
                      {viewingRecord.date} at {viewingRecord.time}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-500">Wage Structure:</span>
                    <span className="font-semibold">
                      {viewingRecord.wageType === "monthly" ? "Monthly Wage" : "Daily Wage"}{" "}
                      (₹{viewingRecord.salary})
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-500">GPS Geofence:</span>
                    <span className="font-bold text-emerald-700">
                      {viewingRecord.distanceMeters}m from target (Pass &le; 50m)
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-500">Face Match Score:</span>
                    <span className="font-bold text-blue-700">
                      {viewingRecord.faceMatchScore}% Confidence (Distance: {viewingRecord.faceDistance})
                    </span>
                  </div>

                  <div className="pt-1 border-t border-neutral-100">
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-0.5">
                      GPS Coordinates
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${viewingRecord.deviceLocation.latitude},${viewingRecord.deviceLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-[10px] inline-flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>
                        {viewingRecord.deviceLocation.latitude.toFixed(6)},{" "}
                        {viewingRecord.deviceLocation.longitude.toFixed(6)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  className="px-3.5 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
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
