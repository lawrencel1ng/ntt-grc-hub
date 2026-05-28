import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const _toasts = writable<Toast[]>([]);
let _id = 0;

export const toasts = { subscribe: _toasts.subscribe };

export function addToast(kind: Toast['kind'], message: string, ttl = 4000) {
  const id = ++_id;
  _toasts.update((t) => [...t, { id, kind, message }]);
  setTimeout(() => _toasts.update((t) => t.filter((x) => x.id !== id)), ttl);
}
