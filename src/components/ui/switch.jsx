import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[21px] w-[36px] shrink-0 cursor-pointer items-center rounded-[99px] border-none p-0 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-[#fafafa] data-[state=unchecked]:bg-[rgba(148,163,184,0.25)]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-[16px] w-[16px] rounded-[99px] transition-transform',
          'data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[3px]',
          'data-[state=checked]:bg-[#0a0a0a] data-[state=unchecked]:bg-[#cbd5e1]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
