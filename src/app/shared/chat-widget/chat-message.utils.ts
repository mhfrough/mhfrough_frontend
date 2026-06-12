/** Formats a duration in whole seconds as `mm:ss`, used by chat audio recorders. */
export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * Plain-text caption for a lightbox preview of a chat message.
 * Uses DOMParser (never attaches to the document) to strip HTML tags safely.
 */
export function lightboxCaption(msg: { content?: string | null } | null): string {
    if (!msg?.content) return '';
    if (msg.content.startsWith('[File:') && msg.content.endsWith(']')) return '';
    const doc = new DOMParser().parseFromString(msg.content, 'text/html');
    return doc.body.textContent?.trim() ?? '';
}

export interface ReminderInfo {
    appointmentId: string;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
}

/** Parses the JSON payload of a `reminder`-type chat message, if valid. */
export function parseReminder(content: string): ReminderInfo | null {
    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.title === 'string' && typeof parsed.date === 'string' && typeof parsed.startTime === 'string') {
            return {
                appointmentId: parsed.appointmentId,
                title: parsed.title,
                date: parsed.date,
                startTime: parsed.startTime,
                durationMinutes: parsed.durationMinutes ?? 30,
            };
        }
    } catch {
        // not a reminder payload
    }
    return null;
}

/** Formats a reminder's date + time as e.g. "Tue, 17 Jun · 3:00 PM". */
export function formatReminderDateTime(date: string, startTime: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = startTime.split(':').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0);
    const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateStr} · ${timeStr}`;
}

/** Formats a duration in minutes as e.g. "30 min" or "1h 30m". */
export function formatReminderDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
