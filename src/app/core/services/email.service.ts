import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EmailFolder = 'sent' | 'draft';
export type EmailStatus = 'sent' | 'failed' | 'draft';

export interface EmailMessage {
    id: string;
    folder: EmailFolder;
    to: string;
    cc: string | null;
    subject: string | null;
    body: string;
    status: EmailStatus;
    resendMessageId: string | null;
    relatedLeadId: string | null;
    relatedInquiryId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SendEmailPayload {
    to: string[];
    cc?: string[];
    subject: string;
    html: string;
    relatedLeadId?: string;
    relatedInquiryId?: string;
}

export interface SaveDraftPayload {
    to?: string[];
    cc?: string[];
    subject?: string;
    html?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/email`;

    getMessages(folder: 'sent' | 'drafts'): Observable<EmailMessage[]> {
        return this.http.get<EmailMessage[]>(this.base, { params: { folder } });
    }

    send(payload: SendEmailPayload): Observable<EmailMessage> {
        return this.http.post<EmailMessage>(`${this.base}/send`, payload);
    }

    saveDraft(payload: SaveDraftPayload): Observable<EmailMessage> {
        return this.http.post<EmailMessage>(`${this.base}/drafts`, payload);
    }

    updateDraft(id: string, payload: SaveDraftPayload): Observable<EmailMessage> {
        return this.http.patch<EmailMessage>(`${this.base}/drafts/${id}`, payload);
    }

    deleteDraft(id: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/drafts/${id}`);
    }
}
