import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageBannerProps {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function PageBanner({ icon, message, action, className }: PageBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-center gap-3 transition-opacity duration-200 ease-out",
        className,
      )}
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <p className="flex-1 text-sm">{message}</p>
      {action}
    </div>
  );
}

export default PageBanner;
