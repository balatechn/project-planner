import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [box-shadow:3px_3px_8px_rgba(0,0,0,0.25),-2px_-2px_6px_rgba(255,255,255,0.5)] hover:[box-shadow:4px_4px_10px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.5)] active:[box-shadow:inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-1px_-1px_4px_rgba(255,255,255,0.2)]",
        brand:
          "brand-gradient text-white [box-shadow:3px_3px_8px_rgba(0,0,0,0.2),-2px_-2px_6px_rgba(255,255,255,0.5)] hover:opacity-95 hover:[box-shadow:4px_4px_12px_rgba(0,0,0,0.25),-2px_-2px_6px_rgba(255,255,255,0.5)] active:[box-shadow:inset_2px_2px_5px_rgba(0,0,0,0.25)]",
        destructive:
          "bg-destructive text-destructive-foreground [box-shadow:3px_3px_8px_rgba(0,0,0,0.2),-2px_-2px_6px_rgba(255,255,255,0.4)] hover:bg-destructive/90 active:[box-shadow:inset_2px_2px_5px_rgba(0,0,0,0.25)]",
        outline:
          "bg-background text-foreground neu-card-sm hover:bg-secondary active:neu-inset-sm",
        secondary:
          "bg-secondary text-secondary-foreground neu-card-sm hover:bg-secondary/80 active:neu-inset-sm",
        ghost: "hover:bg-secondary/60 hover:text-foreground active:neu-inset-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
