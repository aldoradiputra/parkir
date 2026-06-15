export type VehicleType = "car" | "motorcycle";

export type GateState = "open" | "closed" | "moving" | "error";

export type LaneDirection = "entry" | "exit";

export type LaneStatus = "online" | "offline" | "syncing";

export type PaymentMethod = "cash" | "qris" | "nfc" | "member" | "manual";

export type PaymentStatus = "paid" | "pending" | "override" | "failed";

export type MemberPassType = "monthly" | "quarterly" | "annual";

export type MemberStatus = "active" | "expiring" | "expired";

export type PlateRuleType = "whitelist" | "blacklist" | "vip";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Location {
  id: string;
  name: string;
  address: string;
  capacity_car: number;
  capacity_motorcycle: number;
  timezone: string;
}

export interface Lane {
  id: string;
  location_id: string;
  name: string;
  direction: LaneDirection;
  status: LaneStatus;
  gate_state: GateState;
  last_heartbeat: string;
  firmware_version: string;
  sessions_today: number;
  ip_address: string;
  error_log?: LaneError[];
}

export interface LaneError {
  id: string;
  lane_id: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  resolved: boolean;
}

export interface Session {
  id: string;
  location_id: string;
  plate_number: string;
  vehicle_type: VehicleType;
  entry_lane_id: string;
  exit_lane_id?: string;
  entry_time: string;
  exit_time?: string;
  duration_minutes?: number;
  amount?: number;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  entry_photo_url?: string;
  exit_photo_url?: string;
  is_member: boolean;
  member_id?: string;
}

export interface Member {
  id: string;
  location_id: string;
  plate_number: string;
  name: string;
  phone: string;
  email?: string;
  pass_type: MemberPassType;
  valid_from: string;
  valid_until: string;
  status: MemberStatus;
  vehicle_type: VehicleType;
  created_at: string;
}

export interface PlateRule {
  id: string;
  location_id: string;
  plate_number: string;
  rule_type: PlateRuleType;
  reason: string;
  created_at: string;
  created_by: string;
}

export interface TariffConfig {
  id: string;
  location_id: string;
  vehicle_type: VehicleType;
  first_hour_rate: number;
  subsequent_hour_rate: number;
  max_daily_rate: number;
  grace_period_minutes: number;
}

export interface RevenueData {
  date: string;
  cash: number;
  qris: number;
  nfc: number;
  member: number;
  total: number;
}

export interface PeakHourData {
  hour: number;
  day: number;
  count: number;
}

export interface OccupancyData {
  cars_current: number;
  cars_capacity: number;
  motorcycles_current: number;
  motorcycles_capacity: number;
}

export interface Alert {
  id: string;
  location_id: string;
  lane_id?: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  active: boolean;
  created_at: string;
}

export interface DailySummary {
  total_sessions: number;
  total_revenue: number;
  car_sessions: number;
  motorcycle_sessions: number;
  peak_hour: number;
  avg_duration_minutes: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "viewer";
  locations: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export type Locale = "en" | "id";

// ---------- Leads + Projects (ERP) ----------

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
export type LeadSource = "landing_page" | "referral" | "social_media" | "direct" | "other";
export type CurrentSystem = "manual" | "boom_gate" | "ticket" | "rfid" | "other";
export type ProjectStatus = "planning" | "procurement" | "installation" | "testing" | "live" | "maintenance" | "cancelled";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  facility_name: string;
  source: LeadSource;
  status: LeadStatus;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  entry_lanes?: number;
  exit_lanes?: number;
  current_system?: CurrentSystem;
  daily_volume?: number;
  preferred_date?: string;
  notes?: string;
  onboarded_at?: string;
  converted_at?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  lead_id?: string;
  location_id?: string;
  facility_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  entry_lanes: number;
  exit_lanes: number;
  status: ProjectStatus;
  start_date?: string;
  target_live?: string;
  actual_live?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
