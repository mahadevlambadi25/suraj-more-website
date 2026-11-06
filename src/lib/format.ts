export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(iso: string, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone, timeZoneName: 'short' }).format(new Date(iso));
}

export function formatDateShort(iso: string, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
}

export function whatsappHref(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
