import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { INTAKE_YEARS, MONTHS } from "../../lib/destinationsData";

interface IntakePickerProps {
  value: string; // e.g. "August 2027" or "September 2026"
  onChange: (intake: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  placement?: "auto" | "top" | "bottom";
}

export function IntakePicker({
  value,
  onChange,
  required = false,
  disabled = false,
  id,
  name,
  placeholder = "Select intake month and year",
  placement = "auto",
}: IntakePickerProps) {
  // Parse incoming value, e.g. "August 2028" -> month: "August", year: 2028
  const parseVal = (val: string) => {
    if (!val) return { month: "September", year: 2026 };
    const parts = val.trim().split(" ");
    if (parts.length >= 2) {
      const yr = parseInt(parts[parts.length - 1], 10);
      const mth = parts.slice(0, parts.length - 1).join(" ");
      return {
        month: mth || "September",
        year: isNaN(yr) ? 2026 : yr,
      };
    }
    return { month: val, year: 2026 };
  };

  const initial = parseVal(value);
  const [selectedMonth, setSelectedMonth] = useState<string>(initial.month);
  const [currentYear, setCurrentYear] = useState<number>(initial.year);
  const [viewMode, setViewMode] = useState<"months" | "years">("months");
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = parseVal(value);
    setSelectedMonth(parsed.month);
    setCurrentYear(parsed.year);
  }, [value]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === "top") {
        setOpenUpward(true);
      } else if (placement === "bottom") {
        setOpenUpward(false);
      } else {
        // Auto-detect if close to bottom of viewport/modal
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 320px below, open upward
        setOpenUpward(spaceBelow < 320);
      }
    }
  }, [isOpen, placement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMonth = (monthFull: string) => {
    setSelectedMonth(monthFull);
    const combined = `${monthFull} ${currentYear}`;
    onChange(combined);
    setIsOpen(false);
  };

  const handleSelectYear = (year: number) => {
    setCurrentYear(year);
    setViewMode("months");
  };

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentYear(y => (y > 2025 ? y - 1 : y));
  };

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentYear(y => (y < 2035 ? y + 1 : y));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* Input Trigger Button Matching Images */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(v => !v);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "38px",
          padding: "0 12px",
          background: "var(--bg-card)",
          border: isOpen ? "1.5px solid var(--accent-orange, #EA580C)" : "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          color: value ? "var(--text-main)" : "var(--text-muted)",
          fontSize: "13px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(234, 88, 12, 0.15)" : "none",
        }}
      >
        <span style={{ fontWeight: value ? 600 : 400 }}>{value || placeholder}</span>
        <Calendar size={16} style={{ color: "var(--text-muted)" }} />
      </div>

      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          style={{ opacity: 0, height: 0, width: 0, position: "absolute", pointerEvents: "none" }}
          tabIndex={-1}
        />
      )}

      {/* Popover Calendar with Smart Upward/Downward Positioning */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            ...(openUpward
              ? { bottom: "calc(100% + 6px)" }
              : { top: "calc(100% + 6px)" }),
            left: 0,
            width: "310px",
            background: "var(--bg-card, #FFFFFF)",
            border: "1px solid var(--border-strong, #CBD5E1)",
            borderRadius: "10px",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.28)",
            zIndex: 1200,
            padding: "14px",
            color: "var(--text-main, #0F172A)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <button
              type="button"
              onClick={handlePrevYear}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--accent-orange, #EA580C)",
              }}
              aria-label="Previous Year"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode(v => (v === "months" ? "years" : "months"))}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "15px",
                fontWeight: 800,
                color: "var(--text-main, #0F172A)",
                cursor: "pointer",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
              title="Click to toggle Year / Month view"
            >
              {viewMode === "months" ? currentYear : "Select intake year"}
            </button>

            <button
              type="button"
              onClick={handleNextYear}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--accent-orange, #EA580C)",
              }}
              aria-label="Next Year"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* VIEW 1: MONTHS GRID */}
          {viewMode === "months" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {MONTHS.map(m => {
                const isSelected = selectedMonth.toLowerCase() === m.full.toLowerCase();

                return (
                  <button
                    key={m.short}
                    type="button"
                    onClick={() => handleSelectMonth(m.full)}
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "none",
                      background: isSelected ? "var(--accent-orange, #EA580C)" : "transparent",
                      color: isSelected ? "#FFFFFF" : "var(--text-main, #0F172A)",
                      fontSize: "12.5px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--bg-card-subtle, #F1F5F9)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {m.short}
                  </button>
                );
              })}
            </div>
          )}

          {/* VIEW 2: YEARS SELECTION */}
          {viewMode === "years" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {INTAKE_YEARS.map(yr => {
                const isSelected = currentYear === yr;

                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleSelectYear(yr)}
                    style={{
                      height: "40px",
                      borderRadius: "6px",
                      border: isSelected ? "none" : "1px solid var(--border-subtle, #E2E8F0)",
                      background: isSelected ? "var(--accent-orange, #EA580C)" : "var(--bg-card, #FFFFFF)",
                      color: isSelected ? "#FFFFFF" : "var(--text-main, #0F172A)",
                      fontSize: "13px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer with Clear button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border-subtle, #E2E8F0)",
              paddingTop: "8px",
              fontSize: "11px",
              color: "var(--text-muted, #64748B)",
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: "var(--danger-soft, #FEF2F2)",
                color: "var(--danger, #DC2626)",
                border: "none",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            <span>Month and year required</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default IntakePicker;
