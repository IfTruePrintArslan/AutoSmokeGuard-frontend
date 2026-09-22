import { cn } from '../../lib/utils'

export default function Spinner({ className = '', size = 16, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block shrink-0 rounded-full border-2 border-white/20 border-t-text animate-spin',
        className
      )}
      style={{ width: size, height: size, animationDuration: '0.7s' }}
    />
  )
}
