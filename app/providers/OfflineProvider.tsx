"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { processSale } from "../../lib/db/business";

type OfflineAction = {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
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
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error("Échec de synchronisation", e);
        if (e.message && (e.message.includes('mock-store-id') || e.message.includes('uuid') || e.message.includes('Stock insuffisant') || e.message.includes('obligatoire'))) {
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
    setIsOnline(online);
    const queue = JSON.parse(localStorage.getItem("djelis_offline_queue") || "[]");
    setOfflineQueue(queue);

    if (online && queue.length > 0) {
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
