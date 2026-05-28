import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCalendarDays,
  cycleNumber,
  dateToInputValue,
  formatLongDate,
  formatTimeParts,
  formatTimeDisplay,
  parseInputDate,
  parseTimeValue,
  timePartsToValue,
} from "./dateTimeHelpers";

// CSS lives in styles/submission.css (globally loaded via main.tsx)

function usePopoverCollision(open: boolean) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<"drop-down" | "drop-up">("drop-down");
  const [maxHeight, setMaxHeight] = useState(420);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const viewportGap = 18;
    const triggerGap = 10;
    const minComfortHeight = 260;

    function updatePlacement() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const root = rootRef.current;
        const popover = popoverRef.current;
        if (!root || !popover) return;
        const rootRect = root.getBoundingClientRect();
        const naturalHeight = popover.scrollHeight;
        const spaceBelow = window.innerHeight - rootRect.bottom - triggerGap - viewportGap;
        const spaceAbove = rootRect.top - triggerGap - viewportGap;
        const shouldDropUp =
          spaceBelow < Math.min(naturalHeight, minComfortHeight) && spaceAbove > spaceBelow;
        const availableSpace = shouldDropUp ? spaceAbove : spaceBelow;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlacement(shouldDropUp ? "drop-up" : "drop-down");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMaxHeight(Math.max(availableSpace, minComfortHeight));
      });
    }

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return { rootRef, popoverRef, placement, maxHeight };
}

export function TimeStepper({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="sub-time-stepper">
      <button type="button" onClick={onIncrement} aria-label={`Increase ${label}`}>
        <i className="ti ti-chevron-up"></i>
      </button>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <button type="button" onClick={onDecrement} aria-label={`Decrease ${label}`}>
        <i className="ti ti-chevron-down"></i>
      </button>
    </div>
  );
}

export function CalendarDateField({
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { rootRef, popoverRef, placement, maxHeight } = usePopoverCollision(open);
  const selectedDate = parseInputDate(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, rootRef]);

  useEffect(() => {
    if (selectedDate) {
      // Sync visible calendar month when external value changes (e.g. prop update)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value, selectedDate]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const todayValue = dateToInputValue(new Date());
  const displayValue = selectedDate ? formatLongDate(value) : "";

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDate(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className={`sub-date-field ${open ? "is-open" : ""} ${placement}`} ref={rootRef}>
      <button
        className={`sub-date-trigger ${open ? "open" : ""}`}
        type="button"
        disabled={readOnly}
        onClick={() => { if (!readOnly) setOpen((current) => !current); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "" : "placeholder"}>{displayValue || placeholder}</span>
        <i className="ti ti-calendar-event"></i>
      </button>

      {open && !readOnly && (
        <div
          className="sub-date-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          style={{ maxHeight }}
        >
          <div className="sub-date-popover-head">
            <button type="button" className="sub-date-nav" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <i className="ti ti-chevron-left"></i>
            </button>
            <div>
              <div className="sub-date-month">
                {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
              <div className="sub-date-hint">Pick a calendar date</div>
            </div>
            <button type="button" className="sub-date-nav" onClick={() => moveMonth(1)} aria-label="Next month">
              <i className="ti ti-chevron-right"></i>
            </button>
          </div>

          <div className="sub-date-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="sub-date-grid">
            {days.map((day) => (
              <button
                key={day.value}
                className={[
                  "sub-date-day",
                  day.inMonth ? "" : "muted",
                  day.value === value ? "selected" : "",
                  day.value === todayValue ? "today" : "",
                ].join(" ")}
                type="button"
                onClick={() => selectDate(day.value)}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          <div className="sub-date-actions">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" onClick={() => selectDate(todayValue)}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TimePickerField({
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { rootRef, popoverRef, placement, maxHeight } = usePopoverCollision(open);
  const [draft, setDraft] = useState(() => parseTimeValue(value));
  const displayValue = value ? formatTimeDisplay(value) : "";

  useEffect(() => {
    // Reset draft to current value whenever popover opens
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(parseTimeValue(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, rootRef]);

  function adjust(part: "hour" | "minute", offset: number) {
    setDraft((current) => {
      if (part === "hour") return { ...current, hour: cycleNumber(current.hour + offset, 1, 12) };
      return { ...current, minute: cycleNumber(current.minute + offset, 0, 59) };
    });
  }

  function applyTime() {
    onChange(timePartsToValue(draft));
    setOpen(false);
  }

  return (
    <div className={`sub-time-field ${open ? "is-open" : ""} ${placement}`} ref={rootRef}>
      <button
        className={`sub-time-trigger ${open ? "open" : ""}`}
        type="button"
        disabled={readOnly}
        onClick={() => { if (!readOnly) setOpen((current) => !current); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "" : "placeholder"}>{displayValue || placeholder}</span>
        <i className="ti ti-clock"></i>
      </button>

      {open && !readOnly && (
        <div
          className="sub-time-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          style={{ maxHeight }}
        >
          <div className="sub-time-head">
            <div>
              <div className="sub-time-title">Preferred time</div>
              <div className="sub-time-hint">Set the requested publish time</div>
            </div>
            <div className="sub-time-preview">{formatTimeParts(draft)}</div>
          </div>

          <div className="sub-time-controls">
            <TimeStepper
              label="Hour"
              value={String(draft.hour).padStart(2, "0")}
              onIncrement={() => adjust("hour", 1)}
              onDecrement={() => adjust("hour", -1)}
            />
            <TimeStepper
              label="Minute"
              value={String(draft.minute).padStart(2, "0")}
              onIncrement={() => adjust("minute", 1)}
              onDecrement={() => adjust("minute", -1)}
            />
            <div className="sub-time-period" aria-label="Meridiem">
              {(["AM", "PM"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  className={draft.period === period ? "active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, period }))}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="sub-time-quick">
            {[0, 15, 30, 45].map((minute) => (
              <button
                key={minute}
                type="button"
                className={draft.minute === minute ? "active" : ""}
                onClick={() => setDraft((current) => ({ ...current, minute }))}
              >
                :{String(minute).padStart(2, "0")}
              </button>
            ))}
          </div>

          <div className="sub-time-actions">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" onClick={applyTime}>Apply Time</button>
          </div>
        </div>
      )}
    </div>
  );
}
