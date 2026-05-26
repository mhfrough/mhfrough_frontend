import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
    private readonly base = `${environment.apiUrl}/invoices`;

    getAll() {
        return this.http.get<Invoice[]>(this.base);
    }

    getOne(id: string) {
        return this.http.get<Invoice>(`${this.base}/${id}`);
    }

    create(data: CreateInvoicePayload) {
        return this.http.post<Invoice>(this.base, data);
    }

    update(id: string, data: CreateInvoicePayload) {
        return this.http.put<Invoice>(`${this.base}/${id}`, data);
    }

    remove(id: string) {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}
