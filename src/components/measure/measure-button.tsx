"use client";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,opacity,background-color,color] duration-150 ease-out select-none disabled:opacity-40 disabled:pointer-events-none active:not-disabled:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:opacity-90",
        accent: "bg-primary text-primary-foreground hover:opacity-90",
        ghost: "bg-transparent text-ink hover:bg-ink/6",
        chrome:
          "bg-transparent text-ink hover:bg-ink/6 data-[active=true]:bg-ink data-[active=true]:text-paper",
        outline: "bg-transparent text-ink shadow-[var(--shadow-border)] hover:bg-ink/4",
        danger: "bg-danger text-paper hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-[10px]",
        md: "h-11 px-4 text-sm rounded-xl",
        lg: "h-12 px-5 text-base rounded-xl",
        icon: "size-11 rounded-xl",
        dock: "size-12 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { static?: boolean };

export function Button({
  className,
  variant,
  size,
  static: isStatic,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        isStatic && "active:scale-100",
        className,
      )}
      {...props}
    />
  );
}

export { buttonVariants };
