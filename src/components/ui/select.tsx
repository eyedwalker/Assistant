import * as React from "react"
import { clsx } from "clsx"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <select
        className={clsx(
          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:focus:ring-gray-300",
          className
        )}
        onChange={(e) => onValueChange?.(e.target.value)}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
)

const SelectItem = React.forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  ({ className, ...props }, ref) => (
    <option
      ref={ref}
      className={clsx("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100", className)}
      {...props}
    />
  )
)
SelectItem.displayName = "SelectItem"

const SelectValue = ({ placeholder, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) => (
  <span {...props}>{children || placeholder}</span>
)

const SelectTrigger = Select
const SelectLabel = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props}>{children}</label>
)

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel }
