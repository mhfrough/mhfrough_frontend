import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppointmentsService, Appointment, AppointmentStatus, CreateAppointmentPayload } from '../../../core/services/appointments.service';
import { LeadsService } from '../../../core/services/leads.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

interface CalendarDay {
    date: Date;
    dateStr: string;
    isToday: boolean;
    isCurrentMonth: boolean;
    appointments: Appointment[];
}

@Component({
    selector: 'app-admin-appointments',
    standalone: true,
    imports: [CommonModule, FormsModule, ConfirmModalComponent],
    templateUrl: './admin-appointments.component.html',
    styleUrl: './admin-appointments.component.scss',
})
export class AdminAppointmentsComponent implements OnInit, OnDestroy {
    private readonly svc = inject(AppointmentsService);
    private readonly leads = inject(LeadsService);
    private readonly route = inject(ActivatedRoute);
    private readonly realtime = inject(RealtimeService);
    private readonly subs: Subscription[] = [];

    // ── View ────────────────────────────────────────────────────────────────
    readonly view = signal<'calendar' | 'list'>('calendar');

    // ── Calendar data ────────────────────────────────────────────────────────
    readonly calendarAppts = signal<Appointment[]>([]);
    readonly calendarLoading = signal(false);
    readonly calendarDate = signal(new Date());
    readonly selectedDay = signal<string | null>(null);
    readonly showDayModal = signal(false);

    // ── List data ────────────────────────────────────────────────────────────
    readonly listAppts = signal<Appointment[]>([]);
    readonly listLoading = signal(false);
    private listLoaded = false;

    // ── Alert ────────────────────────────────────────────────────────────────
    readonly alertDismissed = signal(false);

    // ── List filters & pagination ────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly filterStatus = signal<AppointmentStatus | 'all'>('all');
    readonly filterFrom = signal('');
    readonly filterTo = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    readonly filteredList = computed(() => {
        let list = this.listAppts();
        const status = this.filterStatus();
        if (status !== 'all') list = list.filter(a => a.status === status);
        const from = this.filterFrom();
        if (from) list = list.filter(a => a.date >= from);
        const to = this.filterTo();
        if (to) list = list.filter(a => a.date <= to);
        const q = this.searchQuery().toLowerCase().trim();
        if (q) list = list.filter(a =>
            a.title.toLowerCase().includes(q) ||
            (a.clientName ?? '').toLowerCase().includes(q) ||
            (a.clientEmail ?? '').toLowerCase().includes(q)
        );
        return list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    });

    readonly pagedList = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredList().slice(start, start + this.pageSize());
    });

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredList().length / this.pageSize()))
    );

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    // ── Calendar computed ────────────────────────────────────────────────────
    readonly calendarDays = computed<CalendarDay[]>(() => {
        const appts = this.calendarAppts();
        const ref = this.calendarDate();
        const year = ref.getFullYear();
        const month = ref.getMonth();
        const today = this.toDateStr(new Date());
        const firstOfMonth = new Date(year, month, 1);
        const startDay = firstOfMonth.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days: CalendarDay[] = [];
        for (let i = startDay - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, daysInPrevMonth - i);
            const ds = this.toDateStr(d);
            days.push({ date: d, dateStr: ds, isToday: ds === today, isCurrentMonth: false, appointments: [] });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const ds = this.toDateStr(date);
            days.push({ date, dateStr: ds, isToday: ds === today, isCurrentMonth: true, appointments: appts.filter(a => a.date === ds) });
        }
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const date = new Date(year, month + 1, d);
            const ds = this.toDateStr(date);
            days.push({ date, dateStr: ds, isToday: ds === today, isCurrentMonth: false, appointments: [] });
        }
        return days;
    });

    readonly calendarMonthLabel = computed(() =>
        this.calendarDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    );

    readonly selectedDayAppts = computed(() => {
        const day = this.selectedDay();
        if (!day) return [];
        return this.calendarAppts().filter(a => a.date === day);
    });

    readonly selectedDayLabel = computed(() => {
        const d = this.selectedDay();
        if (!d) return '';
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    });

    readonly upcomingToday = computed(() => {
        const today = this.toDateStr(new Date());
        const src = this.listLoaded ? this.listAppts() : this.calendarAppts();
        return src.filter(a => a.date === today && (a.status === 'confirmed' || a.status === 'pending'));
    });

    // ── Form modal ──────────────────────────────────────────────────────────
    readonly showForm = signal(false);
    readonly editingId = signal<string | null>(null);
    readonly formSaving = signal(false);
    readonly formError = signal('');
    form: CreateAppointmentPayload = this.blankForm();

    // ── Delete ──────────────────────────────────────────────────────────────
    readonly deleteTargetId = signal<string | null>(null);

    readonly WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    readonly STATUS_LABELS: Record<AppointmentStatus, string> = {
        pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed',
    };

    ngOnInit() {
        this.loadCalendarMonth();
        this.loadAllList();
        this.realtime.connect().then(() => this.realtime.joinAdmin());

        const leadId = this.route.snapshot.queryParamMap.get('leadId');
        if (leadId) {
            this.leads.getOne(leadId).subscribe(lead => {
                this.openCreateForm();
                this.form = {
                    ...this.form,
                    clientName: lead.name,
                    clientEmail: lead.email,
                    clientPhone: lead.phone ?? '',
                    leadId: lead.id,
                };
            });
        }
        this.subs.push(
            this.realtime.on<Appointment>('reminder:created').subscribe(r => {
                this.addToCalendarIfMonth(r);
                this.listAppts.update(list => list.find(a => a.id === r.id) ? list : [r, ...list]);
            }),
            this.realtime.on<Appointment>('reminder:updated').subscribe(r => {
                this.calendarAppts.update(list => list.map(a => a.id === r.id ? r : a));
                this.listAppts.update(list => list.map(a => a.id === r.id ? r : a));
            }),
            this.realtime.on<{ id: string }>('reminder:deleted').subscribe(({ id }) => {
                this.calendarAppts.update(list => list.filter(a => a.id !== id));
                this.listAppts.update(list => list.filter(a => a.id !== id));
            }),
        );
    }

    ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

    // ── Data loading ─────────────────────────────────────────────────────────
    loadCalendarMonth() {
        const d = this.calendarDate();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        this.calendarLoading.set(true);
        this.svc.getByMonth(year, month).subscribe({
            next: appts => { this.calendarAppts.set(appts); this.calendarLoading.set(false); },
            error: () => this.calendarLoading.set(false),
        });
    }

    loadAllList() {
        this.listLoading.set(true);
        this.svc.getAll().subscribe({
            next: appts => { this.listAppts.set(appts); this.listLoading.set(false); this.listLoaded = true; },
            error: () => this.listLoading.set(false),
        });
    }

    private addToCalendarIfMonth(r: Appointment) {
        const d = this.calendarDate();
        const [ry, rm] = r.date.split('-').map(Number);
        if (ry === d.getFullYear() && rm === d.getMonth() + 1) {
            this.calendarAppts.update(list => list.find(a => a.id === r.id) ? list : [r, ...list]);
        }
    }

    // ── Calendar navigation ──────────────────────────────────────────────────
    prevMonth() {
        const d = this.calendarDate();
        this.calendarDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
        this.selectedDay.set(null);
        this.loadCalendarMonth();
    }

    nextMonth() {
        const d = this.calendarDate();
        this.calendarDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
        this.selectedDay.set(null);
        this.loadCalendarMonth();
    }

    goToToday() {
        const today = new Date();
        const d = this.calendarDate();
        this.calendarDate.set(new Date(today.getFullYear(), today.getMonth(), 1));
        this.selectedDay.set(null);
        if (d.getFullYear() !== today.getFullYear() || d.getMonth() !== today.getMonth()) {
            this.loadCalendarMonth();
        }
    }

    selectDay(day: CalendarDay) {
        this.selectedDay.set(day.dateStr);
        this.showDayModal.set(true);
    }

    closeDayModal() { this.showDayModal.set(false); }

    // ── View switch ──────────────────────────────────────────────────────────
    switchView(v: 'calendar' | 'list') {
        this.view.set(v);
    }

    // ── List search/page ─────────────────────────────────────────────────────
    onSearch(e: Event) {
        this.searchQuery.set((e.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
    }

    onFilterChange() { this.currentPage.set(1); }

    clearDateRange() { this.filterFrom.set(''); this.filterTo.set(''); this.currentPage.set(1); }

    // ── Form ─────────────────────────────────────────────────────────────────
    openCreateForm(dateStr?: string) {
        this.editingId.set(null);
        this.form = this.blankForm(dateStr);
        this.formError.set('');
        this.showDayModal.set(false);
        this.showForm.set(true);
    }

    openEditForm(appt: Appointment) {
        this.editingId.set(appt.id);
        this.form = {
            title: appt.title,
            clientName: appt.clientName ?? '',
            clientEmail: appt.clientEmail ?? '',
            clientPhone: appt.clientPhone ?? '',
            date: appt.date,
            startTime: appt.startTime,
            durationMinutes: appt.durationMinutes,
            notes: appt.notes ?? '',
            status: appt.status,
        };
        this.formError.set('');
        this.showDayModal.set(false);
        this.showForm.set(true);
    }

    closeForm() { this.showForm.set(false); this.formError.set(''); }

    saveForm() {
        if (!this.form.title || !this.form.date || !this.form.startTime) {
            this.formError.set('Title, date and time are required.');
            return;
        }
        this.formSaving.set(true);
        const id = this.editingId();
        const obs = id ? this.svc.update(id, this.form) : this.svc.create(this.form);
        obs.subscribe({
            next: (saved) => {
                this.formSaving.set(false);
                this.addToCalendarIfMonth(saved);
                if (id) {
                    this.calendarAppts.update(list => list.map(a => a.id === id ? saved : a));
                    this.listAppts.update(list => list.map(a => a.id === id ? saved : a));
                } else {
                    this.listAppts.update(list => [saved, ...list]);
                }
                this.closeForm();
            },
            error: () => { this.formSaving.set(false); this.formError.set('Failed to save. Please try again.'); },
        });
    }

    // ── Status change ────────────────────────────────────────────────────────
    changeStatus(appt: Appointment, status: AppointmentStatus) {
        if (!status || status === appt.status) return;
        this.svc.update(appt.id, { status }).subscribe(saved => {
            this.calendarAppts.update(list => list.map(a => a.id === saved.id ? saved : a));
            this.listAppts.update(list => list.map(a => a.id === saved.id ? saved : a));
        });
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }
    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.svc.remove(id).subscribe(() => {
            this.calendarAppts.update(list => list.filter(a => a.id !== id));
            this.listAppts.update(list => list.filter(a => a.id !== id));
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private toDateStr(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    private blankForm(date = ''): CreateAppointmentPayload {
        return { title: '', clientName: '', clientEmail: '', clientPhone: '', date, startTime: '09:00', durationMinutes: 60, notes: '', status: 'pending' };
    }

    formatDate(dateStr: string): string {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    endTime(appt: Appointment): string {
        const [h, min] = appt.startTime.split(':').map(Number);
        const total = h * 60 + min + appt.durationMinutes;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    trackById(_: number, item: { id: string }) { return item.id; }
    trackByDate(_: number, day: CalendarDay) { return day.dateStr; }
}
