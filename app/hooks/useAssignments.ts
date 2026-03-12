import { useCallback, useEffect, useState } from 'react';
import { getAssignments } from '../firebase/assignmentService';

export type Assignment = {
  id: string;
  assignmentName: string;
  totalMarks: number;
  description?: string | null;
  dueDate?: string | null;
  marksVisible: boolean;
  createdAt?: unknown;
};

export function useAssignments(subjectId: string | null) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(!!subjectId);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!subjectId) {
      setAssignments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getAssignments(subjectId);
      setAssignments(list as Assignment[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignments, loading, error, refresh };
}
