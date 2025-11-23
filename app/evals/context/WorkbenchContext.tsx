//app/evals/context/WorkbenchContext.tsx

"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PinnedItem } from '../types';

interface WorkbenchContextType {
  items: PinnedItem[];
  isDrawerOpen: boolean;
  notification: string | null;
  addItem: (item: Omit<PinnedItem, 'timestamp'>) => void;
  removeItem: (id: string) => void;
  clearWorkbench: () => void;
  toggleDrawer: () => void;
  closeDrawer: () => void; // NEW
  isPinned: (id: string) => boolean;
}

const WorkbenchContext = createContext<WorkbenchContextType | undefined>(undefined);

export const WorkbenchProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const addItem = (item: Omit<PinnedItem, 'timestamp'>) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, { ...item, timestamp: Date.now() }];
    });
    
    setNotification(`Added "${item.label}" to Workbench`);
    setTimeout(() => setNotification(null), 3000);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearWorkbench = () => {
    setItems([]);
  };

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  // NEW: Explicit close function
  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const isPinned = (id: string) => {
    return items.some((i) => i.id === id);
  };

  return (
    <WorkbenchContext.Provider value={{ items, isDrawerOpen, notification, addItem, removeItem, clearWorkbench, toggleDrawer, closeDrawer, isPinned }}>
      {children}
    </WorkbenchContext.Provider>
  );
};

export const useWorkbench = () => {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error("useWorkbench must be used within a WorkbenchProvider");
  }
  return context;
};