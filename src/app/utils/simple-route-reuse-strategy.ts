import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';

/**
 * Estrategia simple de reutilización de rutas
 * Solo cachea los tabs principales (music, ordenes, games, settings) para evitar recrearlos
 * PERO sin detectar si los datos deben refrescarse
 */
export class SimpleRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private getRouteKey(route: ActivatedRouteSnapshot): string | null {
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

  private isMainTab(route: ActivatedRouteSnapshot): boolean {
    const routeKey = this.getRouteKey(route);
    if (!routeKey) return false;
    
    const mainTabs = ['music', 'ordenes', 'games', 'settings'];
    return mainTabs.includes(routeKey);
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.isMainTab(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getRouteKey(route);
    if (key && handle && this.isMainTab(route)) {
      this.storedRoutes.set(key, handle);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    return !!(key && this.storedRoutes.has(key) && this.isMainTab(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getRouteKey(route);
    if (!key || !this.isMainTab(route)) return null;
    
    return this.storedRoutes.get(key) || null;
  }
}

