import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  return format(date, 'h:mm a / EEEE, MMMM d');
}

export function formatTimeOnly(date) {
  return format(date, 'h:mm a');
}

export function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'reviewed':
    case 'high':
      return 'success';
    case 'in progress':
    case 'medium':
      return 'warning';
    case 'need review':
    case 'low':
      return 'error';
    default:
      return 'info';
  }
}

export function generateRandomId() {
  return Math.random().toString(36).substring(2, 9);
}