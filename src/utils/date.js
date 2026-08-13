export function defaultDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  d.setSeconds(0, 0);
  return d;
}

export function mergeDateAndTime(dateValue, timeValue) {
  const d = new Date(dateValue);
  d.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
  return d;
}

export function today() {
  return new Date().toLocaleDateString('en-CA');
}

export function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function time(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dateTime(value) {
  const d = new Date(value);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${time(d)}`;
}

export function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function relative(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value)) / 86400000));
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

export function countdown(value) {
  const diff = new Date(value) - new Date();
  if (diff <= 0) return { done: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
  };
}

export function remainingLabel(target, now = new Date()) {
  const diff = new Date(target) - new Date(now);
  if (diff <= 0) return 'Past';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000) % 24;
  const minutes = Math.floor(diff / 60000) % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
