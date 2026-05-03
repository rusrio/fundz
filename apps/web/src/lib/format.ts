export function shortAddress(value: string | null): string {
  if (!value) {
    return "Not linked";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function statusClass(status: string): string {
  if (status.includes("approved") || status === "confirmed" || status === "submitted" || status === "active") {
    return "status statusPositive";
  }

  if (status.includes("rejected") || status === "failed" || status === "disabled") {
    return "status statusNegative";
  }

  return "status";
}

export function formatSignedBps(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value / 100).toFixed(2)}%`;
}

export function formatBaseUnits(value: string | null | undefined, decimals = 6, maximumFractionDigits = 4): string {
  if (!value) {
    return "0";
  }

  try {
    const negative = value.startsWith("-");
    const absolute = negative ? value.slice(1) : value;
    const base = 10n ** BigInt(decimals);
    const raw = BigInt(absolute);
    const whole = raw / base;
    const fraction = raw % base;
    const fractionText = fraction.toString().padStart(decimals, "0").slice(0, maximumFractionDigits);
    const trimmedFraction = fractionText.replace(/0+$/, "");
    const formattedWhole = new Intl.NumberFormat("en-US").format(Number(whole));
    return `${negative ? "-" : ""}${formattedWhole}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
  } catch {
    return value;
  }
}

export function formatUsdUnits(value: string | null | undefined): string {
  return `$${formatBaseUnits(value, 6, 2)}`;
}

export function formatTokenUnits(value: string | null | undefined, decimals: number): string {
  return formatBaseUnits(value, decimals, decimals > 8 ? 5 : 4);
}
