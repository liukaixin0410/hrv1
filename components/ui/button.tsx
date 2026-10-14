import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "accent"
  | "destructive"
  | "success"
  | "outline"
  | "secondary"
  | "ghost";

type Size = "default" | "sm" | "xs" | "icon";

const variantClasses: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 shadow-green-900/10",
  accent:
    "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 shadow-blue-900/10",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  success:
    "bg-success text-success-foreground shadow-sm hover:bg-success/90",
  outline:
    "border border-input bg-white shadow-sm hover:bg-accent/5 hover:text-accent",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "hover:bg-muted hover:text-foreground",
};

const sizeClasses: Record<Size, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-sm",
  xs: "h-7 px-2.5 text-xs",
  icon: "h-9 w-9",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", loading, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
