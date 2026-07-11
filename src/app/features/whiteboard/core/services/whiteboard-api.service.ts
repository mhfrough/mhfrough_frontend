import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { WhiteboardElement } from '../models/element.model';

export interface WhiteboardScene {
    elements: WhiteboardElement[];
    appState: Record<string, unknown>;
}

export interface WhiteboardDocumentDto {
    id: string;
    title: string;
    ownerId: string;
    scene: WhiteboardScene | null;
    isPublic: boolean;
    shareRole: string;
    createdAt: string;
    updatedAt: string;
}

/** Thin REST client for the backend /whiteboard module (cookie-auth via the credentials interceptor). */
@Injectable()
export class WhiteboardApiService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/whiteboard`;

    list(): Observable<WhiteboardDocumentDto[]> {
        return this.http.get<WhiteboardDocumentDto[]>(this.base);
    }

    create(title: string, scene: WhiteboardScene): Observable<WhiteboardDocumentDto> {
        return this.http.post<WhiteboardDocumentDto>(this.base, { title, scene });
    }

    getOne(id: string): Observable<WhiteboardDocumentDto> {
        return this.http.get<WhiteboardDocumentDto>(`${this.base}/${id}`);
    }

    updateScene(id: string, scene: WhiteboardScene): Observable<WhiteboardDocumentDto> {
        return this.http.put<WhiteboardDocumentDto>(`${this.base}/${id}`, { scene });
    }

    snapshot(id: string, label?: string): Observable<unknown> {
        return this.http.post(`${this.base}/${id}/versions`, { label });
    }

    improveText(text: string, mode: AiImproveMode = 'improve'): Observable<{ text: string }> {
        return this.http.post<{ text: string }>(`${this.base}/ai/improve-text`, { text, mode });
    }
}

export type AiImproveMode = 'improve' | 'shorten' | 'fix';
