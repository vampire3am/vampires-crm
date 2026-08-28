import { Check, Layers3 } from "lucide-react";

export interface LeaveAllocation {
  leaveType: string;
  days: number;
}

interface LeaveAllocationPickerProps {
  policies: Array<{ leaveType: string; monthlyCredit: number; isPaid: boolean }>;
  balances?: Array<{ leaveType: string; closing: number }>;
  requestedDays: number;
  value: LeaveAllocation[];
  onChange: (value: LeaveAllocation[]) => void;
}

export function LeaveAllocationPicker({ policies, balances = [], requestedDays, value, onChange }: LeaveAllocationPickerProps) {
  const selectedTotal = value.reduce((sum, item) => sum + item.days, 0);
  const remaining = Math.max(0, requestedDays - selectedTotal);

  const toggle = (leaveType: string) => {
    const existing = value.find(item => item.leaveType === leaveType);
    if (existing) {
      const removed = existing.days;
      const next = value.filter(item => item.leaveType !== leaveType);
      if (next.length) next[0] = { ...next[0], days: next[0].days + removed };
      onChange(next);
      return;
    }
    if (!value.length) {
      onChange([{ leaveType, days: requestedDays }]);
      return;
    }
    const allocation = remaining >= 0.5 ? 0.5 : 0.5;
    const next = value.map((item, index) => index === 0
      ? { ...item, days: Math.max(0.5, item.days - (remaining >= 0.5 ? 0 : allocation)) }
      : item);
    onChange([...next, { leaveType, days: allocation }]);
  };

  const updateDays = (leaveType: string, days: number) => {
    onChange(value.map(item => item.leaveType === leaveType ? { ...item, days } : item));
  };

  return (
    <div className="leave-allocation-picker">
      <div className="leave-allocation-picker__intro">
        <div><Layers3 size={16} /><span><strong>Leave allocation</strong><small>Select one or combine multiple balances.</small></span></div>
        <span className={Math.abs(selectedTotal - requestedDays) < 0.001 ? "is-complete" : "is-incomplete"}>
          {selectedTotal.toFixed(1)} / {requestedDays.toFixed(1)} days
        </span>
      </div>
      <div className="leave-allocation-picker__options">
        {policies.map(policy => {
          const selected = value.find(item => item.leaveType === policy.leaveType);
          const available = balances.filter(item => item.leaveType === policy.leaveType).reduce((sum, item) => sum + item.closing, 0);
          return (
            <div key={policy.leaveType} className={`leave-allocation-option ${selected ? "is-selected" : ""}`}>
              <button type="button" className="leave-allocation-option__select" onClick={() => toggle(policy.leaveType)} aria-pressed={Boolean(selected)}>
                <span className="leave-allocation-option__check">{selected && <Check size={12} />}</span>
                <span><strong>{policy.leaveType}</strong><small>{policy.isPaid ? `${available.toFixed(1)} days available` : "No paid balance required"}</small></span>
              </button>
              {selected && (
                <label className="leave-allocation-option__amount">
                  <span>Days</span>
                  <input type="number" min="0.5" max={requestedDays || 0.5} step="0.5" value={selected.days} onChange={event => updateDays(policy.leaveType, Number(event.target.value))} />
                </label>
              )}
            </div>
          );
        })}
      </div>
      {Math.abs(selectedTotal - requestedDays) >= 0.001 && (
        <p className="leave-allocation-picker__warning">Allocated days must equal the requested {requestedDays.toFixed(1)} days.</p>
      )}
    </div>
  );
}
