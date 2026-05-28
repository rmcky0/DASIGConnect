// Pure date/time helper functions shared by CalendarDateField and TimePickerField.
// No React imports — kept separate to satisfy react-refresh/only-export-components.

export function parseInputDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function dateToInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, value: dateToInputValue(date), inMonth: date.getMonth() === monthDate.getMonth() };
  });
}

export function formatLongDate(value: string) {
  const date = parseInputDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function toTimeParts(hour24: number, minute: number) {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return { hour, minute: Math.min(Math.max(minute, 0), 59), period };
}

export function parseTimeValue(value: string) {
  if (!value) {
    const now = new Date();
    return toTimeParts(now.getHours(), now.getMinutes());
  }
  const [hourPart, minutePart] = value.split(":").map(Number);
  if (Number.isNaN(hourPart) || Number.isNaN(minutePart)) {
    const now = new Date();
    return toTimeParts(now.getHours(), now.getMinutes());
  }
  return toTimeParts(hourPart, minutePart);
}

export function timePartsToValue(parts: { hour: number; minute: number; period: "AM" | "PM" }) {
  const hour24 =
    parts.period === "PM"
      ? parts.hour === 12 ? 12 : parts.hour + 12
      : parts.hour === 12 ? 0 : parts.hour;
  return `${String(hour24).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatTimeParts(parts: { hour: number; minute: number; period: "AM" | "PM" }) {
  return `${parts.hour}:${String(parts.minute).padStart(2, "0")} ${parts.period}`;
}

export function formatTimeDisplay(value: string) {
  return formatTimeParts(parseTimeValue(value));
}

export function cycleNumber(value: number, min: number, max: number) {
  if (value > max) return min;
  if (value < min) return max;
  return value;
}
