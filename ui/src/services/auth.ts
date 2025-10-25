import { API_BASE } from "../lib/apiBase";

export type OtpChannel = "sms" | "email";

export interface OtpState {
  destination: string;
  channel: OtpChannel;
  requestedAt: number;
  verifiedAt?: number;
}

const OTP_KEY = "kontra.otp.state";
export const OTP_TTL_MS = 15 * 60 * 1000;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persist(state: OtpState | null) {
  const storage = getStorage();
  if (!storage) return;
  if (!state) {
    storage.removeItem(OTP_KEY);
    return;
  }
  storage.setItem(OTP_KEY, JSON.stringify(state));
}

export function loadOtpState(): OtpState | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(OTP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OtpState;
    if (parsed.verifiedAt && Date.now() - parsed.verifiedAt > OTP_TTL_MS) {
      const refreshed: OtpState = {
        destination: parsed.destination,
        channel: parsed.channel,
        requestedAt: parsed.requestedAt,
      };
      persist(refreshed);
      return refreshed;
    }
    return parsed;
  } catch {
    storage.removeItem(OTP_KEY);
    return null;
  }
}

export function clearOtpState() {
  persist(null);
}

export function markOtpRequested(destination: string, channel: OtpChannel): OtpState {
  const state: OtpState = {
    destination,
    channel,
    requestedAt: Date.now(),
  };
  persist(state);
  return state;
}

export function markOtpVerified(previous: OtpState): OtpState {
  const state: OtpState = {
    ...previous,
    verifiedAt: Date.now(),
  };
  persist(state);
  return state;
}

export function isOtpVerified(state: OtpState | null): boolean {
  if (!state?.verifiedAt) return false;
  return Date.now() - state.verifiedAt < OTP_TTL_MS;
}

async function sendJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({} as Record<string, string>));
    throw new Error(detail.message || "Request failed");
  }
  return res.json() as Promise<T>;
}

export function requestOtp(channel: OtpChannel, destination: string) {
  return sendJson<{ sent: boolean }>(`${API_BASE}/api/otp/request`, { channel, destination });
}

export function verifyOtp(destination: string, code: string) {
  return sendJson<{ verified: boolean }>(`${API_BASE}/api/otp/verify`, { destination, code });
}
