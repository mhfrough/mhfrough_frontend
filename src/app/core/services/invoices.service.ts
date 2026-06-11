import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkStatusService } from './network-status.service';
import { SyncQueueService } from './sync-queue.service';

export interface InvoiceItem {
    id?: string;
    itemName: string;
    subItem?: string;
    category?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sortOrder?: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    clientEmail: string;
    clientAddress: string;
    clientPhone?: string;
    issueDate: string;
    dueDate: string;
    items: InvoiceItem[];
    notes?: string;
    status: 'draft' | 'sent' | 'paid';
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInvoicePayload {
    clientName: string;
    clientEmail: string;
    clientAddress: string;
    clientPhone?: string;
    issueDate: string;
    dueDate: string;
    items: Omit<InvoiceItem, 'id' | 'total'>[];
    notes?: string;
    status?: 'draft' | 'sent' | 'paid';
    taxRate?: number;
}

@Injectable({ providedIn: 'root' })
export class InvoicesService {
    private readonly http = inject(HttpClient);
    private readonly network = inject(NetworkStatusService);
    private readonly syncQueue = inject(SyncQueueService);
    private readonly base = `${environment.apiUrl}/invoices`;

    private enqueue(method: 'POST' | 'PUT' | 'DELETE', url: string, body: unknown = null): Observable<any> {
        return from(this.syncQueue.enqueue({ url, method, body, timestamp: Date.now() }).then(() => ({ queued: true })));
    }

    getAll() { return this.http.get<Invoice[]>(this.base); }
    getOne(id: string) { return this.http.get<Invoice>(`${this.base}/${id}`); }

    create(data: CreateInvoicePayload): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('POST', this.base, data);
        return this.http.post<Invoice>(this.base, data);
    }

    update(id: string, data: CreateInvoicePayload): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('PUT', `${this.base}/${id}`, data);
        return this.http.put<Invoice>(`${this.base}/${id}`, data);
    }

    remove(id: string): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('DELETE', `${this.base}/${id}`);
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
