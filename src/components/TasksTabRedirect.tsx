import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Redirects /teams/:teamId/tasks to /teams/:teamId?tab=tasks
 * For backward compatibility with old task URLs
 */
export function TasksTabRedirect() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (teamId) {
      console.log(`[TasksTabRedirect] Redirecting /teams/${teamId}/tasks → /teams/${teamId}?tab=tasks`);
      navigate(`/teams/${teamId}?tab=tasks`, { replace: true });
    }
  }, [teamId, navigate]);

  return null;
}
