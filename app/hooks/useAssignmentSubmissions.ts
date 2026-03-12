import { useCallback, useEffect, useState } from 'react';
import { getSubmissions } from '../firebase/assignmentService';

export type Submission = {
  id: string;
  marksObtained?: number;
  evaluatedAt?: unknown;
  evaluatedBy?: string;
};

export function useAssignmentSubmissions(subjectId: string | null, assignmentId: string | null) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(!!(subjectId && assignmentId));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!subjectId || !assignmentId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getSubmissions(subjectId, assignmentId);
      setSubmissions(list as Submission[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, assignmentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
