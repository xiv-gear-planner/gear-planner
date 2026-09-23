import * as os from "node:os";
import * as process from "node:process";
import * as v8 from "node:v8";

const MEMORY_STATS_INTERVAL_MS = 5 * 60 * 1000;
const BYTES_PER_MIB = 1024 * 1024;

type MemorySection = {
    readonly label: string;
    readonly bytes?: () => number;
    readonly committed?: () => number;
    readonly max?: () => number;
    readonly value?: () => string | number;
} | {
    readonly label: string;
    readonly children: readonly MemorySection[];
};

const HEAP_SPACE_NAMES = [
    "read_only_space",
    "new_space",
    "old_space",
    "code_space",
    "shared_space",
    "trusted_space",
    "shared_trusted_space",
    "new_large_object_space",
    "large_object_space",
    "code_large_object_space",
    "shared_large_object_space",
    "shared_trusted_large_object_space",
    "trusted_large_object_space",
] as const;

function heapSpaceValue(name: string, field: "space_used_size" | "space_size"): () => number {
    return () => v8.getHeapSpaceStatistics().find((space) => space.space_name === name)?.[field] ?? 0;
}

function heapSpace(name: string): MemorySection {
    return {
        label: name,
        bytes: heapSpaceValue(name, "space_used_size"),
        committed: heapSpaceValue(name, "space_size"),
        max: heapSpaceValue(name, "space_size"),
    };
}

const MEMORY_SECTIONS: readonly MemorySection[] = [
    {
        label: "system",
        children: [
            {label: "rss", bytes: () => process.resourceUsage().maxRSS * 1024},
            {label: "capacity", bytes: () => os.totalmem()},
            {label: "free", bytes: () => os.freemem()},
        ],
    },
    {
        label: "other",
        children: [
            {label: "rss", bytes: () => process.memoryUsage().rss},
            {label: "external", bytes: () => process.memoryUsage().external},
            {label: "arrayBuffers", bytes: () => process.memoryUsage().arrayBuffers},
        ],
    },
    {
        label: "heap",
        bytes: () => process.memoryUsage().heapUsed,
        committed: () => process.memoryUsage().heapTotal,
        max: () => v8.getHeapStatistics().heap_size_limit,
    },
    {
        label: "v8",
        children: [
            {label: "malloced", bytes: () => v8.getHeapStatistics().malloced_memory},
            {label: "peakMalloced", bytes: () => v8.getHeapStatistics().peak_malloced_memory},
            {label: "nativeContexts", value: () => v8.getHeapStatistics().number_of_native_contexts},
            {label: "detachedContexts", value: () => v8.getHeapStatistics().number_of_detached_contexts},
            {label: "external", bytes: () => v8.getHeapStatistics().external_memory},
            {label: "code", bytes: () => v8.getHeapCodeStatistics().code_and_metadata_size},
            {label: "bytecode", bytes: () => v8.getHeapCodeStatistics().bytecode_and_metadata_size},
            {
                label: "spaces",
                children: HEAP_SPACE_NAMES.map(heapSpace),
            },
        ],
    },
];

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "unknown";
    }
    return `${(bytes / BYTES_PER_MIB).toFixed(1)}MiB`;
}

function formatUsage(used: number, committed: number, max: number): string {
    const usage = `${formatBytes(used)} / ${formatBytes(committed)}`;
    if (max < 0) {
        return `${usage} (max unknown)`;
    }
    const usedPercent = max === 0 ? 0 : (used / max * 100).toFixed(1);
    const committedPercent = max === 0 ? 0 : (committed / max * 100).toFixed(1);
    return `${formatBytes(used)} (${usedPercent}%) / ${formatBytes(committed)} (${committedPercent}%) / ${formatBytes(max)}`;
}

function serializeSection(section: MemorySection): Record<string, unknown> | string | number | null {
    if ("children" in section) {
        return Object.fromEntries(section.children.map((child) => [
            child.label,
            serializeSection(child),
        ]));
    }

    const bytes = section.bytes?.();
    if (bytes !== undefined && (section.committed || section.max)) {
        return formatUsage(bytes, section.committed?.() ?? bytes, section.max?.() ?? -1);
    }
    if (bytes !== undefined) {
        return formatBytes(bytes);
    }
    return section.value?.() ?? null;
}

export function logMemoryStats(): void {
    const memory = Object.fromEntries(MEMORY_SECTIONS.map((section) => [
        section.label,
        serializeSection(section),
    ]));
    console.info("Memory stats: " + JSON.stringify(memory));
}

export function startPeriodicMemoryMonitor(): NodeJS.Timeout {
    logMemoryStats();
    const interval = setInterval(logMemoryStats, MEMORY_STATS_INTERVAL_MS);
    interval.unref();
    return interval;
}
