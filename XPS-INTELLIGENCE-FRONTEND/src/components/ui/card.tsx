import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-[18px] border-2 border-border-subtle py-6 backdrop-blur-[40px] saturate-[200%] relative group",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]",
        "transition-all duration-300",
        className
      )}
      {...props}
    >
      <div 
        className="absolute inset-[-2px] rounded-[18px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[1]" 
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
      <div 
        className="absolute inset-0 rounded-[18px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500 z-0"
        style={{
          boxShadow: '0 0 30px rgba(212, 175, 55, 0.3), 0 0 60px rgba(212, 175, 55, 0.15)',
          animation: 'gold-glow-pulse 2s ease-in-out infinite',
        }}
      />
      {props.children}
    </div>
  )
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
