import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
    id: string;
    title: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM
    durationMinutes: number;
    notes?: string;
    status: AppointmentStatus;
    reminderSentAt?: string | null;
    leadId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export type CreateAppointmentPayload = Omit<Appointment, 'id' | 'reminderSentAt' | 'createdAt' | 'updatedAt'>;
export type UpdateAppointmentPayload = Partial<CreateAppointmentPayload>;

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/appointments`;

    getAll(): Observable<Appointment[]> {
        return this.http.get<Appointment[]>(this.base);
    }

    getByMonth(year: number, month: number): Observable<Appointment[]> {
        const params = new HttpParams().set('year', year).set('month', month);
        return this.http.get<Appointment[]>(this.base, { params });
    }

    getUpcoming(hours = 24): Observable<Appointment[]> {
        const params = new HttpParams().set('hours', hours);
        return this.http.get<Appointment[]>(`${this.base}/upcoming`, { params });
    }

    getOne(id: string): Observable<Appointment> {
        return this.http.get<Appointment>(`${this.base}/${id}`);
    }

    create(payload: CreateAppointmentPayload): Observable<Appointment> {
        return this.http.post<Appointment>(this.base, payload);
    }

    update(id: string, payload: UpdateAppointmentPayload): Observable<Appointment> {
        return this.http.put<Appointment>(`${this.base}/${id}`, payload);
    }

    remove(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
