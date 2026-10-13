import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { CreacionesApi, Creacion } from './creaciones-api';
const item: Creacion = { id: 1, nombre: 'Bombón', descripcion: 'Chocolate amargo', imagen: '', activo: true, categoria: 1 };
describe('Portafolio y API', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('muestra solo creaciones activas en el portafolio', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones de autor', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([item, { ...item, id: 2, nombre: 'Oculta', activo: false }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#creaciones').textContent).toContain('Bombón');
    expect(fixture.nativeElement.querySelector('#creaciones').textContent).not.toContain('Oculta');
  });
  it('desactiva mediante PATCH sin borrar la creación', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones de autor', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([item]);
    fixture.componentInstance.toggle(item);
    const request = http.expectOne('/api/creaciones/1/');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ activo: false });
    request.flush({ ...item, activo: false });
    expect(fixture.componentInstance.items()[0].activo).toBe(false);
  });
  it('consume todas las páginas de Django', () => {
    const api = TestBed.inject(CreacionesApi);
    let result: Creacion[] = [];
    api.list().subscribe(items => result = items);
    http.expectOne('/api/creaciones/').flush({ results: [item], next: 'http://127.0.0.1:8000/api/creaciones/?page=2' });
    http.expectOne('/api/creaciones/?page=2').flush({ results: [{ ...item, id: 2 }], next: null });
    expect(result.length).toBe(2);
  });
  it('conserva los datos si la API rechaza una operación', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones de autor', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([item]);
    fixture.componentInstance.toggle(item);
    http.expectOne('/api/creaciones/1/').flush({ detail: 'Sin permisos' }, { status: 403, statusText: 'Forbidden' });
    expect(fixture.componentInstance.items()[0].activo).toBe(true);
    expect(fixture.componentInstance.error()).toContain('autoriza');
  });
  it('envía el token de Django al guardar con el ID numérico de categoría', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones de autor', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([]);
    fixture.componentInstance.username = 'editor';
    fixture.componentInstance.password = 'test-password';
    fixture.componentInstance.login();
    const login = http.expectOne('/api/token/');
    expect(login.request.body).toEqual({ username: 'editor', password: 'test-password' });
    login.flush({ access: 'test-token', refresh: 'unused' });
    fixture.componentInstance.form = { nombre: 'Bombón', descripcion: 'Chocolate', imagen: 'https://example.com/bombon.jpg', activo: true, categoria: 1 };
    fixture.componentInstance.save();
    const save = http.expectOne('/api/creaciones/');
    expect(save.request.method).toBe('POST');
    expect(save.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(save.request.body.categoria).toBe(1);
    save.flush(item);
    expect(fixture.componentInstance.items()).toEqual([item]);
    expect(fixture.componentInstance.password).toBe('');
  });
  it('explica por qué no se guarda un formulario inválido', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([]);
    const form = { invalid: true, control: { markAllAsTouched: () => {} }, controls: { imagen: { invalid: true } } };
    fixture.componentInstance.submitCreation(form as any);
    expect(fixture.componentInstance.error()).toContain('URL de imagen válida');
    http.expectNone(request => request.method === 'POST');
  });
  it('guarda desde el formulario visible después de iniciar sesión', async () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/categorias/').flush([{ id: 1, nombre: 'Bombones', descripcion: '' }]);
    http.expectOne('/api/creaciones/').flush([]);
    fixture.componentInstance.username = 'editor';
    fixture.componentInstance.password = 'test-password';
    fixture.componentInstance.login();
    http.expectOne('/api/token/').flush({ access: 'test-token', refresh: 'unused' });
    fixture.componentInstance.form = { nombre: 'Bombón', descripcion: 'Chocolate', imagen: 'https://example.com/bombon.jpg', activo: true, categoria: 1 };
    fixture.componentInstance.modal.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('dialog form') as HTMLFormElement;
    expect(form).toBeTruthy();
    (form.querySelector('.modal-actions .btn--primario') as HTMLButtonElement).click();
    const request = http.expectOne('/api/creaciones/');
    expect(request.request.body.nombre).toBe('Bombón');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(item);
    expect(fixture.componentInstance.notice()).toContain('guardada');
  });
});

