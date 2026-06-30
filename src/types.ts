export enum ReservationStatus {
  PENDING = "Pending Payment",
  BOOKED = "Booked",
  CANCELLED = "Cancelled",
}

export interface Court {
  id: string;
  name: string;
  type: string; // e.g. "Pickleball - Synthetic"
  pricePerHour: number;
  images: string[];
  enabled: boolean;
  isIndoor: boolean;
}

export interface Reservation {
  id: string;
  referenceNumber: string;
  courtId: string;
  courtName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  startTime: number; // Hour in 24h (e.g. 9 for 9:00 AM, 21 for 9:00 PM)
  endTime: number; // Hour in 24h (e.g. 11 for 11:00 PM, 23 for 11:00 PM)
  totalHours: number;
  courtFee: number;
  serviceFee: number;
  totalAmount: number;
  status: ReservationStatus;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  checkedInAt?: string; // ISO string if checked in
  isRecurring?: boolean;
  recurringGroupId?: string;
  recurringDays?: string[];
  recurringStartDate?: string;
  recurringEndDate?: string;
}

export interface OperatingHour {
  day: string; // Sunday, Monday...
  open: string; // "6:00 AM"
  close: string; // "10:00 PM"
  enabled: boolean;
}

export interface AppSettings {
  gymName: string;
  gymLocation: string;
  landmark: string;
  contactEmail: string;
  contactPhone: string;
  operatingHours: OperatingHour[];
  bookingCutoffStart: string; // "6:00 AM"
  bookingCutoffEnd: string; // "9:00 PM"
  serviceFeeRate: number; // e.g. 0.05 (5%) or fixed fee like ₱26.97
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  content: string;
  sentAt: string;
  type: "PENDING" | "APPROVED" | "CANCELLED";
}

export interface AdminActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}
