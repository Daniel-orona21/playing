import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';

/**
 * Estrategia personalizada de reutilización de rutas
 * Mantiene en caché los componentes cuando cambias de tab,
 * en lugar de destruirlos y recrearlos
 */
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  /**
   * Determina si la ruta debe ser reutilizada
   */
  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  /**
   * Obtiene la clave de almacenamiento para una ruta
   */
  private getRouteKey(route: ActivatedRouteSnapshot): string | null {
    // Construir la ruta completa
    let path = '';
    let current: ActivatedRouteSnapshot | null = route;
    
    while (current) {
      if (current.routeConfig?.path) {
        path = current.routeConfig.path + (path ? '/' + path : '');
      }
      current = current.parent;
    }
    
    return path || null;
  }

  /**
   * Verifica si es una ruta de primer nivel dentro de /layout
   */
  private isMainTab(route: ActivatedRouteSnapshot): boolean {
    const routeKey = this.getRouteKey(route);
    if (!routeKey) return false;
    
    // Solo rutas principales: layout/music, layout/ordenes, layout/games, layout/settings
    const mainTabs = ['layout/music', 'layout/ordenes', 'layout/games', 'layout/settings'];
    return mainTabs.includes(routeKey);
  }

  /**
   * Determina si la ruta debe ser almacenada cuando se navega fuera de ella
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const shouldStore = this.isMainTab(route);
    if (shouldStore) {
      console.log('🗂️ Detectando para almacenar:', this.getRouteKey(route));
    }
    return shouldStore;
  }

  /**
   * Almacena la ruta cuando se navega fuera de ella
   */
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getRouteKey(route);
    if (key && handle && this.isMainTab(route)) {
      console.log('💾 Almacenando ruta:', key);
      this.storedRoutes.set(key, handle);
    }
  }

  /**
   * Determina si debe recuperar una ruta almacenada
   */
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    const shouldRetrieve = !!(key && this.storedRoutes.has(key) && this.isMainTab(route));
    if (shouldRetrieve) {
      console.log('🔍 Encontrada ruta almacenada:', key);
    }
    return shouldRetrieve;
  }

  /**
   * Recupera la ruta almacenada
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getRouteKey(route);
    if (!key || !this.isMainTab(route)) return null;
    
    const handle = this.storedRoutes.get(key);
    if (handle) {
      console.log('📂 Recuperando ruta:', key);
    }
    return handle || null;
  }
}

