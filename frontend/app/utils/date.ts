export const formatDateWithDay = (raw?: string | null): string => {
  if (!raw) {
    return "";
  }
  const datePart = raw.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    return raw;
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${datePart} (${weekday})`;
};
