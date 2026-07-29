import type { TaskPriority } from '../../types'

interface Props {
  priority: TaskPriority
}

const CONFIG: Record<TaskPriority, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-400' },
  medium: { label: 'Med',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' },
  high:   { label: 'High',   cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' },
}

export function PriorityBadge({ priority }: Props) {
  const { label, cls } = CONFIG[priority]
  return (
    <span className={`badge ${cls}`}>{label}</span>
  )
}
