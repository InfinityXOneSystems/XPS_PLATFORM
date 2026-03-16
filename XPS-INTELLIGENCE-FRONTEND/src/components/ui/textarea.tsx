import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <div className="relative inline-block w-full">
      <textarea
        data-slot="textarea"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:ring-0 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl border-2 bg-input/30 backdrop-blur-sm px-3 py-2 text-base shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm relative z-10 peer",
          "hover:shadow-[0_4px_16px_rgba(212,175,55,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]",
          "focus-visible:shadow-[0_6px_20px_rgba(212,175,55,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]",
          className
        )}
        {...props}
      />
      <div 
        className="absolute inset-[-2px] rounded-xl pointer-events-none opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-500 z-0" 
        style={{ 
          background: 'linear-gradient(90deg, var(--gold-1), var(--gold-2), var(--gold-3), var(--gold-1))',
          backgroundSize: '300% 100%',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '2px',
          animation: 'gold-gradient-shift 3s ease-in-out infinite',
        }}
      />
    </div>
  )
}

export { Textarea }
