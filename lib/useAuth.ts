"use client";

// Lightweight prototype auth + subscription store (localStorage only).
// Phase 0: no backend. Phase 3 swaps these for a real magic-link + DB.

import { useEffect, useState } from "react";

const USER_KEY = "fa_user";
const ALERTS_KEY = "fa_alerts";
const EVT = "fa-store-change";

export interface User {
  email: string;
}

export type Channel = "email" | "line" | "telegram" | "discord";

export interface AlertSub {
  id: string;
  email: string;
  origin: string;
  region: string;
  dateStart: string;
  dateEnd: string;
  tripMin: number;
  tripMax: number;
  maxPrice: number;
  maxZ: number;
  channel: Channel;
  channelTarget: string;
  createdAt: string;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function emit() {
  window.dispatchEvent(new Event(EVT));
}

export function login(email: string) {
  localStorage.setItem(USER_KEY, JSON.stringify({ email }));
  emit();
}

export function logout() {
  localStorage.removeItem(USER_KEY);
  emit();
}

export function addAlert(sub: Omit<AlertSub, "id" | "createdAt">): AlertSub {
  const full: AlertSub = {
    ...sub,
    id: `al_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
  const all = readJSON<AlertSub[]>(ALERTS_KEY, []);
  all.push(full);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(all));
  emit();
  return full;
}

export function removeAlert(id: string) {
  const all = readJSON<AlertSub[]>(ALERTS_KEY, []).filter((a) => a.id !== id);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(all));
  emit();
}

/** Reactive current user (null on server + first paint → no hydration mismatch). */
export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const sync = () => setUser(readJSON<User | null>(USER_KEY, null));
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return user;
}

/** Reactive alert subscriptions for the current user. */
export function useAlerts(email: string | undefined): AlertSub[] {
  const [alerts, setAlerts] = useState<AlertSub[]>([]);
  useEffect(() => {
    const sync = () =>
      setAlerts(
        readJSON<AlertSub[]>(ALERTS_KEY, []).filter(
          (a) => !email || a.email === email,
        ),
      );
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [email]);
  return alerts;
}
