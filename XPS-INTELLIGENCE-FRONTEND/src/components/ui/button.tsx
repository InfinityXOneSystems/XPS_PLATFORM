import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive relative overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[oklch(0.94_0.22_95)] via-[oklch(0.90_0.20_88)] to-[oklch(0.94_0.22_95)] text-black shadow-[0_4px_20px_rgba(255,223,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:scale-[1.03] hover:shadow-[0_6px_30px_rgba(255,223,0,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105 active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
        destructive:
          "bg-destructive text-white shadow-[0_2px_12px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-destructive/90 hover:scale-[1.02] focus-visible:ring-destructive/20",
        outline:
          "border-2 border-border bg-background/50 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-muted hover:shadow-[0_4px_16px_rgba(212,175,55,0.2)] group/btn relative after:absolute after:inset-[-2px] after:rounded-xl after:opacity-0 after:transition-opacity after:duration-500 hover:after:opacity-100 after:pointer-events-none after:bg-[linear-gradient(90deg,var(--gold-1),var(--gold-2),var(--gold-3),var(--gold-1))] after:bg-[length:300%_100%] after:[animation:gold-gradient-shift_3s_ease-in-out_infinite] after:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] after:[mask-composite:exclude] after:p-[2px] after:-z-10",
        secondary:
          "bg-secondary/20 text-secondary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-secondary/30 border border-border hover:scale-[1.02]",
        ghost:
          "hover:bg-muted hover:text-foreground hover:scale-[1.02]",
        link: "text-gold underline-offset-4 hover:underline hover:text-gold-muted",
        maroon:
          "bg-gradient-to-r from-[oklch(0.48_0.16_25)] via-[oklch(0.42_0.14_20)] to-[oklch(0.48_0.16_25)] text-white shadow-[0_4px_16px_rgba(139,0,35,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-[1.03] hover:shadow-[0_6px_24px_rgba(139,0,35,0.6)] hover:brightness-110 border border-[rgba(139,0,35,0.3)] active:scale-[0.98]",
        silver:
          "bg-gradient-to-r from-[oklch(0.88_0_0)] via-[oklch(0.78_0_0)] to-[oklch(0.88_0_0)] text-black shadow-[0_4px_20px_rgba(192,192,192,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] hover:scale-[1.03] hover:shadow-[0_6px_30px_rgba(192,192,192,0.6)] hover:brightness-105 active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-xl px-6 has-[>svg]:px-4 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
