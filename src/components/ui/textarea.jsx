import * as React from "react"
import { cn } from "../../lib/utils"

const Textarea = React.forwardRef(({ className, placeholder = "Enter text here...", defaultValue = '', ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200 ease-in-out focus:border-primary focus:ring-primary focus-visible:ring-offset-background",
        className
      )}
      ref={ref}
      defaultValue={defaultValue || ''}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
