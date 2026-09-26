import { cn } from '../../lib/utils'

export default function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-[8px] bg-surface-2', className)}
    />
  )
}
