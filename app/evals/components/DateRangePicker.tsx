//app/evals/components/DateRangePicker.tsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import { format, parseISO, isValid, isBefore, isAfter } from "date-fns";
import { DayPicker } from "react-day-picker";
import { Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker = ({ startDate, endDate, onChange }: DateRangePickerProps) => {
  // We track which popover is open: 'start', 'end', or null (closed)
  const [openPopover, setOpenPopover] = useState<'start' | 'end' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartSelect = (date: Date | undefined) => {
    if (!date) return;
    const newStart = format(date, 'yyyy-MM-dd');
    
    // Logic: If new start is after current end, push end to match start (single day)
    // Otherwise, keep existing end.
    let newEnd = endDate;
    if (!endDate || isAfter(date, parseISO(endDate))) {
      newEnd = newStart;
    }
    
    onChange(newStart, newEnd);
    setOpenPopover(null); // Close after selection
  };

  const handleEndSelect = (date: Date | undefined) => {
    if (!date) return;
    const newEnd = format(date, 'yyyy-MM-dd');
    
    // Logic: Start date shouldn't change, but just in case of weird state, ensure validity
    const currentStart = startDate || newEnd;
    
    onChange(currentStart, newEnd);
    setOpenPopover(null); // Close after selection
  };

  return (
    <div className="flex items-center gap-2" ref={containerRef}>
      
      {/* --- START DATE PICKER --- */}
      <div className="relative">
        <button
          onClick={() => setOpenPopover(openPopover === 'start' ? null : 'start')}
          className={`flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm transition-all ${
            openPopover === 'start' 
              ? "border-[#2B21C1] ring-2 ring-[#2B21C1]/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <CalendarIcon size={16} className="text-indigo-600" />
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">From</span>
            <span className="text-sm font-medium text-slate-700 leading-none">
              {startDate ? format(parseISO(startDate), "MMM d, yyyy") : "Select"}
            </span>
          </div>
        </button>

        {openPopover === 'start' && (
          <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4">
            <style>{`
              .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #2B21C1; --rdp-background-color: #E0E7FF; margin: 0; }
              .rdp-day_selected:not([disabled]) { background-color: #2B21C1; color: white; font-weight: bold; }
              .rdp-day_selected:hover:not([disabled]) { background-color: #161160; }
            `}</style>
            <DayPicker
              mode="single"
              selected={startDate ? parseISO(startDate) : undefined}
              onSelect={handleStartSelect}
              defaultMonth={startDate ? parseISO(startDate) : undefined}
            />
          </div>
        )}
      </div>

      {/* Separator */}
      <ArrowRight size={16} className="text-slate-300" />

      {/* --- END DATE PICKER --- */}
      <div className="relative">
        <button
          onClick={() => setOpenPopover(openPopover === 'end' ? null : 'end')}
          className={`flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm transition-all ${
            openPopover === 'end' 
              ? "border-[#2B21C1] ring-2 ring-[#2B21C1]/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <CalendarIcon size={16} className="text-indigo-600" />
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">To</span>
            <span className="text-sm font-medium text-slate-700 leading-none">
              {endDate ? format(parseISO(endDate), "MMM d, yyyy") : "Select"}
            </span>
          </div>
        </button>

        {openPopover === 'end' && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4">
            <style>{`
              .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #2B21C1; --rdp-background-color: #E0E7FF; margin: 0; }
              .rdp-day_selected:not([disabled]) { background-color: #2B21C1; color: white; font-weight: bold; }
              .rdp-day_selected:hover:not([disabled]) { background-color: #161160; }
            `}</style>
            <DayPicker
              mode="single"
              selected={endDate ? parseISO(endDate) : undefined}
              onSelect={handleEndSelect}
              defaultMonth={endDate ? parseISO(endDate) : undefined}
              disabled={startDate ? { before: parseISO(startDate) } : undefined}
            />
          </div>
        )}
      </div>

    </div>
  );
};