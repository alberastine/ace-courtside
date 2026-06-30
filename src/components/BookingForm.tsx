import React, { useState } from "react";
import { Court, AppSettings } from "../types";
import { 
  ArrowLeft, 
  Tag, 
  AlertTriangle, 
  CheckCircle, 
  QrCode, 
  Loader2,
  Info
} from "lucide-react";

interface BookingFormProps {
  court: Court;
  selectedDate: string;
  startTime: number;
  endTime: number;
  settings: AppSettings;
  isRecurring?: boolean;
  recurringDays?: string[];
  recurringStartDate?: string;
  recurringEndDate?: string;
  onBack: () => void;
  onSubmitBooking: (formData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    appliedDiscount?: string;
  }) => Promise<void>;
}

export default function BookingForm({
  court,
  selectedDate,
  startTime,
  endTime,
  settings,
  isRecurring,
  recurringDays,
  recurringStartDate,
  recurringEndDate,
  onBack,
  onSubmitBooking
}: BookingFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+639");
  
  // Discount Code states
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; type: "percent" | "fixed"; value: number } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [discountSuccess, setDiscountSuccess] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate dates to book if recurring
  const datesToBook: string[] = [];
  if (isRecurring && recurringDays && recurringDays.length > 0 && recurringStartDate && recurringEndDate) {
    const start = new Date(recurringStartDate);
    const end = new Date(recurringEndDate);
    const temp = new Date(start);
    while (temp <= end) {
      const yyyy = temp.getFullYear();
      const mm = String(temp.getMonth() + 1).padStart(2, "0");
      const dd = String(temp.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const [y, m, dNum] = dateStr.split("-").map(Number);
      const dObj = new Date(y, m - 1, dNum);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = daysOfWeek[dObj.getDay()];

      if (recurringDays.includes(dayName)) {
        datesToBook.push(dateStr);
      }
      temp.setDate(temp.getDate() + 1);
    }
  }

  // Auto Calculations
  const duration = endTime - startTime;
  let courtFee = court.pricePerHour * duration;
  if (isRecurring && datesToBook.length > 0) {
    courtFee = court.pricePerHour * duration * datesToBook.length;
  }
  const serviceFee = settings.serviceFeeRate;

  // Apply discount reduction if valid
  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.type === "percent") {
      discountAmount = courtFee * (appliedDiscount.value / 100);
    } else {
      discountAmount = appliedDiscount.value;
    }
  }
  const totalAmount = Math.max(0, courtFee + serviceFee - discountAmount);

  // Time formatter
  const formatHour = (h: number): string => {
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  const handleApplyDiscount = () => {
    setDiscountError("");
    setDiscountSuccess("");
    const codeUpper = discountCode.trim().toUpperCase();

    if (!codeUpper) {
      setDiscountError("Please enter a code.");
      return;
    }

    if (codeUpper === "PICKLE20") {
      setAppliedDiscount({ code: "PICKLE20", type: "percent", value: 20 });
      setDiscountSuccess("20% Off Court Fee applied successfully!");
    } else if (codeUpper === "FREEFEES") {
      setAppliedDiscount({ code: "FREEFEES", type: "fixed", value: serviceFee });
      setDiscountSuccess("Service fees waived!");
    } else if (codeUpper === "ACE50") {
      setAppliedDiscount({ code: "ACE50", type: "fixed", value: 50 });
      setDiscountSuccess("₱50.00 Off Court Fee applied!");
    } else {
      setDiscountError("Invalid discount code. Try PICKLE20 or ACE50.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountError("");

    // Simple validations
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    const phoneClean = phone.replace(/\s+/g, "");
    if (phoneClean.length < 10) {
      alert("Please enter a valid phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitBooking({
        customerName: fullName,
        customerEmail: email,
        customerPhone: phone,
        appliedDiscount: appliedDiscount?.code
      });
    } catch (err: any) {
      alert(err.message || "An error occurred while securing your reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Date string for nice summary rendering, e.g. "Monday, June 29, 2026"
  const getDisplayDate = () => {
    if (isRecurring && recurringStartDate && recurringEndDate && recurringDays) {
      return `${recurringStartDate} to ${recurringEndDate} (${recurringDays.join(", ")}) [${datesToBook.length} sessions]`;
    }
    try {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      }
    } catch (e) {}
    return selectedDate;
  };

  return (
    <div id="booking-checkout-section" className="max-w-6xl mx-auto py-6 px-4">
      {/* Back to scheduler navigation */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold mb-6 transition-colors group cursor-pointer text-sm"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to Court Schedule</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Customer & Payment Forms */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-2xs">
            <h2 className="font-display text-2xl font-bold text-slate-900">Complete Your Booking</h2>
            <p className="text-xs text-slate-500 mt-1">Enter your details to reserve your court.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+639123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50 font-mono"
                  />
                </div>
              </div>
            </form>
          </div>

          {/* PAYMENT OPTION BOX (as shown in mockup image) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-2xs space-y-4">
            <h3 className="font-display font-bold text-slate-900 text-lg">Payment Method</h3>
            <div className="p-4 border border-lime-500 bg-lime-50/20 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-800 shrink-0 shadow-2xs">
                  <QrCode size={24} className="text-slate-800" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>QR Ph</span>
                    <span className="text-[9px] bg-lime-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded uppercase">Instant</span>
                  </p>
                  <p className="text-xs text-slate-500">Pay with GCash, Maya, or any PH banking app</p>
                </div>
              </div>
              <div className="w-5 h-5 bg-lime-500 text-slate-950 rounded-full flex items-center justify-center shadow-2xs shrink-0">
                <svg className="w-3 h-3 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-relaxed flex gap-1.5">
              <Info size={14} className="text-slate-400 shrink-0" />
              <span>We utilize the unified QR Ph network. Your exact GCash payment instructions, including reference mapping, will be dispatched to your email once the spot is reserved.</span>
            </p>
          </div>

          {/* NO CANCELLATION POLICY BANNER (exactly from mockup) */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3.5">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <h5 className="font-bold text-amber-900 text-sm">No Cancellation Policy</h5>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                All bookings are final. Cancellations and refunds are not available once payment is completed.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BOOKING SUMMARY (mirroring the reference layout) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs sticky top-4 space-y-6">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-lg">Booking Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">Please review before continuing</p>
            </div>

            {/* Club and Court details */}
            <div className="pb-4 border-b border-slate-100">
              <h4 className="font-display font-semibold text-slate-950 text-base">{settings.gymName}</h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{court.name}</p>
            </div>

            {/* Specific reservation schedule detail */}
            <div className="space-y-3 pb-4 border-b border-slate-100 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Date</span>
                <span className="font-semibold text-slate-900 text-right">{getDisplayDate()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Time</span>
                <span className="font-semibold text-slate-900 text-right">{formatHour(startTime)} - {formatHour(endTime)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Total Hours</span>
                <span className="font-semibold text-slate-900 text-right">{duration} {duration === 1 ? "hour" : "hours"}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Rate per Hour</span>
                <span className="font-semibold text-slate-900 text-right">₱{court.pricePerHour.toFixed(2)}</span>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="space-y-3 pb-4 border-b border-slate-100 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Court Fee</span>
                <span className="font-semibold text-slate-900">PHP {courtFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Service Fee</span>
                <span className="font-semibold text-slate-900">PHP {serviceFee.toFixed(2)}</span>
              </div>

              {appliedDiscount && (
                <div className="flex justify-between items-center text-lime-700 bg-lime-50 px-2 py-1.5 rounded font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag size={13} />
                    <span>Discount ({appliedDiscount.code})</span>
                  </span>
                  <span>- PHP {discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Discount Code Input Box */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-slate-50 uppercase font-mono font-semibold"
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200"
                >
                  Apply
                </button>
              </div>
              {discountError && <p className="text-[10px] font-bold text-red-600">{discountError}</p>}
              {discountSuccess && <p className="text-[10px] font-bold text-lime-700">{discountSuccess}</p>}
              <p className="text-[10px] text-slate-400">Try coupon code <span className="font-mono font-semibold text-slate-600">PICKLE20</span> (20% off) or <span className="font-mono font-semibold text-slate-600">ACE50</span> (₱50 off).</p>
            </div>

            {/* Total Area */}
            <div className="flex justify-between items-baseline pt-2">
              <span className="font-display font-semibold text-slate-900 text-sm">Total</span>
              <span className="font-display font-extrabold text-2xl text-slate-950">
                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Proceed to Reservation Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-lime-500 hover:bg-lime-600 disabled:bg-lime-300 text-slate-950 rounded-xl text-sm font-extrabold transition-all duration-250 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting Reservation...</span>
                </>
              ) : (
                <span>Proceed to Reservation</span>
              )}
            </button>
            
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Your reservation status will be set to Pending Payment.<br />
              Selected court cells will be locked for you for 1 hour awaiting payment verification.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
