import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { adToBs, bsToAd, isValidBsDate } from "../../lib/nepaliDate";

interface BsDateInputProps {
  value: string;
  onChange: (adDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export function BsDateInput({ value, onChange, required, disabled, ariaLabel }: BsDateInputProps) {
  const [displayValue, setDisplayValue] = useState(() => value ? adToBs(value) : "");

  useEffect(() => {
    if (value) setDisplayValue(adToBs(value));
  }, [value]);

  return (
    <div className="bs-date-input">
      <CalendarDays size={15} aria-hidden="true" />
      <input
        type="text"
        inputMode="numeric"
        placeholder="2083-05-12"
        pattern="\d{4}-\d{2}-\d{2}"
        title="Enter a valid Bikram Sambat date as YYYY-MM-DD"
        aria-label={ariaLabel ?? "Bikram Sambat date"}
        value={displayValue}
        required={required}
        disabled={disabled}
        onChange={event => {
          const next = event.target.value.replace(/[^0-9-]/g, "").slice(0, 10);
          setDisplayValue(next);
          event.currentTarget.setCustomValidity(isValidBsDate(next) ? "" : "Enter a valid BS date as YYYY-MM-DD");
          if (isValidBsDate(next)) onChange(bsToAd(next));
        }}
      />
      <span>BS</span>
    </div>
  );
}
