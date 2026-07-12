import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | number;
}

export default function Logo({ className = "", size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-11 h-11",
  };

  const actualSize = typeof size === "number" ? `${size}px` : undefined;
  const sizeStyle = actualSize ? { width: actualSize, height: actualSize } : {};
  const computedClass = typeof size === "string" ? sizeClasses[size] : "";

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${computedClass} ${className}`}
      style={sizeStyle}
    >
      {/* Golden crystalline facet representing mineral and earth wealth */}
      <path
        d="M22 72 L50 18 L50 72 Z"
        fill="url(#gold-gradient-1)"
        opacity="0.95"
      />
      {/* Light golden facet representing energy and gas reserves */}
      <path
        d="M50 18 L78 72 L50 72 Z"
        fill="url(#gold-gradient-2)"
        opacity="0.95"
      />
      {/* Fluid ocean wave layer cutting across representing marine fisheries & the blue economy */}
      <path
        d="M12 76 C 32 68, 68 84, 88 76 L 84 83 C 64 91, 28 75, 16 83 Z"
        fill="url(#gold-gradient-3)"
      />
      
      {/* Defs containing rich metallic gold gradients */}
      <defs>
        <linearGradient id="gold-gradient-1" x1="22" y1="18" x2="50" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" /> {/* Amber 500 */}
          <stop offset="100%" stopColor="#d97706" /> {/* Amber 600 */}
        </linearGradient>
        <linearGradient id="gold-gradient-2" x1="78" y1="18" x2="50" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" /> {/* Amber 400 */}
          <stop offset="100%" stopColor="#b45309" /> {/* Amber 700 */}
        </linearGradient>
        <linearGradient id="gold-gradient-3" x1="12" y1="76" x2="88" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d97706" /> {/* Amber 600 */}
          <stop offset="100%" stopColor="#fbbf24" /> {/* Amber 400 */}
        </linearGradient>
      </defs>
    </svg>
  );
}
