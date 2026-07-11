import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SeoAuditReport } from './seo-report.types';

/** HTTP client for the standalone /seo audit section (backend: /api/v1/seo-audit). */
@Injectable({ providedIn: 'root' })
export class SeoApiService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/seo-audit`;

    audit(url: string, keyword?: string): Observable<SeoAuditReport> {
        const body: { url: string; keyword?: string } = { url };
        if (keyword?.trim()) body.keyword = keyword.trim();
        return this.http.post<SeoAuditReport>(this.base, body);
    }
}
