import { Injectable } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';

@Injectable()
export class SearchRouteReuseStrategy implements RouteReuseStrategy {
  private cachedSearchHandle: DetachedRouteHandle | null = null;

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig?.path === 'search';
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (route.routeConfig?.path === 'search') {
      this.cachedSearchHandle = handle;
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig?.path === 'search' && this.cachedSearchHandle !== null;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (route.routeConfig?.path === 'search') {
      return this.cachedSearchHandle;
    }
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  clearCache(): void {
    this.cachedSearchHandle = null;
  }
}
