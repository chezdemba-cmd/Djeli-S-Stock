"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { processSale } from "../../lib/db/actions/sales";

export type OfflineAction = {
  type: "SALE";
  payload: Parameters<typeof processSale>[0];
};

interface OfflineContextType {
  isOnline: boolean;
  offlineQueue: OfflineAction[];
  syncing: boolean;
  lastSync: string;
  queueOfflineAction: (action: OfflineAction) => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]") as OfflineAction[];
    } catch {
      return [];
    }
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("Jamais");

  const syncOfflineQueue = useCallback(async () => {
    const queueString = localStorage.getItem("djelis_offline_queue") || "[]";
    const queue = JSON.parse(queueString) as OfflineAction[];
    if (queue.length === 0) {
      setLastSync(new Date().toLocaleTimeString());
      return;
    }
    
    setSyncing(true);
    let remainingQueue = [...queue];

    for (const action of queue) {
      try {
        if (action.type === "SALE") {
          await processSale(action.payload);
        }
        remainingQueue = remainingQueue.filter(item => item.payload.idempotency_key !== action.payload.idempotency_key);
        localStorage.setItem("djelis_offline_queue", JSON.stringify(remainingQueue));
        setOfflineQueue(remainingQueue);
      } catch (e) {
        console.error("Échec de synchronisation", e);
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes('mock-store-id') || message.includes('uuid') || message.includes('Stock insuffisant') || message.includes('obligatoire')) {
           remainingQueue = remainingQueue.filter(item => item.payload.idempotency_key !== action.payload.idempotency_key);
           localStorage.setItem("djelis_offline_queue", JSON.stringify(remainingQueue));
           setOfflineQueue(remainingQueue);
           continue;
        }
        break; 
      }
    }
    setSyncing(false);
    setLastSync(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    const online = navigator.onLine;
    const queue = JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]") as OfflineAction[];

    if (online && queue.length > 0) {
      // syncOfflineQueue is async: its setState calls run after the network
      // round-trip, not synchronously within this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      syncOfflineQueue();
    }

    const handleOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  const queueOfflineAction = useCallback((action: OfflineAction) => {
    const queue = JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]") as OfflineAction[];
    queue.push(action);
    localStorage.setItem("djelis_offline_queue", JSON.stringify(queue));
    setOfflineQueue(queue);
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, offlineQueue, syncing, lastSync, queueOfflineAction }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
