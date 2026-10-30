import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminEtiquetas } from './admin-etiquetas';

describe('AdminEtiquetas', () => {
  let component: AdminEtiquetas;
  let fixture: ComponentFixture<AdminEtiquetas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEtiquetas],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEtiquetas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
