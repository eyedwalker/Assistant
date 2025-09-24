import * as React from "react"
import { clsx } from "clsx"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const badgeVariants = {
  default: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-200",
  destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
  outline: "text-gray-950 border-gray-200 bg-white hover:bg-gray-100",
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
