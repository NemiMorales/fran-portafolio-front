import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CreacionesApi, Creacion, CreacionInput, Categoria } from './creaciones-api';
import { portfolio } from './portfolio';

@Component({ selector: 'app-root', imports: [FormsModule], templateUrl: './app.html', styleUrl: './app.scss' })
export class App {
  private readonly api = inject(CreacionesApi);
  readonly authenticated = this.api.authenticated;
  readonly loginPending = signal(false);
  readonly loginError = signal('');
  username = '';
  password = '';
  login() {
    if (this.loginPending()) return;
    this.loginPending.set(true); this.loginError.set('');
    this.api.login(this.username.trim(), this.password).subscribe({
      next: () => { this.password = ''; this.loginPending.set(false); this.error.set(''); },
      error: (err: HttpErrorResponse) => { this.password = ''; this.loginPending.set(false); this.loginError.set(err.status === 401 ? 'Usuario o contraseña incorrectos. Vuelve a intentarlo.' : err.status === 0 || err.status === 502 || err.status === 504 ? 'No podemos conectar con Django. Comprueba que el backend esté encendido e inténtalo de nuevo.' : 'No se pudo iniciar sesión. Inténtalo nuevamente.'); }
    });
  }
  logout() { this.api.logout(); this.close(); this.notice.set('Sesión cerrada.'); }
  readonly portfolio = portfolio;
  readonly heroImage = 'https://raw.githubusercontent.com/NemiMorales/fran-portafolio/refs/heads/main/portafolio/static/portafolio/img/bombon-detalle.jpg';
  readonly admin = signal(location.pathname.startsWith('/gestion'));
  readonly menuOpen = signal(false);
  readonly items = signal<Creacion[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly pending = signal<number | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly filter = signal('todas');
  readonly modal = signal(false);
  readonly editId = signal<number | null>(null);
  readonly activeItems = computed(() => this.items().filter(item => item.activo));
  readonly visible = computed(() => this.items().filter(item => this.filter() === 'todas' || (this.filter() === 'activas' ? item.activo : !item.activo)));
  form: CreacionInput = this.emptyForm();
  readonly categories = signal<Categoria[]>([]);
  readonly categoriesLoading = signal(false);
  readonly categoriesError = signal('');
  constructor() { this.load(); this.loadCategories(); }
  categoryName(id: number) { return this.categories().find(category => category.id === id)?.nombre ?? 'Categoría ' + id; }
  loadCategories() {
    this.categoriesLoading.set(true); this.categoriesError.set('');
    this.api.categories().subscribe({
      next: categories => { this.categories.set(categories); this.categoriesLoading.set(false); },
      error: err => { this.categoriesError.set(this.message(err)); this.categoriesLoading.set(false); }
    });
  }
  emptyForm(): CreacionInput { return { nombre: '', descripcion: '', imagen: '', activo: true, categoria: null as unknown as number }; }
  count(filter: string) { return this.items().filter(item => filter === 'todas' || (filter === 'activas' ? item.activo : !item.activo)).length; }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.list().subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: err => { this.error.set(this.message(err)); this.loading.set(false); }
    });
  }
  private message(err: HttpErrorResponse): string {
    if (err.status === 0 || err.status === 502 || err.status === 504) return 'No se pudo conectar con la API. Comprueba que Django esté disponible en 127.0.0.1:8000.';
    if (err.status === 401) { this.api.logout(); return 'Tu sesión no está activa o expiró. Inicia sesión para guardar.'; }
    if (err.status === 403) return 'Tu usuario no autoriza esta operación.';
    if (err.error && typeof err.error === 'object') return Object.entries(err.error).map(([key, value]) => key + ': ' + (Array.isArray(value) ? value.join(' ') : String(value))).join(' · ');
    return 'No se pudo completar la operación. Inténtalo nuevamente.';
  }
  openAdd() { this.form = this.emptyForm(); this.editId.set(null); this.error.set(''); this.modal.set(true); setTimeout(() => document.querySelector<HTMLDialogElement>('dialog')?.showModal()); }
  edit(item: Creacion) {
    if (this.pending() !== null) return;
    this.pending.set(item.id); this.error.set('');
    this.api.get(item.id).subscribe({
      next: fresh => { this.form = { nombre: fresh.nombre, descripcion: fresh.descripcion, imagen: fresh.imagen, categoria: fresh.categoria, activo: fresh.activo }; this.editId.set(fresh.id); this.pending.set(null); this.modal.set(true); setTimeout(() => document.querySelector<HTMLDialogElement>('dialog')?.showModal()); },
      error: err => { this.error.set(this.message(err)); this.pending.set(null); }
    });
  }
  close() { if (!this.saving()) { document.querySelector<HTMLDialogElement>('dialog')?.close?.(); this.modal.set(false); } }
  submitCreation(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      const labels: Record<string, string> = { nombre: 'nombre (máximo 100 caracteres)', categoria: 'categoría', descripcion: 'descripción', imagen: 'URL de imagen válida (https://…, máximo 200 caracteres)' };
      const invalid = Object.entries(form.controls).filter(([, control]) => control.invalid).map(([name]) => labels[name] ?? name);
      this.error.set('Revisa estos campos: ' + invalid.join(', ') + '.');
      return;
    }
    this.save();
  }
  save() {
    if (!this.authenticated()) { this.error.set('Inicia sesión para guardar.'); return; }
    if (this.saving()) return;
    if (!this.form.nombre.trim()) { this.error.set('Escribe el nombre de la creación.'); return; }
    if (!this.form.descripcion.trim()) { this.error.set('Escribe la descripción de la creación.'); return; }
    if (!this.form.imagen.trim()) { this.error.set('Agrega la URL de la imagen.'); return; }
    if (!Number.isInteger(this.form.categoria) || !this.categories().some(category => category.id === this.form.categoria)) { this.error.set('Selecciona una categoría disponible.'); return; }
    this.saving.set(true); this.error.set('');
    const body = { ...this.form, nombre: this.form.nombre.trim(), descripcion: this.form.descripcion.trim(), imagen: this.form.imagen.trim() };
    const id = this.editId();
    (id === null ? this.api.create(body) : this.api.update(id, body)).subscribe({
      next: item => { this.items.update(items => id === null ? [...items, item] : items.map(old => old.id === id ? item : old)); this.saving.set(false); this.close(); this.notice.set(id === null ? 'Creación guardada correctamente.' : 'Cambios guardados correctamente.'); },
      error: err => { this.error.set(this.message(err)); this.saving.set(false); }
    });
  }
  toggle(item: Creacion) {
    if (this.pending() !== null) return;
    this.pending.set(item.id); this.error.set('');
    this.api.patch(item.id, { activo: !item.activo }).subscribe({
      next: updated => { this.items.update(items => items.map(old => old.id === item.id ? updated : old)); this.pending.set(null); this.notice.set(updated.activo ? 'Creación activada: ya es visible en el portafolio.' : 'Creación desactivada: ya no se muestra en el portafolio.'); },
      error: err => { this.error.set(this.message(err)); this.pending.set(null); }
    });
  }
  imageError(event: Event) { const image = event.target as HTMLImageElement; image.hidden = true; image.parentElement?.classList.add('image-missing'); }
}





