import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("parkir_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("parkir_token");
        document.cookie = "parkir_auth=; path=/; max-age=0";
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const endpoints = {
  auth: {
    login: "/auth/login",
    me: "/auth/me",
    logout: "/auth/logout",
  },
  locations: {
    list: "/locations",
    get: (id: string) => `/locations/${id}`,
  },
  lanes: {
    list: (locationId: string) => `/locations/${locationId}/lanes`,
    get: (locationId: string, laneId: string) =>
      `/locations/${locationId}/lanes/${laneId}`,
    openGate: (locationId: string, laneId: string) =>
      `/locations/${locationId}/lanes/${laneId}/open-gate`,
    pushConfig: (locationId: string, laneId: string) =>
      `/locations/${locationId}/lanes/${laneId}/push-config`,
    errors: (locationId: string, laneId: string) =>
      `/locations/${locationId}/lanes/${laneId}/errors`,
  },
  sessions: {
    list: (locationId: string) => `/locations/${locationId}/sessions`,
    get: (locationId: string, sessionId: string) =>
      `/locations/${locationId}/sessions/${sessionId}`,
    active: (locationId: string) => `/locations/${locationId}/sessions/active`,
    exportCsv: (locationId: string) =>
      `/locations/${locationId}/sessions/export`,
  },
  revenue: {
    daily: (locationId: string) => `/locations/${locationId}/revenue/daily`,
    summary: (locationId: string) => `/locations/${locationId}/revenue/summary`,
    peakHours: (locationId: string) =>
      `/locations/${locationId}/revenue/peak-hours`,
    exportPdf: (locationId: string) =>
      `/locations/${locationId}/revenue/export`,
  },
  members: {
    list: (locationId: string) => `/locations/${locationId}/members`,
    get: (locationId: string, memberId: string) =>
      `/locations/${locationId}/members/${memberId}`,
    create: (locationId: string) => `/locations/${locationId}/members`,
    update: (locationId: string, memberId: string) =>
      `/locations/${locationId}/members/${memberId}`,
    deactivate: (locationId: string, memberId: string) =>
      `/locations/${locationId}/members/${memberId}/deactivate`,
    importCsv: (locationId: string) =>
      `/locations/${locationId}/members/import`,
  },
  plateRules: {
    list: (locationId: string) => `/locations/${locationId}/plate-rules`,
    create: (locationId: string) => `/locations/${locationId}/plate-rules`,
    delete: (locationId: string, ruleId: string) =>
      `/locations/${locationId}/plate-rules/${ruleId}`,
  },
  settings: {
    tariffs: (locationId: string) => `/locations/${locationId}/tariffs`,
    updateTariff: (locationId: string, tariffId: string) =>
      `/locations/${locationId}/tariffs/${tariffId}`,
    paymentKeys: (locationId: string) =>
      `/locations/${locationId}/settings/payment`,
    whatsapp: (locationId: string) =>
      `/locations/${locationId}/settings/whatsapp`,
    staff: (locationId: string) => `/locations/${locationId}/staff`,
  },
  occupancy: {
    current: (locationId: string) => `/locations/${locationId}/occupancy`,
  },
  alerts: {
    list: (locationId: string) => `/locations/${locationId}/alerts`,
    resolve: (locationId: string, alertId: string) =>
      `/locations/${locationId}/alerts/${alertId}/resolve`,
  },
};
