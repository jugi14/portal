export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 4:
      return 'Urgent';
    case 3:
      return 'High';
    case 2:
      return 'Medium';
    case 1:
      return 'Low';
    default:
      return 'None';
  }
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getStateColor(stateType: string): string {
  switch (stateType) {
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'canceled':
      return 'text-red-600 dark:text-red-400';
    case 'started':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-yellow-600 dark:text-yellow-400';
  }
}

export function getStateBadgeVariant(stateType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (stateType) {
    case 'completed':
      return 'default';
    case 'canceled':
      return 'destructive';
    case 'started':
      return 'secondary';
    default:
      return 'outline';
  }
}
