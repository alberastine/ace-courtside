import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Court, Reservation, ReservationStatus, AppSettings, EmailLog, AdminActivityLog, OperatingHour } from "./src/types";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Middleware to parse JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Helper to generate reference numbers
function generateReferenceNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "PB-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getPHDateTime() {
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
    console.error("Error formatting PH time in server:", err);
  }

  // Fallback to local server/system time if formatting fails
  const local = new Date();
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    hour: local.getHours(),
  };
}

function getPHDayOfWeekFromDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[d.getDay()];
}

function reservationOccupiesOnDate(r: Reservation, dateStr: string, startTime: number, endTime: number): boolean {
  if (r.status === ReservationStatus.CANCELLED) {
    return false;
  }

  let dateMatches = false;
  if (r.isRecurring) {
    // Only approved (BOOKED) recurring reservations block other slots
    if (r.status !== ReservationStatus.BOOKED) {
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

  // Overlap occurs if (startTime < r.endTime && endTime > r.startTime)
  return startTime < r.endTime && endTime > r.startTime;
}

// Initial Database Setup
const defaultCourts: Court[] = [
  {
    id: "court-2",
    name: "Court 2",
    type: "Pickleball · Synthetic",
    pricePerHour: 250,
    images: [
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"
    ],
    enabled: true,
    isIndoor: true,
  },
  {
    id: "court-1",
    name: "Court 1",
    type: "Pickleball · Synthetic",
    pricePerHour: 250,
    images: [
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=800"
    ],
    enabled: true,
    isIndoor: true,
  },
  {
    id: "court-3",
    name: "Court 3",
    type: "Pickleball · Synthetic",
    pricePerHour: 100,
    images: [
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=800"
    ],
    enabled: true,
    isIndoor: true,
  }
];

const defaultOperatingHours: OperatingHour[] = [
  { day: "Sunday", open: "6:00 AM", close: "11:00 PM", enabled: true },
  { day: "Monday", open: "6:00 AM", close: "11:00 PM", enabled: true },
  { day: "Tuesday", open: "6:00 AM", close: "10:00 PM", enabled: true },
  { day: "Wednesday", open: "8:00 AM", close: "11:00 PM", enabled: true },
  { day: "Thursday", open: "6:00 AM", close: "11:00 PM", enabled: true },
  { day: "Friday", open: "6:00 AM", close: "11:00 PM", enabled: true },
  { day: "Saturday", open: "6:00 AM", close: "11:00 PM", enabled: true },
];

const defaultSettings: AppSettings = {
  gymName: "Ace Courtside Pickleball",
  gymLocation: "Tipolo Bolod, Panglao, Bohol, 6340",
  landmark: "Near Chismis Pawnshop and Pagfus Water Refilling Station",
  contactEmail: "contact@acecourtside.com",
  contactPhone: "+639123456789",
  operatingHours: defaultOperatingHours,
  bookingCutoffStart: "6:00 AM",
  bookingCutoffEnd: "9:00 PM",
  serviceFeeRate: 26.97, // Service fee like ₱26.97 from mockup
};

interface DbSchema {
  courts: Court[];
  reservations: Reservation[];
  settings: AppSettings;
  emailLogs: EmailLog[];
  activityLogs: AdminActivityLog[];
}

// Load or Initialize DB
function loadDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      // Run auto expiration check on load
      const updated = checkAndExpireReservations(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(updated)) {
        saveDb(updated);
      }
      return updated;
    }
  } catch (err) {
    console.error("Error loading DB, creating default:", err);
  }

  const initialDb: DbSchema = {
    courts: defaultCourts,
    reservations: [],
    settings: defaultSettings,
    emailLogs: [],
    activityLogs: [{
      id: "init",
      action: "System Initialized",
      details: "Database created with default courts and settings.",
      timestamp: new Date().toISOString()
    }]
  };
  saveDb(initialDb);
  return initialDb;
}

function saveDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving DB:", err);
  }
}

// Expiration Logic: check if pending reservations are > 1 hour old and auto-cancel them
function checkAndExpireReservations(data: DbSchema): DbSchema {
  const now = new Date();
  let changed = false;

  data.reservations = data.reservations.map((res) => {
    if (res.status === ReservationStatus.PENDING) {
      const expirationDate = new Date(res.expiresAt);
      if (now > expirationDate) {
        res.status = ReservationStatus.CANCELLED;
        changed = true;

        // Log the automated cancellation
        data.activityLogs.push({
          id: `log-cancel-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          action: "Reservation Expired",
          details: `Booking ${res.referenceNumber} for ${res.customerName} (Court: ${res.courtName}) expired after 1 hour pending payment.`,
          timestamp: now.toISOString(),
        });

        // Add Simulated Email for Cancellation
        data.emailLogs.push({
          id: `email-cancel-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          recipient: res.customerEmail,
          subject: `Reservation Cancelled - ${res.referenceNumber}`,
          content: `Hi ${res.customerName},\n\nYour pending reservation for ${res.courtName} on ${res.date} at ${formatHour(res.startTime)} - ${formatHour(res.endTime)} has been automatically cancelled as we did not receive payment verification within the 1-hour window.\n\nYou are welcome to book again at your convenience.\n\nBest regards,\n${data.settings.gymName}`,
          sentAt: now.toISOString(),
          type: "CANCELLED",
        });
      }
    }
    return res;
  });

  return data;
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:00 ${ampm}`;
}

function parseTimeStringToHour(timeStr: string): number {
  // e.g., "6:00 AM" -> 6, "9:00 PM" -> 21
  const match = timeStr.match(/^(\d+):00\s+(AM|PM)$/i);
  if (!match) return 6;
  let hour = parseInt(match[1]);
  const ampm = match[2].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}

// Endpoints

// 1. Get entire state
app.get("/api/state", (req, res) => {
  const db = loadDb();
  res.json(db);
});

// 2. Clear or reset state to default
app.post("/api/admin/reset", (req, res) => {
  const initialDb: DbSchema = {
    courts: defaultCourts,
    reservations: [],
    settings: defaultSettings,
    emailLogs: [],
    activityLogs: [{
      id: `reset-${Date.now()}`,
      action: "Database Reset",
      details: "Admin reset all databases and settings to default.",
      timestamp: new Date().toISOString()
    }]
  };
  saveDb(initialDb);
  res.json(initialDb);
});

// 3. Update Facility Settings
app.post("/api/admin/settings", (req, res) => {
  const db = loadDb();
  const newSettings: AppSettings = req.body;

  db.settings = { ...db.settings, ...newSettings };
  db.activityLogs.push({
    id: `settings-${Date.now()}`,
    action: "Settings Updated",
    details: "Admin updated gym profile and/or operating hours.",
    timestamp: new Date().toISOString()
  });

  saveDb(db);
  res.json({ success: true, settings: db.settings });
});

// 4. Create or Edit Court
app.post("/api/admin/courts", (req, res) => {
  const db = loadDb();
  const courtData: Court = req.body;

  if (!courtData.id) {
    // Creating court
    courtData.id = `court-${Date.now()}`;
    db.courts.push(courtData);
    db.activityLogs.push({
      id: `court-add-${Date.now()}`,
      action: "Court Created",
      details: `Created new court: ${courtData.name} (${courtData.type})`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Editing court
    const index = db.courts.findIndex((c) => c.id === courtData.id);
    if (index !== -1) {
      db.courts[index] = { ...db.courts[index], ...courtData };
      db.activityLogs.push({
        id: `court-edit-${Date.now()}`,
        action: "Court Updated",
        details: `Updated court: ${courtData.name}`,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(404).json({ error: "Court not found" });
    }
  }

  saveDb(db);
  res.json({ success: true, courts: db.courts });
});

// 5. Submit Booking (Atomic & Transactional conflict detection)
app.post("/api/book", (req, res) => {
  const db = loadDb();
  const {
    courtId,
    customerName,
    customerEmail,
    customerPhone,
    date,
    startTime,
    endTime,
    isRecurring,
    recurringDays, // array of day names (e.g. ["Saturday"])
    recurringStartDate, // YYYY-MM-DD
    recurringEndDate, // YYYY-MM-DD
  } = req.body;

  if (!customerName || !customerEmail || !customerPhone) {
    return res.status(400).json({ error: "Please fill in all details." });
  }

  const court = db.courts.find((c) => c.id === courtId);
  if (!court || !court.enabled) {
    return res.status(400).json({ error: "Court is disabled or does not exist." });
  }

  // Validate past dates and past times of the day (PH Timezone)
  const ph = getPHDateTime();
  if (!isRecurring) {
    if (date < ph.dateStr) {
      return res.status(400).json({ error: "You cannot book yesterdays date or a past date." });
    }
    if (date === ph.dateStr && startTime < ph.hour) {
      return res.status(400).json({ error: "You cannot book past the current time of the day." });
    }
  } else {
    if (recurringStartDate < ph.dateStr) {
      return res.status(400).json({ error: "Recurring start date cannot be in the past." });
    }
  }

  // Generate date array to book
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
      const dayName = getPHDayOfWeekFromDateString(dateStr);
      if (recurringDays.includes(dayName)) {
        datesToBook.push(dateStr);
      }
      temp.setDate(temp.getDate() + 1);
    }

    if (datesToBook.length === 0) {
      return res.status(400).json({ error: "No matching days found in the recurring date range." });
    }
  } else {
    datesToBook.push(date);
  }

  // Conflict Checking Phase (Atomic verification across all targeted schedules)
  const overlappingReservations: Reservation[] = [];
  
  for (const dateStr of datesToBook) {
    const overlapping = db.reservations.filter((r) => {
      if (r.courtId !== courtId) return false;
      return reservationOccupiesOnDate(r, dateStr, startTime, endTime);
    });
    overlappingReservations.push(...overlapping);
  }

  if (overlappingReservations.length > 0) {
    const conflictList = overlappingReservations
      .map((r) => {
        const dateDesc = r.isRecurring ? `${r.recurringStartDate} to ${r.recurringEndDate}` : r.date;
        return `${dateDesc} at ${formatHour(r.startTime)}-${formatHour(r.endTime)}`;
      })
      .slice(0, 3)
      .join(", ");
    const suffix = overlappingReservations.length > 3 ? " and others" : "";
    return res.status(409).json({
      error: `Double Booking Conflict! The court is already reserved on: ${conflictList}${suffix}. Please select another time range.`,
    });
  }

  // Creation Phase
  const createdReservations: Reservation[] = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour expiration

  const duration = endTime - startTime;
  const pricePerHour = court.pricePerHour;
  
  let courtFee = pricePerHour * duration;
  if (isRecurring) {
    courtFee = pricePerHour * duration * datesToBook.length;
  }
  const serviceFee = db.settings.serviceFeeRate; // Fixed Service fee like ₱26.97 or 5% of court fee
  const totalAmount = courtFee + serviceFee;

  const refNum = generateReferenceNumber();
  const resv: Reservation = {
    id: `resv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    referenceNumber: refNum,
    courtId: court.id,
    courtName: court.name,
    customerName,
    customerEmail,
    customerPhone,
    date: isRecurring ? recurringStartDate : date,
    startTime,
    endTime,
    totalHours: isRecurring ? duration * datesToBook.length : duration,
    courtFee,
    serviceFee,
    totalAmount,
    status: ReservationStatus.PENDING,
    createdAt: now.toISOString(),
    expiresAt,
    isRecurring: !!isRecurring,
    recurringDays: isRecurring ? recurringDays : undefined,
    recurringStartDate: isRecurring ? recurringStartDate : undefined,
    recurringEndDate: isRecurring ? recurringEndDate : undefined,
  };

  db.reservations.push(resv);
  createdReservations.push(resv);

  let dateSummary = date;
  if (isRecurring) {
    dateSummary = `${recurringStartDate} to ${recurringEndDate} (${recurringDays.join(", ")}) [Total ${datesToBook.length} sessions:\n  ${datesToBook.join("\n  ")}]`;
  }

  // Create simulated email for Pending Reservation
  db.emailLogs.push({
    id: `email-pending-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    recipient: customerEmail,
    subject: `Pending Payment Instructions - Booking ${refNum}`,
    content: `Hi ${customerName},\n\nYour reservation request for ${court.name} is received and marked as PENDING PAYMENT.\n\nBooking Summary:\n- Court: ${court.name}\n- Date/Schedule: ${dateSummary}\n- Time: ${formatHour(startTime)} - ${formatHour(endTime)} (${duration} Hours per session)\n- Court Fee: ₱${courtFee.toFixed(2)}\n- Service Fee: ₱${serviceFee.toFixed(2)}\n- Total Amount Due: ₱${totalAmount.toFixed(2)}\n\nPayment Instructions:\n1. Open your GCash app.\n2. Select "Send Money" or Scan our official Gym Merchant QR Ph.\n3. Send ₱${totalAmount.toFixed(2)} to GCash Merchant Number: +63 912 345 6789.\n4. Input "${refNum}" in the GCash message/reference line.\n5. Wait for our administrator to verify your payment.\n\nIMPORTANT: Your reservation expires on ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${formatHour(new Date(expiresAt).getHours())}). Please complete the payment within 1 hour to prevent automatic cancellation.\n\nThank you for choosing ${db.settings.gymName}!`,
    sentAt: now.toISOString(),
    type: "PENDING",
  });

  db.activityLogs.push({
    id: `activity-book-${Date.now()}`,
    action: "New Reservation Created",
    details: `${customerName} booked ${court.name} ${isRecurring ? `(Recurring: ${datesToBook.length} days)` : ""}. Ref: ${refNum}`,
    timestamp: now.toISOString()
  });

  saveDb(db);

  res.status(201).json({
    success: true,
    reservations: createdReservations,
    message: "Reservation submitted successfully! Please check payment instructions sent to your email."
  });
});

// 6. Admin Action (Verify Payment -> Approve, Reject, Check-In)
app.post("/api/admin/reservations/:id/action", (req, res) => {
  const db = loadDb();
  const { id } = req.params;
  const { action, rejectReason } = req.body; // action: "APPROVE" | "REJECT" | "CHECKIN"

  const reservation = db.reservations.find((r) => r.id === id);
  if (!reservation) {
    return res.status(404).json({ error: "Reservation not found" });
  }

  const now = new Date();

  if (action === "APPROVE") {
    if (reservation.status !== ReservationStatus.PENDING) {
      return res.status(400).json({ error: "Only Pending reservations can be approved." });
    }

    // Determine target dates for this reservation
    const datesToBook: string[] = [];
    if (reservation.isRecurring && reservation.recurringDays && reservation.recurringStartDate && reservation.recurringEndDate) {
      const start = new Date(reservation.recurringStartDate);
      const end = new Date(reservation.recurringEndDate);
      const temp = new Date(start);
      while (temp <= end) {
        const yyyy = temp.getFullYear();
        const mm = String(temp.getMonth() + 1).padStart(2, "0");
        const dd = String(temp.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayName = getPHDayOfWeekFromDateString(dateStr);
        if (reservation.recurringDays.includes(dayName)) {
          datesToBook.push(dateStr);
        }
        temp.setDate(temp.getDate() + 1);
      }
    } else {
      datesToBook.push(reservation.date);
    }

    // Check conflicts with any ALREADY APPROVED bookings
    const overlapping: Reservation[] = [];
    for (const dateStr of datesToBook) {
      const conflictsOnDate = db.reservations.filter((r) => {
        if (r.id === reservation.id) return false;
        if (r.courtId !== reservation.courtId) return false;
        return reservationOccupiesOnDate(r, dateStr, reservation.startTime, reservation.endTime);
      });
      overlapping.push(...conflictsOnDate);
    }

    if (overlapping.length > 0) {
      const conflictList = overlapping
        .map((r) => {
          const dateDesc = r.isRecurring ? `${r.recurringStartDate} to ${r.recurringEndDate}` : r.date;
          return `${dateDesc} at ${formatHour(r.startTime)}-${formatHour(r.endTime)}`;
        })
        .slice(0, 3)
        .join(", ");
      const suffix = overlapping.length > 3 ? " and others" : "";
      return res.status(409).json({
        error: `Cannot approve due to double booking conflict on: ${conflictList}${suffix}. Please reject or coordinate with the customer.`,
      });
    }

    reservation.status = ReservationStatus.BOOKED;

    db.activityLogs.push({
      id: `act-approve-${Date.now()}`,
      action: "Reservation Approved",
      details: `Approved payment for booking ${reservation.referenceNumber} (${reservation.customerName})`,
      timestamp: now.toISOString()
    });

    // Create simulated email for Approved
    db.emailLogs.push({
      id: `email-approved-${Date.now()}`,
      recipient: reservation.customerEmail,
      subject: `Booking Confirmed! - Reference: ${reservation.referenceNumber}`,
      content: `Hi ${reservation.customerName},\n\nYour payment of ₱${reservation.totalAmount.toFixed(2)} has been successfully verified!\n\nYour reservation for ${reservation.courtName} is now CONFIRMED.\n\nBooking Details:\n- Court: ${reservation.courtName}\n- Date: ${reservation.date}\n- Time: ${formatHour(reservation.startTime)} - ${formatHour(reservation.endTime)}\n- Duration: ${reservation.totalHours} hours\n- Reference: ${reservation.referenceNumber}\n\nPlease bring one valid government-issued ID during your scheduled booking for identity verification.\n\nThank you for choosing ${db.settings.gymName}!`,
      sentAt: now.toISOString(),
      type: "APPROVED"
    });

  } else if (action === "REJECT") {
    if (reservation.status !== ReservationStatus.PENDING) {
      return res.status(400).json({ error: "Only Pending reservations can be rejected." });
    }
    reservation.status = ReservationStatus.CANCELLED;

    db.activityLogs.push({
      id: `act-reject-${Date.now()}`,
      action: "Reservation Rejected",
      details: `Rejected booking ${reservation.referenceNumber} (${reservation.customerName}). Reason: ${rejectReason || "None"}`,
      timestamp: now.toISOString()
    });

    // Create simulated email for Rejected
    db.emailLogs.push({
      id: `email-rejected-${Date.now()}`,
      recipient: reservation.customerEmail,
      subject: `Payment Verification Failed - Booking ${reservation.referenceNumber}`,
      content: `Hi ${reservation.customerName},\n\nWe were unable to verify your payment for booking reference ${reservation.referenceNumber}.\n\nReason:\n${rejectReason || "Payment information could not be matched with our transaction logs."}\n\nYour booking has been cancelled and the slot is now open to the public. If you believe this is an error, please reply to this email or call us at ${db.settings.contactPhone}.\n\nBest regards,\n${db.settings.gymName}`,
      sentAt: now.toISOString(),
      type: "CANCELLED"
    });

  } else if (action === "CHECKIN") {
    if (reservation.status !== ReservationStatus.BOOKED) {
      return res.status(400).json({ error: "Only Booked (Approved) reservations can be Checked In." });
    }
    reservation.checkedInAt = now.toISOString();

    db.activityLogs.push({
      id: `act-checkin-${Date.now()}`,
      action: "Customer Checked In",
      details: `Checked in ${reservation.customerName} for ${reservation.courtName} at ${formatHour(reservation.startTime)}`,
      timestamp: now.toISOString()
    });
  } else {
    return res.status(400).json({ error: "Invalid action." });
  }

  saveDb(db);
  res.json({ success: true, reservation });
});


// Vite middleware / Static Asset Setup
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
