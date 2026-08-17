import type {
    SelectHTMLAttributes,
} from 'react'

interface SelectFieldProps
    extends SelectHTMLAttributes<HTMLSelectElement> {
    label: string
}

export function SelectField({
    label,
    children,
    className = '',
    ...props
}: SelectFieldProps) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700">
                {label}
            </span>

            <select
                {...props}
                className={`
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    px-3
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    focus:border-slate-400
                    focus:ring-2
                    focus:ring-slate-100
                    disabled:cursor-not-allowed
                    disabled:bg-slate-100
                    disabled:text-slate-400
                    ${className}
                `}
            >
                {children}
            </select>
        </label>
    )
}