import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type EpochUnit = 'seconds' | 'milliseconds' | 'microseconds';
type DateSource = 'picker' | 'text';

interface EpochParse {
    date: Date | null;
    unit: EpochUnit | null;
    error: string | null;
}

interface DateParse {
    date: Date | null;
    error: string | null;
}

interface ZoneRow {
    label: string;
    zone: string;
    formatted: string;
}

/** Timezones surfaced in the conversion table. */
const ZONES: { label: string; zone: string }[] = [
    { label: 'UTC', zone: 'UTC' },
    { label: 'New York', zone: 'America/New_York' },
    { label: 'London', zone: 'Europe/London' },
    { label: 'Berlin', zone: 'Europe/Berlin' },
    { label: 'Karachi', zone: 'Asia/Karachi' },
    { label: 'Kolkata', zone: 'Asia/Kolkata' },
    { label: 'Tokyo', zone: 'Asia/Tokyo' },
    { label: 'Sydney', zone: 'Australia/Sydney' },
];

@Component({
    selector: 'app-timestamp',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './timestamp.component.html',
    styleUrl: './timestamp.component.scss',
})
export class TimestampComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    // --- Live "now" panel ---------------------------------------------------
    readonly now = signal<Date>(new Date());
    private tick: ReturnType<typeof setInterval> | null = null;

    readonly nowEpochSec = computed(() => Math.floor(this.now().getTime() / 1000).toString());
    readonly nowEpochMs = computed(() => this.now().getTime().toString());
    readonly nowIso = computed(() => this.now().toISOString());
    readonly nowLocal = computed(() => this.now().toLocaleString());

    // --- Epoch → date ---------------------------------------------------------
    readonly epochInput = signal('');

    private readonly epochParse = computed<EpochParse>(() => {
        const raw = this.epochInput().trim();
        if (!raw) return { date: null, unit: null, error: null };
        const v = Number(raw);
        if (!isFinite(v)) return { date: null, unit: null, error: 'Enter a numeric epoch value.' };

        // Auto-detect the unit from magnitude: |v| < 1e11 → seconds (covers
        // dates up to year ~5138), < 1e14 → milliseconds, otherwise microseconds.
        const abs = Math.abs(v);
        let ms: number;
        let unit: EpochUnit;
        if (abs < 1e11) {
            unit = 'seconds';
            ms = v * 1000;
        } else if (abs < 1e14) {
            unit = 'milliseconds';
            ms = v;
        } else {
            unit = 'microseconds';
            ms = v / 1000;
        }
        const date = new Date(ms);
        if (isNaN(date.getTime())) {
            return { date: null, unit, error: 'That value falls outside the representable date range.' };
        }
        return { date, unit, error: null };
    });

    readonly epochDate = computed(() => this.epochParse().date);
    readonly epochUnit = computed(() => this.epochParse().unit);
    readonly epochError = computed(() => this.epochParse().error);

    readonly epochIsoUtc = computed(() => this.epochDate()?.toISOString() ?? '');
    readonly epochLocal = computed(() => this.epochDate()?.toLocaleString() ?? '');
    readonly epochWeekday = computed(() => {
        const d = this.epochDate();
        return d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : '';
    });
    readonly epochRelative = computed(() => {
        const d = this.epochDate();
        return d ? this.relativeTo(d, this.now()) : '';
    });

    // --- Date → epoch ---------------------------------------------------------
    readonly pickerInput = signal('');
    readonly textInput = signal('');
    /** Which of the two date inputs was touched last decides what gets parsed. */
    readonly dateSource = signal<DateSource>('picker');

    private readonly dateParse = computed<DateParse>(() => {
        const source = this.dateSource();
        const raw = source === 'picker' ? this.pickerInput() : this.textInput().trim();
        if (!raw) return { date: null, error: null };
        // Native Date parsing only — datetime-local values ("2026-07-04T12:30")
        // are interpreted as local time; free text follows the engine's rules.
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
            return { date: null, error: 'Could not parse that date. Try an ISO string like 2026-07-04T12:30:00Z.' };
        }
        return { date: d, error: null };
    });

    readonly dateResult = computed(() => this.dateParse().date);
    readonly dateError = computed(() => this.dateParse().error);
    readonly dateEpochSec = computed(() => {
        const d = this.dateResult();
        return d ? Math.floor(d.getTime() / 1000).toString() : '';
    });
    readonly dateEpochMs = computed(() => {
        const d = this.dateResult();
        return d ? d.getTime().toString() : '';
    });

    // --- Timezone table --------------------------------------------------------
    /** Which converter last produced a moment, so the table follows the user. */
    readonly lastConverted = signal<'epoch' | 'date' | null>(null);

    readonly tzMoment = computed<Date>(() => {
        const preferred = this.lastConverted();
        const fromEpoch = this.epochDate();
        const fromDate = this.dateResult();
        if (preferred === 'date') return fromDate ?? fromEpoch ?? this.now();
        return fromEpoch ?? fromDate ?? this.now();
    });

    readonly tzIsLive = computed(() => !this.epochDate() && !this.dateResult());

    readonly tzRows = computed<ZoneRow[]>(() => {
        const moment = this.tzMoment();
        return ZONES.map(({ label, zone }) => {
            let formatted: string;
            try {
                formatted = new Intl.DateTimeFormat('en-GB', {
                    timeZone: zone,
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZoneName: 'short',
                }).format(moment);
            } catch {
                // Environment lacks tz data for this zone (rare, but possible on
                // slim ICU builds) — degrade gracefully instead of crashing.
                formatted = 'Unavailable in this environment';
            }
            return { label, zone, formatted };
        });
    });

    // --- Copy feedback -----------------------------------------------------------
    readonly copied = signal<string | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Timestamp Converter | Dev Tools',
            description:
                'Convert Unix epochs (seconds, milliseconds or microseconds) to human-readable dates and back, with a live clock, relative time and a world timezone table. Free, client-side timestamp converter.',
            url: '/tools/timestamp',
            keywords: 'timestamp converter, unix epoch converter, epoch to date, date to epoch, unix time, timezone converter, iso 8601',
        });

        // Ticking clock is browser-only; on the server we render a static moment.
        if (isPlatformBrowser(this.platformId)) {
            this.tick = setInterval(() => this.now.set(new Date()), 1000);
        }
    }

    ngOnDestroy(): void {
        if (this.tick !== null) {
            clearInterval(this.tick);
            this.tick = null;
        }
    }

    // --- Explicit-action handlers -------------------------------------------------
    /** Results are live; the change events just mark the source + report usage. */
    epochConverted(): void {
        if (!this.epochDate()) return;
        this.lastConverted.set('epoch');
        this.api.reportUsage({
            toolId: 'timestamp',
            action: 'convert',
            metadata: { direction: 'epoch-to-date', unit: this.epochUnit() },
        });
    }

    dateConverted(source: DateSource): void {
        this.dateSource.set(source);
        if (!this.dateResult()) return;
        this.lastConverted.set('date');
        this.api.reportUsage({
            toolId: 'timestamp',
            action: 'convert',
            metadata: { direction: 'date-to-epoch', source },
        });
    }

    setDateSource(source: DateSource): void {
        this.dateSource.set(source);
    }

    async copy(key: string, value: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !value) return;
        if (await copyText(value)) {
            this.copied.set(key);
            setTimeout(() => this.copied.set(null), 1400);
            this.api.reportUsage({ toolId: 'timestamp', action: 'copy', metadata: { which: key } });
        }
    }

    // --- Helpers -------------------------------------------------------------------
    /** "3 hours ago" / "in 2 days" via Intl.RelativeTimeFormat, largest unit first. */
    private relativeTo(date: Date, now: Date): string {
        const diffMs = date.getTime() - now.getTime();
        const abs = Math.abs(diffMs);
        const units: [Intl.RelativeTimeFormatUnit, number][] = [
            ['year', 31_536_000_000],
            ['month', 2_592_000_000],
            ['week', 604_800_000],
            ['day', 86_400_000],
            ['hour', 3_600_000],
            ['minute', 60_000],
            ['second', 1_000],
        ];
        try {
            const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
            for (const [unit, ms] of units) {
                if (abs >= ms || unit === 'second') {
                    return rtf.format(Math.round(diffMs / ms), unit);
                }
            }
        } catch {
            // Intl.RelativeTimeFormat unavailable — skip the relative view.
        }
        return '';
    }
}
