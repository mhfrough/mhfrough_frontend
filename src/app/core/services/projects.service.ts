import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/projects`;

  getAll() { return this.http.get<any[]>(this.base); }
  getAllAdmin() { return this.http.get<any[]>(`${this.base}/all`); }
  getOne(id: string) { return this.http.get<any>(`${this.base}/${id}`); }
  create(data: any) { return this.http.post<any>(this.base, data); }
  update(id: string, data: any) { return this.http.put<any>(`${this.base}/${id}`, data); }
  remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}
