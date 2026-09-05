import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: Variant = "secondary", size: "md" | "sm" = "md") {
  const variantClass = {
    primary: "ox-btn-primary",
    secondary: "ox-btn-secondary",
    ghost: "ox-btn-ghost",
    danger: "ox-btn-danger",
  }[variant];
  return `ox-btn ox-focus-ring ${variantClass} ${size === "sm" ? "ox-btn-sm" : ""}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "sm" }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
