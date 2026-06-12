import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Appointment } from './appointments.service';
import { Invoice } from './invoices.service';
import { ChatSession } from './chat.service';

export type LeadSource = 'email' | 'chat' | 'appointment' | 'manual';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost';

export interface LeadInquiry {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
}

export interface Lead {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    website?: string | null;
    source: LeadSource;
    status: LeadStatus;
    projectSummary?: string | null;
    budget?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    inquiries?: LeadInquiry[];
    appointments?: Appointment[];
    invoices?: Invoice[];
    chatSessions?: ChatSession[];
}

export interface CreateLeadPayload {
    name: string;
    email: string;
    phone?: string;
    website?: string;
    source?: LeadSource;
    status?: LeadStatus;
    projectSummary?: string;
    budget?: string;
    notes?: string;
    chatSessionId?: string;
}

export type UpdateLeadPayload = Partial<Omit<CreateLeadPayload, 'chatSessionId'>>;

@Injectable({ providedIn: 'root' })
export class LeadsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/leads`;

    getAll(): Observable<Lead[]> {
        return this.http.get<Lead[]>(this.base);
    }

    getOne(id: string): Observable<Lead> {
        return this.http.get<Lead>(`${this.base}/${id}`);
    }

    create(payload: CreateLeadPayload): Observable<Lead> {
        return this.http.post<Lead>(this.base, payload);
    }

    update(id: string, payload: UpdateLeadPayload): Observable<Lead> {
        return this.http.patch<Lead>(`${this.base}/${id}`, payload);
    }

    remove(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
