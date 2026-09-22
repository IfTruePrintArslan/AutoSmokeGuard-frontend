import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '../../lib/utils'

function Slider({ className, 'aria-label': ariaLabel = 'Slider', ...props }) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-[99px] bg-[rgba(148,163,184,0.15)]">
        <SliderPrimitive.Range className="absolute h-full rounded-[99px] bg-[#e5e5e5]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block h-[15px] w-[15px] rounded-[99px] bg-[#fafafa] shadow-[0_0_0_4px_rgba(255,255,255,0.25)] outline-none cursor-pointer',
          'transition-shadow focus-visible:shadow-[0_0_0_5px_rgba(255,255,255,0.35)]',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
        aria-label={ariaLabel}
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
