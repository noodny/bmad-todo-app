// Duplicated locally per AR23 — do NOT import from server. Matches the
// server's wire-shape (camelCase, boolean, epoch-ms `createdAt`).
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}
