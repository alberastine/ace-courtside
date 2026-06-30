import React, { useState, useEffect } from "react";
import { reservationOccupiesOnDate } from "../App";
import { 
  Court, 
  Reservation, 
  ReservationStatus, 
  AppSettings, 
  EmailLog, 
  AdminActivityLog,
  OperatingHour
} from "../types";
import { 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Calendar, 
  RefreshCw, 
  Sliders, 
  DollarSign, 
  Trash, 
  Eye, 
  Info,
  ChevronDown,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image
} from "lucide-react";

interface AdminPanelProps {
  courts: Court[];
  reservations: Reservation[];
  settings: AppSettings;
  emailLogs: EmailLog[];
  activityLogs: AdminActivityLog[];
  onRefresh: () => void;
  onUpdateSettings: (settings: AppSettings) => Promise<void>;
  onSaveCourt: (court: Court) => Promise<void>;
  onReservationAction: (id: string, action: "APPROVE" | "REJECT" | "CHECKIN", rejectReason?: string) => Promise<void>;
  onResetData: () => Promise<void>;
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const minutes = Math.floor(difference / 1000 / 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft(`${minutes}m ${seconds}s left`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="font-mono text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-sm inline-block">
      ⏱ {timeLeft}
    </span>
  );
}

export default function AdminPanel({
  courts,
  reservations,
  settings,
  emailLogs,
  activityLogs,
  onRefresh,
  onUpdateSettings,
  onSaveCourt,
  onReservationAction,
  onResetData
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "reservations" | "schedule" | "courts" | "settings" | "emailLogs" | "activityLogs">("dashboard");
  const [resvFilter, setResvFilter] = useState<ReservationStatus>(ReservationStatus.PENDING);
  
  // Booked Schedule Date Selector
  const [scheduleDate, setScheduleDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Custom Confirm Dialog State
  const [confirmingAction, setConfirmingAction] = useState<{
    id: string;
    action: "APPROVE" | "RESET" | "CHECKIN";
    title: string;
    message: string;
  } | null>(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<AppSettings>({ ...settings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Court Form State
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [isSavingCourt, setIsSavingCourt] = useState(false);
  const [courtImageMode, setCourtImageMode] = useState<"file" | "url">("file");

  // Reject Reason Dialog State
  const [rejectingResvId, setRejectingResvId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Search/Filter for Reservations
  const [searchQuery, setSearchQuery] = useState("");

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await onUpdateSettings(settingsForm);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save settings: " + err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenCourtModal = (court?: Court) => {
    if (court) {
      setEditingCourt({ ...court });
      const img = court.images?.[0] || "";
      if (img.startsWith("data:") || !img.startsWith("http")) {
        setCourtImageMode("file");
      } else {
        setCourtImageMode("url");
      }
    } else {
      setEditingCourt({
        id: "",
        name: "",
        type: "Pickleball · Synthetic",
        pricePerHour: 250,
        images: ["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"],
        enabled: true,
        isIndoor: true
      });
      setCourtImageMode("url");
    }
    setIsCourtModalOpen(true);
  };

  const handleSaveCourtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourt) return;
    if (!editingCourt.name.trim()) {
      alert("Court Name is required.");
      return;
    }
    setIsSavingCourt(true);
    try {
      await onSaveCourt(editingCourt);
      setIsCourtModalOpen(false);
      setEditingCourt(null);
    } catch (err) {
      alert("Failed to save court: " + err);
    } finally {
      setIsSavingCourt(false);
    }
  };

  const handleApprove = (id: string) => {
    const resv = reservations.find(r => r.id === id);
    setConfirmingAction({
      id,
      action: "APPROVE",
      title: "Verify Payment & Approve Reservation",
      message: `Are you sure you want to approve the reservation for ${resv?.customerName || "customer"} on ${resv?.date}? This will update the status to Booked and trigger a confirmation email.`
    });
  };

  const handleRejectClick = (id: string) => {
    setRejectingResvId(id);
    setRejectReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingResvId) return;
    if (!rejectReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    await onReservationAction(rejectingResvId, "REJECT", rejectReason);
    setRejectingResvId(null);
    setRejectReason("");
  };

  const handleCheckIn = (id: string) => {
    const resv = reservations.find(r => r.id === id);
    setConfirmingAction({
      id,
      action: "CHECKIN",
      title: "Confirm Check-In",
      message: `Do you want to check in ${resv?.customerName || "customer"} for court ${resv?.courtName}?`
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmingAction) return;
    const { id, action } = confirmingAction;
    setConfirmingAction(null);
    if (action === "APPROVE") {
      await onReservationAction(id, "APPROVE");
    } else if (action === "CHECKIN") {
      await onReservationAction(id, "CHECKIN");
    } else if (action === "RESET") {
      await onResetData();
    }
  };

  // Stats calculation
  const totalCourts = courts.length;
  const todayStr = new Date().toISOString().split("T")[0];
  
  const todayReservations = reservations.filter(r => reservationOccupiesOnDate(r, todayStr, r.startTime, true));
  const pendingPayments = reservations.filter(r => r.status === ReservationStatus.PENDING);
  const approvedReservations = reservations.filter(r => r.status === ReservationStatus.BOOKED);
  const cancelledReservations = reservations.filter(r => r.status === ReservationStatus.CANCELLED);

  // Time slots formatter
  const formatHour = (h: number): string => {
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  const shiftScheduleDate = (days: number) => {
    const current = new Date(scheduleDate);
    current.setDate(current.getDate() + days);
    setScheduleDate(current.toISOString().split("T")[0]);
  };

  const getReservationForCell = (courtId: string, hour: number, targetDate: string) => {
    return reservations.find(r => 
      r.courtId === courtId &&
      reservationOccupiesOnDate(r, targetDate, hour, true)
    );
  };

  const hourRows = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 AM to 10:00 PM, 17 hours

  // Filter reservations
  const filteredReservations = reservations.filter((r) => {
    const matchesStatus = r.status === resvFilter;
    const matchesSearch = 
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerPhone.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <div id="admin-panel-container" className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200">
      
      {/* Admin Sidebar Navigation */}
      <div id="admin-sidebar" className="md:col-span-3 flex flex-col gap-2">
        <div className="p-4 bg-slate-900 text-white rounded-xl mb-4">
          <h3 className="font-display font-semibold text-lg">Admin Workspace</h3>
          <p className="text-xs text-slate-400">Ace Courtside Operations</p>
        </div>

        <button 
          id="admin-nav-dashboard"
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "dashboard" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Calendar size={18} />
          <span>Dashboard Overview</span>
        </button>

        <button 
          id="admin-nav-reservations"
          onClick={() => setActiveTab("reservations")}
          className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "reservations" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={18} />
            <span>Reservations</span>
          </div>
          {pendingPayments.length > 0 && (
            <span className="bg-red-500 text-white font-mono text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingPayments.length}
            </span>
          )}
        </button>

        <button 
          id="admin-nav-schedule"
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "schedule" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Calendar size={18} />
          <span>Booked Schedule</span>
        </button>

        <button 
          id="admin-nav-courts"
          onClick={() => setActiveTab("courts")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "courts" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Sliders size={18} />
          <span>Court Settings</span>
        </button>

        <button 
          id="admin-nav-settings"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "settings" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Clock size={18} />
          <span>Facility Profile</span>
        </button>

        <button 
          id="admin-nav-emailLogs"
          onClick={() => setActiveTab("emailLogs")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "emailLogs" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Mail size={18} />
          <span>Simulated Emails</span>
        </button>

        <button 
          id="admin-nav-activityLogs"
          onClick={() => setActiveTab("activityLogs")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === "activityLogs" ? "bg-lime-500 text-slate-950 shadow-sm" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <FileText size={18} />
          <span>Audit Activity Logs</span>
        </button>

        <div className="mt-8 pt-4 border-t border-slate-200">
          <button
            id="admin-reset-demo-btn"
            onClick={() => {
              setConfirmingAction({
                id: "reset",
                action: "RESET",
                title: "Reset operational data?",
                message: "This will reset all courts, settings, and reservations back to original demo values. Current bookings will be lost."
              });
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-red-300 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold transition-all"
          >
            <RefreshCw size={14} className="animate-spin-hover" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      {/* Main Admin View Workspace */}
      <div id="admin-main-viewport" className="md:col-span-9 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[500px]">
        
        {/* Dynamic Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-950 capitalize">{activeTab.replace(/([A-Z])/g, ' $1')}</h2>
            <p className="text-xs text-slate-500">Live operational data for {settings.gymName}</p>
          </div>
          <button 
            onClick={onRefresh}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
          >
            <RefreshCw size={14} />
            <span>Force Sync Table</span>
          </button>
        </div>

        {/* TAB 1: Dashboard Overview */}
        {activeTab === "dashboard" && (
          <div id="admin-dashboard-tab" className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Total Courts</span>
                <span className="text-3xl font-bold text-slate-900 mt-1 block">{totalCourts}</span>
                <span className="text-[10px] text-lime-600 font-medium block mt-1">✓ Fully Configured</span>
              </div>
              <div className="p-4 bg-lime-50 border border-lime-100 rounded-xl">
                <span className="text-xs text-lime-800 block uppercase font-bold tracking-wider">Today's bookings</span>
                <span className="text-3xl font-bold text-lime-950 mt-1 block">{todayReservations.length}</span>
                <span className="text-[10px] text-lime-800 font-medium block mt-1">Date: {todayStr}</span>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl relative">
                <span className="text-xs text-orange-800 block uppercase font-bold tracking-wider">Pending payments</span>
                <span className="text-3xl font-bold text-orange-950 mt-1 block">{pendingPayments.length}</span>
                {pendingPayments.length > 0 && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
                )}
                <span className="text-[10px] text-orange-700 font-medium block mt-1">Requires Approval</span>
              </div>
              <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                <span className="text-xs text-sky-800 block uppercase font-bold tracking-wider">Approved Booked</span>
                <span className="text-3xl font-bold text-sky-950 mt-1 block">{approvedReservations.length}</span>
                <span className="text-[10px] text-sky-700 font-medium block mt-1">Confirmed & Active</span>
              </div>
            </div>

            {/* Quick Summary list of pending items requiring action */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-medium text-slate-900 text-sm">Pending Approvals Queue ({pendingPayments.length})</h4>
                {pendingPayments.length > 0 && (
                  <button 
                    onClick={() => { setActiveTab("reservations"); setResvFilter(ReservationStatus.PENDING); }}
                    className="text-xs text-lime-700 font-semibold hover:underline"
                  >
                    Manage Queue →
                  </button>
                )}
              </div>

              {pendingPayments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-lg border border-slate-100">
                  <CheckCircle className="mx-auto text-lime-500 mb-2" size={28} />
                  <p className="text-slate-600 text-sm font-medium">All clear! No pending payments to verify.</p>
                  <p className="text-xs text-slate-400 mt-1">New customer bookings requiring payment verification will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.slice(0, 3).map((r) => (
                    <div key={r.id} className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-800 rounded">
                            {r.referenceNumber}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{r.date}</span>
                          <CountdownTimer expiresAt={r.expiresAt} />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{r.customerName} · <span className="font-medium text-slate-600">{r.courtName}</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">Time: {formatHour(r.startTime)} - {formatHour(r.endTime)} · Total: <span className="font-semibold text-slate-900">₱{r.totalAmount.toFixed(2)}</span></p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button 
                          onClick={() => handleApprove(r.id)}
                          className="px-2.5 py-1 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Check size={14} />
                          <span>Approve</span>
                        </button>
                        <button 
                          onClick={() => handleRejectClick(r.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 3 && (
                    <p className="text-xs text-slate-500 text-center font-medium">...and {pendingPayments.length - 3} more pending bookings</p>
                  )}
                </div>
              )}
            </div>

            {/* General Help & Operational Alert */}
            <div className="bg-lime-50 border border-lime-100 rounded-xl p-4 flex gap-3">
              <Info size={18} className="text-lime-800 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-display font-medium text-lime-950 text-sm">Standard Verification Workflow</h5>
                <p className="text-xs text-lime-800 mt-1 leading-relaxed">
                  When a user clicks "Reserve Now", the system holds the slot and marks it as <strong>Pending Payment</strong> for 1 hour. 
                  The user will send the payment to your GCash number. Match the incoming GCash reference code or user name with the queue, then approve. 
                  Expired pending items are cleared automatically on client/server synching.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Reservation Monitoring */}
        {activeTab === "reservations" && (
          <div id="admin-reservations-tab" className="space-y-4">
            
            {/* Filter Tabs for Reservations */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex bg-slate-100 p-1 rounded-lg gap-1 self-start">
                <button
                  onClick={() => setResvFilter(ReservationStatus.PENDING)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${resvFilter === ReservationStatus.PENDING ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <span>Pending Payment</span>
                  {pendingPayments.length > 0 && (
                    <span className="bg-red-500 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                      {pendingPayments.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setResvFilter(ReservationStatus.BOOKED)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${resvFilter === ReservationStatus.BOOKED ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <span>Approved & Active</span>
                </button>
                <button
                  onClick={() => setResvFilter(ReservationStatus.CANCELLED)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${resvFilter === ReservationStatus.CANCELLED ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <span>Cancelled/Expired</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative max-w-xs w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search name, phone, ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>
            </div>

            {/* List Table */}
            {filteredReservations.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-600">No reservations found in this category.</p>
                {searchQuery && (
                  <p className="text-xs text-slate-400 mt-1">Try resetting your search query.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="p-3">Reference / Date</th>
                      <th className="p-3">Customer Details</th>
                      <th className="p-3">Court / Time</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReservations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 align-top">
                          <span className="font-mono font-semibold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded block w-fit mb-1">
                            {r.referenceNumber}
                          </span>
                          <span className="text-xs text-slate-500 font-medium block">
                            {r.isRecurring && r.recurringStartDate && r.recurringEndDate ? (
                              <>
                                {r.recurringStartDate} to {r.recurringEndDate}
                                <span className="block text-[10px] text-slate-400">({r.recurringDays?.join(", ")})</span>
                              </>
                            ) : (
                              r.date
                            )}
                          </span>
                          {r.status === ReservationStatus.PENDING && (
                            <div className="mt-1">
                              <CountdownTimer expiresAt={r.expiresAt} />
                            </div>
                          )}
                          {r.isRecurring && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold rounded px-1 mt-1 inline-block">
                              🔄 Recurring
                            </span>
                          )}
                        </td>
                        <td className="p-3 align-top">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm">{r.customerName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{r.customerEmail}</p>
                          <p className="text-xs text-slate-500 font-mono">{r.customerPhone}</p>
                        </td>
                        <td className="p-3 align-top">
                          <p className="font-semibold text-slate-800 text-xs sm:text-sm">{r.courtName}</p>
                          <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            <span>{formatHour(r.startTime)} - {formatHour(r.endTime)}</span>
                          </p>
                          <span className="text-[11px] text-slate-400 block mt-0.5">({r.totalHours} hrs)</span>
                        </td>
                        <td className="p-3 align-top">
                          <p className="font-semibold text-slate-900">₱{r.totalAmount.toFixed(2)}</p>
                          <span className="text-[10px] text-slate-400 block">Court: ₱{r.courtFee}</span>
                        </td>
                        <td className="p-3 align-top text-right">
                          <div className="flex flex-col sm:flex-row items-center justify-end gap-1.5">
                            {r.status === ReservationStatus.PENDING && (
                              <>
                                <button
                                  onClick={() => handleApprove(r.id)}
                                  className="w-full sm:w-auto px-2 py-1 bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all"
                                >
                                  <Check size={12} />
                                  <span>Verify Payment</span>
                                </button>
                                <button
                                  onClick={() => handleRejectClick(r.id)}
                                  className="w-full sm:w-auto px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                            
                            {r.status === ReservationStatus.BOOKED && (
                              r.checkedInAt ? (
                                <span className="text-xs text-lime-600 font-bold bg-lime-50 border border-lime-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                  <UserCheck size={13} />
                                  <span>Checked In</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleCheckIn(r.id)}
                                  className="w-full sm:w-auto px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded flex items-center justify-center gap-1 transition-all"
                                >
                                  <Check size={13} />
                                  <span>Check In</span>
                                </button>
                              )
                            )}

                            {r.status === ReservationStatus.CANCELLED && (
                              <span className="text-xs text-slate-400 italic">Expired / Cancelled</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2.5: Booked Schedule Grid */}
        {activeTab === "schedule" && (
          <div id="admin-schedule-tab" className="space-y-6">
            
            {/* Header / Date Selector Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5">
                <Calendar size={18} className="text-lime-600" />
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base">Booked Schedule Grid</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => shiftScheduleDate(-1)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="relative">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none text-slate-800"
                  />
                </div>

                <button 
                  onClick={() => shiftScheduleDate(1)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => setScheduleDate(new Date().toISOString().split("T")[0])}
                  className="px-2.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Main Visual Schedule Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-100 uppercase font-mono tracking-wider border-b border-slate-800">
                      <th className="p-3 font-semibold text-center w-24 border-r border-slate-800">Time Slot</th>
                      {courts.map((c) => (
                        <th key={c.id} className="p-3 font-bold text-center min-w-[200px]">
                          <div className="flex flex-col items-center">
                            <span className="text-lime-400 font-display font-bold text-sm">{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal normal-case">{c.type}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-200">
                    {hourRows.map((hour) => {
                      const displayHourStr = formatHour(hour);
                      return (
                        <tr key={hour} className="hover:bg-slate-50/20 transition-colors">
                          {/* Time cell */}
                          <td className="p-3 text-xs font-bold text-slate-600 bg-slate-50 border-r border-slate-200 font-mono text-center sticky left-0 z-10 shadow-xs">
                            {displayHourStr}
                          </td>
                          
                          {/* Court columns */}
                          {courts.map((c) => {
                            const resv = getReservationForCell(c.id, hour, scheduleDate);
                            
                            if (resv) {
                              const isPending = resv.status === ReservationStatus.PENDING;
                              return (
                                <td 
                                  key={c.id} 
                                  className={`p-3 text-xs transition-all ${
                                    isPending 
                                      ? "bg-amber-50/70 border border-amber-200/50 text-amber-900" 
                                      : "bg-slate-50/50 border border-slate-200/50 text-slate-800"
                                  }`}
                                >
                                  <div className="space-y-2 p-1.5 rounded-lg bg-white shadow-3xs border border-slate-100">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <span className="font-bold text-slate-900">{resv.customerName}</span>
                                      <span className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 text-slate-600 rounded">
                                        {resv.referenceNumber}
                                      </span>
                                    </div>
                                    
                                    <div className="text-[10px] space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Duration:</span>
                                        <span className="font-semibold text-slate-700">
                                          {formatHour(resv.startTime)} - {formatHour(resv.endTime)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Contact:</span>
                                        <span className="font-semibold text-slate-700">{resv.customerPhone}</span>
                                      </div>
                                    </div>

                                    {/* Action items or status info */}
                                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between gap-1.5">
                                      {isPending ? (
                                        <>
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] uppercase font-bold text-amber-600">Pending GCash</span>
                                            <CountdownTimer expiresAt={resv.expiresAt} />
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              onClick={() => handleApprove(resv.id)}
                                              title="Verify Payment"
                                              className="p-1 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded cursor-pointer transition-all shadow-3xs"
                                            >
                                              <Check size={12} className="stroke-[3]" />
                                            </button>
                                            <button
                                              onClick={() => handleRejectClick(resv.id)}
                                              title="Reject Reservation"
                                              className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded cursor-pointer transition-all"
                                            >
                                              <X size={12} className="stroke-[2.5]" />
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-[9px] uppercase font-bold text-emerald-600 flex items-center gap-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                            <span>Approved</span>
                                          </span>
                                          
                                          {resv.checkedInAt ? (
                                            <span className="text-[9px] text-lime-600 font-bold bg-lime-50 px-1.5 py-0.5 rounded border border-lime-100 flex items-center gap-0.5">
                                              <UserCheck size={10} />
                                              <span>Checked In</span>
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleCheckIn(resv.id)}
                                              className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-white text-[9px] font-bold rounded cursor-pointer transition-all"
                                            >
                                              Check In
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                            
                            return (
                              <td key={c.id} className="p-3 text-center text-slate-400 bg-slate-50/20 border-dashed border border-slate-100">
                                <span className="text-[10px] font-mono select-none opacity-50">Available</span>
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

          </div>
        )}

        {/* TAB 3: Court Management */}
        {activeTab === "courts" && (
          <div id="admin-courts-tab" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-medium text-slate-900 text-sm">Configured Facility Courts</h3>
              <button 
                onClick={() => handleOpenCourtModal()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
              >
                <Plus size={14} />
                <span>Add Court</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courts.map((c) => (
                <div key={c.id} className={`border rounded-xl overflow-hidden transition-all shadow-2xs ${c.enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75"}`}>
                  <div className="h-40 bg-slate-100 relative">
                    <img 
                      src={c.images[0] || "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"} 
                      alt={c.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      {c.isIndoor && (
                        <span className="text-[10px] bg-slate-900/80 backdrop-blur-xs text-white font-semibold px-2 py-0.5 rounded">
                          Indoor
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.enabled ? "bg-lime-500 text-slate-950" : "bg-red-500 text-white"}`}>
                        {c.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-semibold text-slate-950 text-base">{c.name}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{c.type}</p>
                      </div>
                      <span className="font-display font-bold text-lime-700 text-sm bg-lime-50 px-2 py-0.5 rounded">
                        ₱{c.pricePerHour}/hr
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenCourtModal(c)}
                        className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium rounded border border-slate-200 flex items-center gap-1 transition-all"
                      >
                        <Edit2 size={12} />
                        <span>Edit Details</span>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...c, enabled: !c.enabled };
                          onSaveCourt(updated);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${c.enabled ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200" : "bg-lime-50 text-lime-700 hover:bg-lime-100 border border-lime-200"}`}
                      >
                        {c.enabled ? "Disable Court" : "Enable Court"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Facility Profile Settings */}
        {activeTab === "settings" && (
          <form id="admin-settings-form" onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-display font-medium text-slate-950 text-base pb-1 border-b border-slate-100">Gym Location & Contact</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Gym Facility Name</label>
                  <input
                    type="text"
                    value={settingsForm.gymName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gymName: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Gym Location Address</label>
                <input
                  type="text"
                  value={settingsForm.gymLocation}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gymLocation: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Landmark</label>
                <input
                  type="text"
                  value={settingsForm.landmark}
                  onChange={(e) => setSettingsForm({ ...settingsForm, landmark: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={settingsForm.contactEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Default Service Fee (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settingsForm.serviceFeeRate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, serviceFeeRate: parseFloat(e.target.value) })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-medium text-slate-950 text-base pb-1 border-b border-slate-100">Booking Hours Cut-Off</h3>
              <p className="text-xs text-slate-500">Configure online booking hours. Bookings are accepted only within this range.</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Cut-Off Start</label>
                  <select
                    value={settingsForm.bookingCutoffStart}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bookingCutoffStart: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  >
                    {["5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Cut-Off End</label>
                  <select
                    value={settingsForm.bookingCutoffEnd}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bookingCutoffEnd: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  >
                    {["8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-medium text-slate-950 text-base pb-1 border-b border-slate-100">Gym Operating Hours</h3>
              <div className="space-y-2">
                {settingsForm.operatingHours.map((oh, index) => (
                  <div key={oh.day} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg gap-4">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 w-24">{oh.day}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={oh.open}
                        disabled={!oh.enabled}
                        onChange={(e) => {
                          const updated = [...settingsForm.operatingHours];
                          updated[index].open = e.target.value;
                          setSettingsForm({ ...settingsForm, operatingHours: updated });
                        }}
                        className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-400">to</span>
                      <select
                        value={oh.close}
                        disabled={!oh.enabled}
                        onChange={(e) => {
                          const updated = [...settingsForm.operatingHours];
                          updated[index].close = e.target.value;
                          setSettingsForm({ ...settingsForm, operatingHours: updated });
                        }}
                        className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {["8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oh.enabled}
                        onChange={(e) => {
                          const updated = [...settingsForm.operatingHours];
                          updated[index].enabled = e.target.checked;
                          setSettingsForm({ ...settingsForm, operatingHours: updated });
                        }}
                        className="rounded text-lime-500 focus:ring-lime-400"
                      />
                      <span className="text-xs text-slate-600 font-medium">Open</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-4 py-2 bg-lime-500 hover:bg-lime-600 disabled:bg-lime-300 text-slate-950 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                {isSavingSettings ? "Saving Settings..." : "Save Facility Profile"}
              </button>
              {settingsSuccess && (
                <span className="text-xs text-lime-600 font-bold bg-lime-50 border border-lime-100 px-3 py-1.5 rounded-lg flex items-center gap-1 animate-fade-in">
                  <Check size={14} />
                  <span>Settings Saved Successfully!</span>
                </span>
              )}
            </div>
          </form>
        )}

        {/* TAB 5: Email Logs Viewer */}
        {activeTab === "emailLogs" && (
          <div id="admin-email-logs-tab" className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 mb-2">
              <Info size={18} className="text-slate-700 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-display font-medium text-slate-950 text-sm">Simulated Email Inbox Logs</h5>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Since actual outbound SMTP can be blocked or unconfigured, the application records simulated <strong>Pending Payment instructions</strong> and <strong>Confirmation alerts</strong> here. 
                  This lets you inspect exactly what customers receive on booking.
                </p>
              </div>
            </div>

            {emailLogs.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                <Mail className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-600">No emails have been simulated yet.</p>
                <p className="text-xs text-slate-400 mt-1">Submit a reservation to generate system emails.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {emailLogs.map((email) => (
                  <div key={email.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-500 font-medium">To: <span className="font-semibold text-slate-950">{email.recipient}</span></p>
                        <p className="text-xs font-bold text-slate-900">Subject: {email.subject}</p>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          email.type === "PENDING" ? "bg-orange-100 text-orange-800" : 
                          email.type === "APPROVED" ? "bg-lime-100 text-lime-800" : "bg-red-100 text-red-800"
                        }`}>
                          {email.type} EMAIL
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
                      {email.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Admin Activity Logs */}
        {activeTab === "activityLogs" && (
          <div id="admin-activity-logs-tab" className="space-y-4">
            {activityLogs.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No activity logged.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/30">
                          <td className="p-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                            {log.action}
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* COURT MODAL: Add/Edit Court */}
      {isCourtModalOpen && editingCourt && (
        <div id="court-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div id="court-modal-content" className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-slate-950 p-4 text-white flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">
                {editingCourt.id ? `Edit ${editingCourt.name}` : "Add New Court"}
              </h3>
              <button 
                onClick={() => { setIsCourtModalOpen(false); setEditingCourt(null); }}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCourtSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Court Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Court 4"
                  value={editingCourt.name}
                  onChange={(e) => setEditingCourt({ ...editingCourt, name: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Court Material / Type</label>
                <input
                  type="text"
                  placeholder="e.g. Pickleball · Synthetic"
                  value={editingCourt.type}
                  onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Price per Hour (₱) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingCourt.pricePerHour}
                    onChange={(e) => setEditingCourt({ ...editingCourt, pricePerHour: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="inline-flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={editingCourt.isIndoor}
                      onChange={(e) => setEditingCourt({ ...editingCourt, isIndoor: e.target.checked })}
                      className="rounded text-lime-500 focus:ring-lime-400"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Indoor Facility</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Court Banner Photo</label>
                
                {/* Segment tabs */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCourtImageMode("file")}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      courtImageMode === "file" 
                        ? "bg-white text-slate-900 shadow-3xs" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Upload Local Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourtImageMode("url")}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      courtImageMode === "url" 
                        ? "bg-white text-slate-900 shadow-3xs" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Web Photo URL
                  </button>
                </div>

                {/* File Upload Mode */}
                {courtImageMode === "file" && (
                  <div className="space-y-3">
                    {/* Preview Thumbnail */}
                    {editingCourt.images[0] && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 flex items-center justify-center">
                        <img 
                          src={editingCourt.images[0]} 
                          alt="Court preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingCourt({ ...editingCourt, images: [] })}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center"
                          title="Remove Photo"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    )}

                    {/* Drag and Drop Upload Area */}
                    <label 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditingCourt({
                              ...editingCourt,
                              images: [reader.result as string]
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-lime-500 hover:bg-lime-50/20 rounded-xl p-6 text-center cursor-pointer transition-all"
                    >
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditingCourt({
                                ...editingCourt,
                                images: [reader.result as string]
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden" 
                      />
                      <Upload size={24} className="text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700">Click to upload or drag & drop</span>
                      <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, or WEBP up to 5MB</span>
                    </label>
                  </div>
                )}

                {/* External URL Mode */}
                {courtImageMode === "url" && (
                  <div className="space-y-3">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={editingCourt.images[0]?.startsWith("data:") ? "" : (editingCourt.images[0] || "")}
                      onChange={(e) => setEditingCourt({ ...editingCourt, images: [e.target.value] })}
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                    />
                    
                    {/* URL Preview */}
                    {editingCourt.images[0] && !editingCourt.images[0].startsWith("data:") && (
                      <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 flex items-center justify-center">
                        <img 
                          src={editingCourt.images[0]} 
                          alt="URL Image preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 block">Specify an image URL or let it default to our pre-configured assets.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCourt.enabled}
                    onChange={(e) => setEditingCourt({ ...editingCourt, enabled: e.target.checked })}
                    className="rounded text-lime-500 focus:ring-lime-400"
                  />
                  <span className="text-xs text-slate-700 font-semibold">Enable and Open for Online Bookings</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCourtModalOpen(false); setEditingCourt(null); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCourt}
                  className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isSavingCourt ? "Saving..." : "Save Court"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT DIALOG */}
      {rejectingResvId && (
        <div id="reject-dialog-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="reject-dialog-content" className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-red-950 p-4 text-white flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">Reject Payment Verification</h3>
              <button 
                onClick={() => setRejectingResvId(null)}
                className="text-red-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Provide a specific reason for rejection. This description will be automatically embedded in the customer's cancellation notification email.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Reference number does not match GCash ledger / Incorrect amount paid."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingResvId(null)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-all cursor-pointer"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DIALOG */}
      {confirmingAction && (
        <div id="confirm-dialog-backdrop" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="confirm-dialog-content" className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <AlertCircle size={18} className="text-lime-400" />
                <span>{confirmingAction.title}</span>
              </h3>
              <button 
                onClick={() => setConfirmingAction(null)}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {confirmingAction.message}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="px-3.5 py-1.5 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
