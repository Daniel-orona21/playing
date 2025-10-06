import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CancionesCategoriaComponent } from './canciones-categoria.component';

describe('CancionesCategoriaComponent', () => {
  let component: CancionesCategoriaComponent;
  let fixture: ComponentFixture<CancionesCategoriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancionesCategoriaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CancionesCategoriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
