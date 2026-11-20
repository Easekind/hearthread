// shadcn/ui New York button, using the edition's control styles.
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const buttonVariants = cva("button", {
  variants: {
    variant: {
      default: "",
      primary: "primary",
      destructive: "primary destructive",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Button({
  className,
  variant = "default",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      type="button"
      className={twMerge(clsx(buttonVariants({ variant }), className))}
      {...props}
    />
  );
}
