interface TopicMomentumProps {
    label: string
    values: number[]
}

const WIDTH = 78
const HEIGHT = 28
const PADDING = 2

export default function TopicMomentum({
    label,
    values,
}: TopicMomentumProps) {
    if (values.length < 2) {
        return <span className="text-xs text-slate-400">Unavailable</span>
    }

    const minimum = Math.min(...values)
    const maximum = Math.max(...values)
    const range = Math.max(maximum - minimum, 1)
    const projected = values.map((value, index) => ({
        x: PADDING +
            (index / (values.length - 1)) * (WIDTH - PADDING * 2),
        y: PADDING +
            ((maximum - value) / range) * (HEIGHT - PADDING * 2),
    }))
    const first = values[0]
    const last = values.at(-1) ?? first
    const change = first === 0
        ? 0
        : Math.round(((last - first) / first) * 100)
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    const color = direction === 'up'
        ? '#166534'
        : direction === 'down'
            ? '#991b1b'
            : '#334155'

    return (
        <div
            className="flex items-center gap-2"
            role="img"
            aria-label={`${label} illustrative momentum is ${direction}, ${Math.abs(change)} percent`}
        >
            <svg
                width={WIDTH}
                height={HEIGHT}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                aria-hidden="true"
                className="overflow-visible"
            >
                <polyline
                    points={projected.map(point =>
                        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
                    ).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx={projected.at(-1)?.x}
                    cy={projected.at(-1)?.y}
                    r="2.5"
                    fill={color}
                />
            </svg>

            <span
                className="min-w-9 text-right text-[11px] font-bold tabular-nums"
                style={{ color }}
            >
                {change > 0 ? '+' : ''}{change}%
            </span>
        </div>
    )
}
