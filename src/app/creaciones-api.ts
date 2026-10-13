import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, expand, reduce, EMPTY, tap } from 'rxjs';
export interface Creacion { id: number; nombre: string; descripcion: string; imagen: string; activo: boolean; categoria: number; }
export type CreacionInput = Omit<Creacion, 'id'>;
export interface Categoria { id: number; nombre: string; descripcion: string; }
interface Page<T> { results: T[]; next: string | null; }
@Injectable({ providedIn: 'root' })
export class CreacionesApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/creaciones/';
  private accessToken = '';
  readonly authenticated = signal(false);
  login(username: string, password: string) {
    return this.http.post<{ access: string; refresh: string }>('/api/token/', { username, password }).pipe(
      tap(tokens => { this.accessToken = tokens.access; this.authenticated.set(true); })
    );
  }
  logout() { this.accessToken = ''; this.authenticated.set(false); }
  private authOptions() { return { headers: { Authorization: 'Bearer ' + this.accessToken } }; }
  list(): Observable<Creacion[]> { return this.listAll<Creacion>(this.url); }
  categories(): Observable<Categoria[]> { return this.listAll<Categoria>('/api/categorias/'); }
  private listAll<T>(path: string): Observable<T[]> {
    return this.http.get<T[] | Page<T>>(path).pipe(
      expand(page => !Array.isArray(page) && page.next ? this.http.get<T[] | Page<T>>(this.pageUrl(page.next, path)) : EMPTY),
      reduce((all, page) => [...all, ...(Array.isArray(page) ? page : page.results)], [] as T[])
    );
  }
  private pageUrl(next: string, path: string): string {
    const url = new URL(next, 'http://127.0.0.1:8000');
    if (url.pathname !== path) throw new Error('Ruta de paginación inválida');
    return url.pathname + url.search;
  }
  get(id: number) { return this.http.get<Creacion>(`${this.url}${id}/`); }
  create(body: CreacionInput) { return this.http.post<Creacion>(this.url, body, this.authOptions()); }
  update(id: number, body: CreacionInput) { return this.http.put<Creacion>(`${this.url}${id}/`, body, this.authOptions()); }
  patch(id: number, body: Partial<CreacionInput>) { return this.http.patch<Creacion>(`${this.url}${id}/`, body, this.authOptions()); }
}


