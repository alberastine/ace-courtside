import React, { useState, useEffect } from "react";
import { 
  Court, 
  Reservation, 
  ReservationStatus, 
  AppSettings, 
  EmailLog, 
  AdminActivityLog,
  OperatingHour
} from "./types";
import AdminPanel from "./components/AdminPanel";
import BookingForm from "./components/BookingForm";
import { handleMockRequest } from "./utils/mockDb";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  User, 
  Sliders, 
  Users, 
  Info, 
  Compass, 
  History, 
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Moon,
  Sun,
  X
} from "lucide-react";

export function getPHDateTime() {
  try {
    const d = new Date();
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hour12: false,
    }).formatToParts(d);

    let year = "";
    let month = "";
    let day = "";
    let hour = 0;

    for (const part of dateParts) {
      if (part.type === "year") year = part.value;
      else if (part.type === "month") month = part.value;
      else if (part.type === "day") day = part.value;
      else if (part.type === "hour") hour = parseInt(part.value, 10);
    }

    if (year && month && day) {
      return {
        dateStr: `${year}-${month}-${day}`,
        hour,
      };
    }
  } catch (err) {
    console.error("Error formatting PH time:", err);
  }

  // Fallback to local system time if formatting fails
  const local = new Date();
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    hour: local.getHours(),
  };
}

export function getPHDayOfWeekFromDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[d.getDay()];
}

export function getRecurringDates(startDateStr: string, endDateStr: string, recurringDays: string[]): string[] {
  const datesToBook: string[] = [];
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const temp = new Date(start);
    while (temp <= end) {
      const yyyy = temp.getFullYear();
      const mm = String(temp.getMonth() + 1).padStart(2, "0");
      const dd = String(temp.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = getPHDayOfWeekFromDateString(dateStr);
      if (recurringDays.includes(dayName)) {
        datesToBook.push(dateStr);
      }
      temp.setDate(temp.getDate() + 1);
    }
  } catch (err) {
    console.error("Error calculating recurring dates:", err);
  }
  return datesToBook;
}

export function reservationOccupiesOnDate(r: Reservation, dateStr: string, hour: number, allowPendingRecurring: boolean = false): boolean {
  if (r.status === ReservationStatus.CANCELLED) {
    return false;
  }

  let dateMatches = false;
  if (r.isRecurring) {
    // A recurring reservation only reflects/occupies slots once approved (BOOKED)
    if (!allowPendingRecurring && r.status !== ReservationStatus.BOOKED) {
      return false;
    }
    // Check if the date falls within the recurring range
    if (r.recurringStartDate && r.recurringEndDate && r.recurringDays) {
      if (dateStr >= r.recurringStartDate && dateStr <= r.recurringEndDate) {
        const dayName = getPHDayOfWeekFromDateString(dateStr);
        if (r.recurringDays.includes(dayName)) {
          dateMatches = true;
        }
      }
    }
  } else {
    // Standard reservation
    dateMatches = (r.date === dateStr);
  }

  if (!dateMatches) return false;

  return hour >= r.startTime && hour < r.endTime;
}

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft("Expired");
        if (onExpire) onExpire();
        return;
      }
      const minutes = Math.floor(difference / 1000 / 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft(`${minutes}m ${seconds}s left`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1.5 w-fit">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
      <span>{timeLeft}</span>
    </span>
  );
}

export default function App() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // View States
  const [currentView, setCurrentView] = useState<"scheduler" | "checkout" | "admin">("scheduler");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  // Scheduler Form States
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [bookingMode, setBookingMode] = useState<"single" | "recurring">("single");
  
  // Selection of court & times
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<number[]>([]); // Hour slots in 24h format (e.g. [9, 10] for 9-11 AM)

  // Tracker / History View States
  const [trackerEmail, setTrackerEmail] = useState("");
  const [trackerResults, setTrackerResults] = useState<Reservation[] | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);

  // Recurring Booking Form States
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [recurringStartDate, setRecurringStartDate] = useState("");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [recurringStartTime, setRecurringStartTime] = useState<number>(9);
  const [recurringEndTime, setRecurringEndTime] = useState<number>(11);

  // Booking Complete Success modal
  const [justSubmittedReservations, setJustSubmittedReservations] = useState<Reservation[] | null>(null);
  const [isCopyRefSuccess, setIsCopyRefSuccess] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const [isStaticDeployment, setIsStaticDeployment] = useState(false);

  const callApi = async (url: string, method: string = "GET", body?: any): Promise<any> => {
    if (isStaticDeployment) {
      try {
        return handleMockRequest(url, method, body);
      } catch (mockErr: any) {
        throw new Error(mockErr.message || "An error occurred in mock backend.");
      }
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      };
      
      const res = await fetch(url, fetchOptions);
      
      const contentType = res.headers.get("content-type");
      if (res.status === 404 || (contentType && contentType.includes("text/html"))) {
        console.warn(`Express API route ${url} not found (Status ${res.status}). Falling back to client-side localStorage.`);
        setIsStaticDeployment(true);
        return handleMockRequest(url, method, body);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (
        err.message && 
        (err.message.includes("Failed to fetch") || 
         err.message.includes("NetworkError") || 
         err.message.includes("Unexpected token") || 
         err.message.includes("status 404") ||
         err.message.includes("404"))
      ) {
        console.warn("API connection failed, falling back to client-side localStorage:", err);
        setIsStaticDeployment(true);
        return handleMockRequest(url, method, body);
      }
      throw err;
    }
  };

  // Fetch initial API state
  const fetchState = async () => {
    try {
      const data = await callApi("/api/state", "GET");
      setCourts(data.courts || []);
      setReservations(data.reservations || []);
      setSettings(data.settings || null);
      setEmailLogs(data.emailLogs || []);
      setActivityLogs(data.activityLogs || []);
    } catch (err) {
      console.error("Error fetching operational state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Default selectedDate to Today (PH time, using standard format)
    const phToday = getPHDateTime().dateStr;
    setSelectedDate(phToday);

    // Default dates for recurring form
    const tomorrowStr = new Date();
    tomorrowStr.setDate(tomorrowStr.getDate() + 1);
    setRecurringStartDate(tomorrowStr.toISOString().split("T")[0]);

    const endStr = new Date();
    endStr.setMonth(endStr.getMonth() + 2); // 2 months
    setRecurringEndDate(endStr.toISOString().split("T")[0]);

    fetchState();

    // Setup an automated background poll every 15s to verify live conflict state
    const interval = setInterval(fetchState, 15000);
    return () => clearInterval(interval);
  }, [isStaticDeployment]);

  // Sync / Action Helpers
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    try {
      await callApi("/api/admin/settings", "POST", newSettings);
      await fetchState();
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    }
  };

  const handleSaveCourt = async (courtData: Court) => {
    try {
      await callApi("/api/admin/courts", "POST", courtData);
      await fetchState();
    } catch (err: any) {
      alert("Failed to save court: " + err.message);
    }
  };

  const handleReservationAction = async (id: string, action: "APPROVE" | "REJECT" | "CHECKIN", rejectReason?: string) => {
    try {
      await callApi(`/api/admin/reservations/${id}/action`, "POST", { action, rejectReason });
      await fetchState();
      if (trackerEmail) {
        handleTrackBookings();
      }
    } catch (err: any) {
      alert("Action failed: " + err.message);
    }
  };

  const handleResetData = async () => {
    try {
      await callApi("/api/admin/reset", "POST");
      setSelectedCourtId(null);
      setSelectedTimeSlots([]);
      await fetchState();
    } catch (err: any) {
      alert("Reset failed: " + err.message);
    }
  };

  // Submit Booking Form
  const handleSubmitBooking = async (formData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    appliedDiscount?: string;
  }) => {
    const isRec = bookingMode === "recurring";
    
    // Validate past dates and past times of the day
    const ph = getPHDateTime();
    if (!isRec) {
      if (selectedDate < ph.dateStr) {
        throw new Error("You cannot book a past date.");
      }
      if (selectedTimeSlots.length === 0) {
        throw new Error("Please select at least one time slot.");
      }
      const minHour = Math.min(...selectedTimeSlots);
      if (selectedDate === ph.dateStr && minHour < ph.hour) {
        throw new Error("You cannot book past the current time of the day.");
      }
    } else {
      if (!recurringStartDate || !recurringEndDate) {
        throw new Error("Please specify both a start date and end date.");
      }
      if (recurringStartDate < ph.dateStr) {
        throw new Error("Recurring start date cannot be in the past.");
      }
      if (recurringEndDate < recurringStartDate) {
        throw new Error("Recurring end date cannot be before the start date.");
      }
      if (recurringDays.length === 0) {
        throw new Error("Please select at least one day of the week.");
      }
    }

    const payload = {
      courtId: selectedCourtId,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      date: selectedDate,
      startTime: isRec ? recurringStartTime : Math.min(...selectedTimeSlots),
      endTime: isRec ? recurringEndTime : Math.max(...selectedTimeSlots) + 1,
      isRecurring: isRec,
      recurringDays: isRec ? recurringDays : undefined,
      recurringStartDate: isRec ? recurringStartDate : undefined,
      recurringEndDate: isRec ? recurringEndDate : undefined,
    };

    try {
      const data = await callApi("/api/book", "POST", payload);
      // Success
      setJustSubmittedReservations(data.reservations);
      setTrackerEmail(formData.customerEmail); // Pre-fill tracker email for lookup
      setSelectedCourtId(null);
      setSelectedTimeSlots([]);
      await fetchState();
      setCurrentView("scheduler");
    } catch (err: any) {
      throw new Error(err.message || "Overlapping schedule conflict.");
    }
  };

  // Tracking Bookings for Customers
  const handleTrackBookings = () => {
    if (!trackerEmail.trim()) {
      alert("Please enter your email to lookup booking schedules.");
      return;
    }
    const filtered = reservations.filter(
      (r) => r.customerEmail.toLowerCase().trim() === trackerEmail.toLowerCase().trim()
    );
    setTrackerResults(filtered);
  };

  // Operating Hours and Availability Math
  const hourRows = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 AM to 10:00 PM, 17 hours

  const formatHour = (h: number): string => {
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  // Date navigation helpers
  const shiftDate = (days: number) => {
    if (!selectedDate) return;
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const todayStr = getPHDateTime().dateStr;
    const newDateStr = current.toISOString().split("T")[0];
    if (newDateStr < todayStr) return; // Prevent past dates
    setSelectedDate(newDateStr);
    setSelectedTimeSlots([]);
  };

  // Cell clicking strategy for selecting continuous court slots
  const handleCellClick = (courtId: string, hour: number) => {
    // Prevent booking past dates or past times of the day
    const ph = getPHDateTime();
    if (selectedDate < ph.dateStr) return;
    if (selectedDate === ph.dateStr && hour < ph.hour) return;

    // 1. If another court is selected, reset slots and select new court
    if (selectedCourtId !== courtId) {
      setSelectedCourtId(courtId);
      setSelectedTimeSlots([hour]);
      return;
    }

    // 2. Already selected court. If clicked a slot that is already in timeSlots
    if (selectedTimeSlots.includes(hour)) {
      // Toggle it. If it was the only one, clear selection.
      if (selectedTimeSlots.length === 1) {
        setSelectedCourtId(null);
        setSelectedTimeSlots([]);
      } else {
        // Find if removing keeps a continuous block. If not, just select the single slot.
        setSelectedTimeSlots([hour]);
      }
      return;
    }

    // 3. Adding a new slot
    const newSlots = [...selectedTimeSlots, hour].sort((a, b) => a - b);
    
    // Check if new range is contiguous
    const min = newSlots[0];
    const max = newSlots[newSlots.length - 1];
    const continuous: number[] = [];
    for (let h = min; h <= max; h++) {
      continuous.push(h);
    }

    // Verify no reservation conflict in this continuous range on this date
    const hasConflict = continuous.some((slotHour) => {
      return reservations.some((resv) => {
        if (resv.courtId !== courtId) return false;
        return reservationOccupiesOnDate(resv, selectedDate, slotHour);
      });
    });

    if (hasConflict) {
      // If expanding creates overlap, just select the single slot that was clicked instead of contiguous range
      setSelectedTimeSlots([hour]);
    } else {
      setSelectedTimeSlots(continuous);
    }
  };

  // Helper to determine status color of a cell
  const getCellStatus = (courtId: string, hour: number) => {
    // Check if cell is in the past
    const ph = getPHDateTime();
    if (selectedDate < ph.dateStr || (selectedDate === ph.dateStr && hour < ph.hour)) {
      return "past";
    }

    // 1. Check if user currently selecting it
    if (selectedCourtId === courtId && selectedTimeSlots.includes(hour)) {
      return "selected";
    }

    // 2. Check if court is disabled
    const court = courts.find((c) => c.id === courtId);
    if (!court || !court.enabled) return "disabled";

    // 3. Find if there's an active booking for this date, court, and hour
    const booking = reservations.find((r) => {
      if (r.courtId !== courtId) return false;
      return reservationOccupiesOnDate(r, selectedDate, hour);
    });

    if (booking) {
      if (booking.status === ReservationStatus.PENDING) {
        return "pending";
      } else if (booking.status === ReservationStatus.BOOKED) {
        return "booked";
      }
    }

    return "available";
  };

  // Booking cut-off checks
  const isOnlineBookingOpen = () => {
    if (!settings) return true;
    try {
      // Get current local time and extract hours
      const now = new Date();
      const currentHour = now.getHours();

      // settings.bookingCutoffStart like "6:00 AM", settings.bookingCutoffEnd like "9:00 PM"
      const matchStart = settings.bookingCutoffStart.match(/^(\d+):00\s+(AM|PM)$/i);
      const matchEnd = settings.bookingCutoffEnd.match(/^(\d+):00\s+(AM|PM)$/i);

      if (matchStart && matchEnd) {
        let startHour = parseInt(matchStart[1]);
        if (matchStart[2].toUpperCase() === "PM" && startHour !== 12) startHour += 12;
        if (matchStart[2].toUpperCase() === "AM" && startHour === 12) startHour = 0;

        let endHour = parseInt(matchEnd[1]);
        if (matchEnd[2].toUpperCase() === "PM" && endHour !== 12) endHour += 12;
        if (matchEnd[2].toUpperCase() === "AM" && endHour === 12) endHour = 0;

        return currentHour >= startHour && currentHour < endHour;
      }
    } catch (e) {
      console.error(e);
    }
    return true;
  };

  const bookingOpen = isOnlineBookingOpen();

  // Floating Toast variables
  const selectedCourt = courts.find((c) => c.id === selectedCourtId);
  const selectedDuration = selectedTimeSlots.length;
  const selectedTotalPrice = selectedCourt ? selectedCourt.pricePerHour * selectedDuration : 0;
  const selectedTimeStartStr = selectedTimeSlots.length ? formatHour(Math.min(...selectedTimeSlots)) : "";
  const selectedTimeEndStr = selectedTimeSlots.length ? formatHour(Math.max(...selectedTimeSlots) + 1) : "";

  // Dynamic notification count for admin badge
  const pendingCount = reservations.filter(r => r.status === ReservationStatus.PENDING).length;

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-display font-semibold text-slate-800">Booting Ace Courtside Scheduling Server...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-250 ${themeMode === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"} font-sans`}>
      
      {/* 1. HEADER SECTION (Elegant, matching image) */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Facility Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-lime-400 font-display font-black text-xl rounded-xl flex items-center justify-center shadow-xs">
              ACP
            </div>
            <div>
              <h1 id="app-main-title" className="font-display font-bold text-slate-900 text-lg leading-tight flex items-center gap-2">
                <span>{settings.gymName}</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">Live Server</span>
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                <MapPin size={12} className="text-slate-400" />
                <span>{settings.gymLocation}</span>
                <span className="text-slate-300">|</span>
                <Users size={12} className="text-slate-400" />
                <span>{courts.length} courts available</span>
              </div>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2.5">
            
            {/* View Booking Tracker */}
            <button
              id="nav-tracker-btn"
              onClick={() => {
                setIsTrackerOpen(true);
                setTrackerResults(null);
                setTrackerEmail("");
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
            >
              <History size={14} />
              <span>Track My Bookings</span>
            </button>

            {/* Admin control tab */}
            <button
              id="nav-admin-toggle"
              onClick={() => setCurrentView(currentView === "admin" ? "scheduler" : "admin")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${
                currentView === "admin" 
                  ? "bg-slate-900 text-white border-slate-900" 
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Sliders size={14} />
              <span>Admin Control</span>
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Theme Toggle (Aesthetics) */}
            <button
              onClick={() => {
                alert("This applet is tailored with a high-contrast pristine white visual theme for optimal readability on courts. Dark accents are integrated dynamically.");
              }}
              className="p-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-all"
              title="Aesthetic Theme Mode"
            >
              <Sun size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Booking Hours Cut-Off Alert banner */}
      {!bookingOpen && currentView !== "admin" && (
        <div className="bg-red-500 text-white text-xs font-semibold py-2.5 px-4 text-center flex items-center justify-center gap-2">
          <AlertTriangle size={15} />
          <span>Online bookings are disabled. We only accept reservations between {settings.bookingCutoffStart} and {settings.bookingCutoffEnd}. Come down to the facility in person!</span>
        </div>
      )}

      {/* 2. ADMIN PORTAL WRAPPER */}
      {currentView === "admin" ? (
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-4">
            <button 
              onClick={() => setCurrentView("scheduler")}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              ← Back to Client Booking Grid
            </button>
          </div>
          <AdminPanel 
            courts={courts}
            reservations={reservations}
            settings={settings}
            emailLogs={emailLogs}
            activityLogs={activityLogs}
            onRefresh={fetchState}
            onUpdateSettings={handleUpdateSettings}
            onSaveCourt={handleSaveCourt}
            onReservationAction={handleReservationAction}
            onResetData={handleResetData}
          />
        </main>
      ) : currentView === "checkout" && selectedCourtId ? (
        // 3. CHECKOUT STAGE
        <main className="max-w-7xl mx-auto px-4 py-8">
          <BookingForm 
            court={courts.find(c => c.id === selectedCourtId)!}
            selectedDate={selectedDate}
            startTime={bookingMode === "recurring" ? recurringStartTime : Math.min(...selectedTimeSlots)}
            endTime={bookingMode === "recurring" ? recurringEndTime : Math.max(...selectedTimeSlots) + 1}
            settings={settings}
            isRecurring={bookingMode === "recurring"}
            recurringDays={bookingMode === "recurring" ? recurringDays : undefined}
            recurringStartDate={bookingMode === "recurring" ? recurringStartDate : undefined}
            recurringEndDate={bookingMode === "recurring" ? recurringEndDate : undefined}
            onBack={() => {
              setCurrentView("scheduler");
            }}
            onSubmitBooking={handleSubmitBooking}
          />
        </main>
      ) : (
        // 4. MAIN CLIENT SCHEDULER & HOME GRID
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
          
          {/* Top Info Banner - Matches look in Image 1 */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-display font-bold text-slate-900 text-xl tracking-tight">Ace Courtside Pickleball Booking</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                Choose a date below to view court cell availability. Click and drag or click multiple hours on the same court to build a continuous reservation slot. 
                Our standard rate is <span className="font-bold text-slate-900">₱250.00 / hour</span>.
              </p>
            </div>
            
            {/* Quick action switches */}
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1 self-start md:self-auto">
              <button
                onClick={() => { setBookingMode("single"); setSelectedCourtId(null); setSelectedTimeSlots([]); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bookingMode === "single" ? "bg-white text-slate-950 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Book a Court
              </button>
              <button
                onClick={() => { setBookingMode("recurring"); setSelectedCourtId(null); setSelectedTimeSlots([]); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bookingMode === "recurring" ? "bg-white text-slate-950 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                🔄 Weekly Recurring
              </button>
            </div>
          </div>

          {/* DATE PICKER & CALENDAR SELECTOR */}
          {bookingMode === "single" ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <div className="flex items-center gap-1.5">
                <Calendar size={18} className="text-lime-600" />
                <span className="font-display font-bold text-slate-800 text-sm">Select Booking Date</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => shiftDate(-1)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    min={getPHDateTime().dateStr}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTimeSlots([]);
                    }}
                    className="px-3 py-1.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none text-slate-800"
                  />
                </div>

                <button 
                  onClick={() => shiftDate(1)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            // RECURRING RESERVATION CONFIG PANEL
            <div className="p-6 bg-white border border-indigo-100 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-mono text-xs font-bold">🔄 REGULAR PLAY</span>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">Configure Weekly Recurring Reservation</h3>
                  <p className="text-xs text-slate-400">Generate multiple booking slots with a single reservation & payment</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                
                {/* 1. Court & Day of Week */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Facility Court</label>
                    <select
                      value={selectedCourtId || ""}
                      onChange={(e) => setSelectedCourtId(e.target.value || null)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <option value="">-- Choose Court --</option>
                      {courts.filter(c => c.enabled).map(c => (
                        <option key={c.id} value={c.id}>{c.name} (₱{c.pricePerHour}/hr)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Days of the Week</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                        const isSel = recurringDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isSel) {
                                setRecurringDays(recurringDays.filter(d => d !== day));
                              } else {
                                setRecurringDays([...recurringDays, day]);
                              }
                            }}
                            className={`px-1 py-1 rounded text-[10px] font-bold text-center border transition-all ${
                              isSel 
                                ? "bg-indigo-600 text-white border-indigo-600" 
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            {day.substring(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Date Ranges */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Recurring Start Date</label>
                    <input
                      type="date"
                      value={recurringStartDate}
                      min={getPHDateTime().dateStr}
                      onChange={(e) => setRecurringStartDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Recurring End Date</label>
                    <input
                      type="date"
                      value={recurringEndDate}
                      min={recurringStartDate || getPHDateTime().dateStr}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                    />
                  </div>
                </div>

                {/* 3. Time Slots */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Start Hour</label>
                      <select
                        value={recurringStartTime}
                        onChange={(e) => setRecurringStartTime(parseInt(e.target.value))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                          <option key={h} value={h}>{formatHour(h)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">End Hour</label>
                      <select
                        value={recurringEndTime}
                        onChange={(e) => setRecurringEndTime(parseInt(e.target.value))}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => (
                          <option key={h} value={h} disabled={h <= recurringStartTime}>{formatHour(h)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedCourtId) {
                          setAlertModal({ title: "Court Required", message: "Please select a court first." });
                          return;
                        }
                        if (!recurringStartDate || !recurringEndDate) {
                          setAlertModal({ title: "Dates Required", message: "Please specify both a start date and end date." });
                          return;
                        }
                        if (recurringEndDate < recurringStartDate) {
                          setAlertModal({ title: "Invalid Date Range", message: "Recurring end date cannot be before the start date." });
                          return;
                        }
                        if (recurringDays.length === 0) {
                          setAlertModal({ title: "Days Required", message: "Please select at least one day of the week." });
                          return;
                        }
                        if (recurringEndTime <= recurringStartTime) {
                          setAlertModal({ title: "Invalid Time Range", message: "End time must be after start time." });
                          return;
                        }

                        // Validate past dates and past times of the day
                        const ph = getPHDateTime();
                        if (recurringStartDate < ph.dateStr) {
                          setAlertModal({ title: "Past Date", message: "Recurring start date cannot be in the past." });
                          return;
                        }

                        // Verify no reservation conflict in this continuous range on these recurring dates
                        const datesToBook = getRecurringDates(recurringStartDate, recurringEndDate, recurringDays);
                        if (datesToBook.length === 0) {
                          setAlertModal({ title: "No Dates Selected", message: "No dates match the selected days of the week in this date range." });
                          return;
                        }

                        const overlapping: { date: string; hour: number; resv: Reservation }[] = [];
                        for (const dateStr of datesToBook) {
                          for (let h = recurringStartTime; h < recurringEndTime; h++) {
                            const conflict = reservations.find((r) => {
                              if (r.courtId !== selectedCourtId) return false;
                              return reservationOccupiesOnDate(r, dateStr, h);
                            });
                            if (conflict) {
                              overlapping.push({ date: dateStr, hour: h, resv: conflict });
                            }
                          }
                        }

                        if (overlapping.length > 0) {
                          const conflictDesc = overlapping
                            .slice(0, 3)
                            .map((c) => {
                              const timeStr = `${c.hour % 12 || 12}:00 ${c.hour >= 12 ? 'PM' : 'AM'}`;
                              return `${c.date} at ${timeStr}`;
                            })
                            .join(", ");
                          const suffix = overlapping.length > 3 ? " and others" : "";
                          setAlertModal({ 
                            title: "Schedule Conflict Detected", 
                            message: `The court is already booked on ${conflictDesc}${suffix}. Please select another schedule.` 
                          });
                          return;
                        }

                        // Set fake selections to trigger the checkout flow correctly
                        const fakeSlots = [];
                        for (let h = recurringStartTime; h < recurringEndTime; h++) {
                          fakeSlots.push(h);
                        }
                        setSelectedTimeSlots(fakeSlots);
                        setCurrentView("checkout");
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Book Recurring Schedules
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 5. DYNAMIC BOOKING SCHEDULER TABLE (Mirroring mockup exactly) */}
          {bookingMode === "single" && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              
              {/* Header inside the booking card */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Clock size={16} className="text-lime-600" />
                  <span>Interactive court availability matrix</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-white border border-slate-200 rounded" />
                    <span className="text-slate-500">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-lime-500 rounded" />
                    <span className="text-slate-500">Your Selection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-amber-400 rounded" />
                    <span className="text-slate-500">Reserved (Pending)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-slate-900 rounded" />
                    <span className="text-slate-500">Booked (Approved)</span>
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/20 border-b border-slate-200">
                      {/* Empty cell for time column */}
                      <th className="p-4 text-slate-400 text-xs uppercase font-mono tracking-wider w-24 border-r border-slate-100">
                        Time Slot
                      </th>
                      {courts.filter(c => c.enabled).map((c) => (
                        <th key={c.id} className="p-4 border-r border-slate-100 last:border-r-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-lime-500" />
                            <span className="font-display font-semibold text-slate-900 text-sm sm:text-base">{c.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">{c.type}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-100">
                    {hourRows.map((hour) => {
                      const displayHourStr = formatHour(hour);
                      return (
                        <tr key={hour} className="hover:bg-slate-50/30 transition-colors">
                          {/* Time cell */}
                          <td className="p-3 text-xs font-semibold text-slate-500 bg-slate-50/10 border-r border-slate-100 font-mono text-center">
                            {displayHourStr}
                          </td>
                          
                          {/* Court columns */}
                          {courts.filter(c => c.enabled).map((c) => {
                            const status = getCellStatus(c.id, hour);
                            
                            let cellBg = "bg-white hover:bg-slate-50";
                            let cellText = "";
                            let cellContent = null;

                            if (status === "selected") {
                              cellBg = "bg-lime-500 text-slate-950 font-bold shadow-2xs cursor-pointer";
                              cellContent = (
                                <div className="text-[10px] uppercase font-bold flex items-center gap-1 justify-center py-1">
                                  <Check size={12} className="stroke-[3]" />
                                  <span>Selected</span>
                                </div>
                              );
                            } else if (status === "pending") {
                              cellBg = "bg-amber-400/20 border border-amber-300 text-amber-800 cursor-not-allowed select-none";
                              cellContent = (
                                <div className="text-[10px] font-bold text-center py-1 flex items-center justify-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                  <span>Reserved (Pending)</span>
                                </div>
                              );
                            } else if (status === "booked") {
                              cellBg = "bg-slate-900 text-slate-300 cursor-not-allowed select-none";
                              cellContent = (
                                <div className="text-[10px] font-bold text-center py-1 flex items-center justify-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                                  <span>Booked (Approved)</span>
                                </div>
                              );
                            } else if (status === "past") {
                              cellBg = "bg-slate-50 text-slate-300 cursor-not-allowed select-none bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_50%,#f8fafc_50%,#f8fafc_75%,transparent_75%,transparent)] bg-[size:12px_12px]";
                              cellContent = (
                                <div className="text-[10px] font-semibold text-center py-1 text-slate-400/80">
                                  <span>Passed</span>
                                </div>
                              );
                            } else if (status === "disabled") {
                              cellBg = "bg-slate-100 text-slate-400 cursor-not-allowed select-none bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_50%,#f1f5f9_50%,#f1f5f9_75%,transparent_75%,transparent)] bg-[size:12px_12px]";
                            } else {
                              // Available
                              cellBg = "bg-white hover:bg-lime-50/50 text-slate-400 hover:text-slate-700 cursor-pointer";
                              cellContent = (
                                <div className="text-[10px] font-medium text-center opacity-0 hover:opacity-100 py-1 transition-opacity">
                                  + Book Slot
                                </div>
                              );
                            }

                            return (
                              <td 
                                key={c.id} 
                                onClick={() => {
                                  if (status === "available" || status === "selected") {
                                    handleCellClick(c.id, hour);
                                  } else if (status === "pending" || status === "booked") {
                                    alert("This slot is already reserved. Please select an available white slot.");
                                  }
                                }}
                                className={`p-2 text-center align-middle border-r border-slate-100 last:border-r-0 transition-all ${cellBg}`}
                              >
                                {cellContent}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. BENTO CARDS: Courts Details Carousel & Facilities (Pristine, Matches Image 2) */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-slate-900 text-xl tracking-tight">Configure Our Facilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courts.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs group hover:shadow-xs transition-shadow">
                  <div className="h-48 bg-slate-100 relative overflow-hidden">
                    <img 
                      src={c.images[0] || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"} 
                      alt={c.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      {c.isIndoor && (
                        <span className="text-[10px] bg-slate-900/85 backdrop-blur-xs text-lime-400 font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          Indoor
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.enabled ? "bg-lime-500 text-slate-950" : "bg-red-500 text-white"}`}>
                        {c.enabled ? "Open" : "Maintenance"}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-semibold text-slate-950 text-base">{c.name}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{c.type}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-bold text-slate-900 text-sm block">
                          ₱{c.pricePerHour}.00/hr
                        </span>
                        <span className="text-[9px] text-lime-700 font-semibold uppercase bg-lime-50 px-1.5 py-0.5 rounded">Off-Peak Rate</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. OPERATING HOURS & LOCATION (Matches Image 3) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Operating Hours Table List */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="font-display font-bold text-slate-900 text-lg tracking-tight">Operating Hours</h3>
              <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                {settings.operatingHours.map((oh) => (
                  <div key={oh.day} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-slate-800">{oh.day}</span>
                    {oh.enabled ? (
                      <span className="text-slate-600 font-medium">{oh.open} - {oh.close}</span>
                    ) : (
                      <span className="text-red-500 font-bold uppercase tracking-wider text-xs bg-red-50 px-2 py-0.5 rounded">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Google Map Pin Box (Exactly Matches Image 3) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="font-display font-bold text-slate-900 text-lg tracking-tight">Location Map</h3>
              
              {/* Map Illustration - Gorgeous Blue mockup canvas with pin */}
              <div className="h-64 bg-sky-200/50 rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-200">
                {/* Radial rings simulation */}
                <div className="absolute w-24 h-24 rounded-full border border-sky-400 bg-sky-400/10 animate-ping opacity-75" />
                
                {/* Simulated Google Pins & Grid lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35" />
                
                {/* Center Pin */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                    <MapPin size={16} className="text-white" />
                  </div>
                  <div className="mt-1.5 px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-bold shadow-md">
                    Ace Courtside
                  </div>
                </div>

                <span className="absolute bottom-2 right-2 text-[9px] bg-white/70 backdrop-blur-xs px-1.5 py-0.5 rounded text-slate-400 font-mono">Map data ©2026</span>
              </div>

              {/* Landmark info */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <Compass className="text-slate-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{settings.gymLocation}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    <strong>Landmark:</strong> {settings.landmark}
                  </p>
                  <a 
                    href="https://maps.google.com" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-700 hover:underline mt-2.5"
                  >
                    <span>Get Directions</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* 8. FLOATING RESERVATION TOAST (Exactly like spec 5) */}
          {selectedCourtId && selectedTimeSlots.length > 0 && (
            <div id="booking-floating-toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
              <div className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl flex items-center justify-between gap-4 shadow-2xl animate-fade-in-up">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                    <p className="font-display font-extrabold text-sm text-lime-400 uppercase tracking-wider">{selectedCourt?.name}</p>
                  </div>
                  <p className="text-xs text-slate-200 mt-1">{selectedTimeStartStr} – {selectedTimeEndStr}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{selectedDuration} hrs</span>
                    <span>•</span>
                    <span className="font-bold text-slate-200">₱{selectedTotalPrice.toFixed(2)} Due</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedCourtId(null); setSelectedTimeSlots([]); }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                  <button
                    id="toast-continue-btn"
                    disabled={!bookingOpen}
                    onClick={() => {
                      if (!bookingOpen) {
                        alert("Online bookings are currently closed. Please contact us.");
                        return;
                      }
                      setCurrentView("checkout");
                    }}
                    className="px-4 py-2.5 bg-lime-400 hover:bg-lime-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Continue to Book
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      )}

      {/* FOOTER BAR */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-display font-medium text-slate-600">© 2026 Ace Courtside Pickleball. All Rights Reserved.</p>
          <p className="leading-relaxed">
            Registered Merchant QR Ph Network · Panglao, Bohol · Hotlines: {settings.contactPhone} / {settings.contactEmail}
          </p>
          <div className="pt-2">
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-mono text-[10px] font-semibold">
              Build Platform Version 1.0.4-Express
            </span>
          </div>
        </div>
      </footer>

      {/* TRACKER MODAL (Lookup Bookings) */}
      {isTrackerOpen && (
        <div id="tracker-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="tracker-modal-content" className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-slate-950 p-4 text-white flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">Inquire Booking Schedule</h3>
              <button 
                onClick={() => setIsTrackerOpen(false)}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Enter customer email used for booking</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={trackerEmail}
                    onChange={(e) => setTrackerEmail(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                  <button
                    onClick={handleTrackBookings}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {trackerResults !== null && (
                <div className="space-y-3 pt-3 border-t border-slate-100 max-h-[300px] overflow-y-auto pr-1">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Lookup Results ({trackerResults.length})</h4>
                  {trackerResults.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No bookings found for this email address.</p>
                  ) : (
                    trackerResults.map((r) => (
                      <div key={r.id} className="p-3 border border-slate-200 rounded-lg space-y-1 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                            {r.referenceNumber}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            r.status === ReservationStatus.PENDING ? "bg-orange-100 text-orange-800" :
                            r.status === ReservationStatus.BOOKED ? "bg-lime-100 text-lime-800" : "bg-red-100 text-red-800"
                          }`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          {r.courtName} · {r.isRecurring ? `🔄 Recurring (${r.recurringDays?.join(", ")}) ${r.recurringStartDate} to ${r.recurringEndDate}` : r.date}
                        </p>
                        <p className="text-[11px] text-slate-600">Time: {formatHour(r.startTime)} - {formatHour(r.endTime)} ({r.totalHours} hrs)</p>
                        <p className="text-[11px] text-slate-700 font-bold">Total Due: ₱{r.totalAmount.toFixed(2)}</p>
                        
                        {r.status === ReservationStatus.PENDING && (
                          <div className="mt-2 p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-[11px] text-orange-800 leading-relaxed space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <p className="font-bold flex items-center gap-1">⚠️ Pending GCash Transfer Required</p>
                              <CountdownTimer expiresAt={r.expiresAt} />
                            </div>
                            <p>Send ₱{r.totalAmount.toFixed(2)} to <strong>+63 912 345 6789</strong>, messaging code <strong>{r.referenceNumber}</strong>.</p>
                          </div>
                        )}

                        {r.status === ReservationStatus.BOOKED && (
                          <div className="mt-2 p-2 bg-lime-50 border border-lime-100 rounded text-[10px] text-lime-800 leading-relaxed">
                            <p className="font-semibold">✓ Booking Confirmed & Paid</p>
                            <p>Please present ID at arrival. Checked-In state: {r.checkedInAt ? `Checked in at ${new Date(r.checkedInAt).toLocaleTimeString()}` : "Pending check-in"}.</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP MODAL (Reserve Now Success precisely described in spec 7) */}
      {justSubmittedReservations && (
        <div id="success-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="success-modal-content" className="bg-white rounded-3xl w-full max-w-xl border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Header */}
            <div className="bg-amber-500 p-6 text-white flex flex-col items-center justify-center text-center relative">
              <button 
                onClick={() => setJustSubmittedReservations(null)}
                className="absolute top-4 right-4 text-white hover:text-amber-100 cursor-pointer"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 bg-white text-amber-500 rounded-full flex items-center justify-center shadow-md animate-bounce mb-3">
                <CheckCircle size={36} className="text-amber-500 fill-amber-50" />
              </div>
              <h3 className="font-display font-extrabold text-xl tracking-tight">Reservation Submitted Successfully</h3>
              <p className="text-xs text-amber-50 font-semibold mt-1">Your reservation has been received and is currently awaiting payment.</p>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 md:p-8 space-y-6 max-h-[480px] overflow-y-auto">
              
              {/* Alert prompt exactly from specs */}
              <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
                <p className="font-semibold text-slate-800">A payment instruction email has been sent to your registered email address.</p>
                <p>Please complete your payment within 1 hour. Your reservation will automatically expire if payment is not received and verified within the allotted time.</p>
              </div>

              {/* Reference Number display */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Reference Number:</span>
                {justSubmittedReservations.map((resv) => (
                  <div key={resv.id} className="font-mono font-extrabold text-2xl text-slate-900 tracking-wider flex items-center justify-center gap-2">
                    <span>{resv.referenceNumber}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(resv.referenceNumber);
                        setIsCopyRefSuccess(true);
                        setTimeout(() => setIsCopyRefSuccess(false), 2000);
                      }}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer transition-all"
                      title="Copy Reference"
                    >
                      {isCopyRefSuccess ? <Check size={16} className="text-lime-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
                {justSubmittedReservations[0]?.expiresAt && (
                  <div className="pt-2 flex justify-center">
                    <CountdownTimer expiresAt={justSubmittedReservations[0].expiresAt} />
                  </div>
                )}
              </div>

              {/* GCash Payment Steps inside success modal */}
              <div className="space-y-3 pt-2">
                <h4 className="font-display font-semibold text-slate-900 text-sm">GCash Payment Quick Instructions:</h4>
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  <p>1. Send exactly <strong>₱{justSubmittedReservations.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)}</strong> to GCash: <strong>+63 912 345 6789</strong>.</p>
                  <p>2. Put your Reference Code <strong>{justSubmittedReservations[0].referenceNumber}</strong> in the message field.</p>
                  <p>3. Keep your screenshot. The administrator will verify and approve your booking shortly!</p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setJustSubmittedReservations(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
              <button
                onClick={() => {
                  setJustSubmittedReservations(null);
                  setIsTrackerOpen(true);
                  handleTrackBookings();
                }}
                className="px-5 py-2.5 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                View Reservation
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 9. CUSTOM ALERT/ERROR MODAL */}
      {alertModal && (
        <div id="alert-modal-backdrop" className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="alert-modal-content" className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-5 flex gap-4 items-start">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-extrabold text-slate-950 text-base leading-tight">
                  {alertModal.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {alertModal.message}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setAlertModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
