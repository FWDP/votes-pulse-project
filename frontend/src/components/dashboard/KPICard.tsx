import type { LucideIcon } from "lucide-react";

export type KPIVariant =
  | "blue"
  | "green"
  | "red"
  | "amber"
  | "purple"
  | "slate";

export interface KPICardProps {
  slug: string;
  icon: LucideIcon;
  value: string | number;
  label: string;
  subtitle?: string;
  variant?: KPIVariant;
}

const variantStyles: Record<KPIVariant, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  purple: "bg-purple-50 text-purple-700",
  slate: "bg-slate-100 text-slate-700",
};

export default function KPICard({ icon: Icon, value, label, subtitle, variant = "amber" }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 flex items-start gap-2 sm:gap-4">
      <div
        className={`
          hidden sm:flex
          w-10 h-10
          rounded-lg
          items-center justify-center
          shrink-0
          ${variantStyles[variant]}
        `}
      >
        <Icon size={20} />
      </div>

      <div className="min-w-0">
        <div className="text-2xl font-black text-slate-800">
          {value}
        </div>

        <div className="text-base font-medium text-slate-700">
          {label}
        </div>

        {subtitle && (
          <div className="text-sm text-slate-500">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}