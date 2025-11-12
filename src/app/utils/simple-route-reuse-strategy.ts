import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';

/**
 * Estrategia de reutilización de rutas
 * Cachea los tabs principales (music, ordenes, games, settings) y sus rutas anidadas
 * para evitar recrearlos y mantener su estado
 */
export class SimpleRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private getRouteKey(route: ActivatedRouteSnapshot): string | null {
    const segments: string[] = [];
    let current: ActivatedRouteSnapshot | null = route;
    
    while (current) {
      if (current.routeConfig?.path) {
        segments.unshift(current.routeConfig.path);
      }
      current = current.parent;
    }
    
    return segments.length > 0 ? segments.join('/') : null;
  }

  private shouldCacheRoute(route: ActivatedRouteSnapshot): boolean {
    const routeKey = this.getRouteKey(route);
    if (!routeKey) return false;
    
    const mainTabs = ['music', 'ordenes', 'games', 'settings'];
    const nestedRoutes = ['lista', 'busqueda', 'filtro', 'ordenes', 'usuarios'];
    
    const segments = routeKey.split('/').filter(s => s && s !== 'layout');
    
    if (segments.length === 0) return false;
    
    const firstSegment = segments[0];
    const isMainTab = mainTabs.includes(firstSegment);
    
    if (!isMainTab) return false;
    
    if (segments.length === 1) {
      return true;
    }
    
    if (segments.length === 2) {
      const secondSegment = segments[1];
      if (firstSegment === 'music') {
        return nestedRoutes.includes(secondSegment);
      }
      if (firstSegment === 'ordenes') {
        return nestedRoutes.includes(secondSegment);
      }
    }
    
    return false;
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.shouldCacheRoute(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getRouteKey(route);
    if (key && handle && this.shouldCacheRoute(route)) {
      this.storedRoutes.set(key, handle);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    return !!(key && this.storedRoutes.has(key) && this.shouldCacheRoute(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getRouteKey(route);
    if (!key || !this.shouldCacheRoute(route)) return null;
    
    return this.storedRoutes.get(key) || null;
  }
}

