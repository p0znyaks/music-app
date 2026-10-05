import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppTrack } from '../../shared/models/track.model';
import { SearchDataService } from './search-data.service';

const track = (id: string, artist: string): AppTrack => ({
  trackId: id,
  title: `Song ${id}`,
  artist,
  thumbnailUrl: null,
});

describe('SearchDataService', () => {
  let service: SearchDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SearchDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const search = (q: string, tab: 'tracks' | 'all' = 'tracks') => service.run(q, tab).subscribe();

  /** Запрос треков: путь `/api/search` с query-строкой. */
  const isSearch = (r: { url: string }) => r.url.startsWith('/api/search');

  it('requests tracks and publishes them', () => {
    search('rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('a', 'Rihanna')],
      albums: [],
      artists: [],
    });
    expect(service.tracks().map((t) => t.trackId)).toEqual(['a']);
    expect(service.loadingTracks()).toBe(false);
  });

  it('hoists the exact artist match to the top of the results', () => {
    search('drake');
    http.expectOne(isSearch).flush({
      tracks: [track('other', 'Post Malone'), track('his', 'Drake')],
      albums: [],
      artists: [],
    });
    expect(service.tracks().map((t) => t.trackId)).toEqual(['his', 'other']);
  });

  it('serves a repeated query from cache without hitting the network', () => {
    search('rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('a', 'Rihanna')],
      albums: [],
      artists: [],
    });
    search('rihanna');
    http.expectNone(isSearch);
    expect(service.tracks().map((t) => t.trackId)).toEqual(['a']);
  });

  it('treats casing and padding as the same query', () => {
    search('Rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('a', 'Rihanna')],
      albums: [],
      artists: [],
    });
    search('  rihanna  ');
    http.expectNone(isSearch);
  });

  it('paints the longest cached prefix while the longer query loads', () => {
    search('rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('cached', 'Rihanna')],
      albums: [],
      artists: [],
    });

    search('rihanna um');
    // Result of the shorter query is already on screen...
    expect(service.tracks().map((t) => t.trackId)).toEqual(['cached']);

    http.expectOne(isSearch).flush({
      tracks: [track('fresh', 'Rihanna')],
      albums: [],
      artists: [],
    });
    expect(service.tracks().map((t) => t.trackId)).toEqual(['fresh']);
  });

  it('does not paint a short prefix that would replace meaningful results', () => {
    search('rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('a', 'Rihanna')],
      albums: [],
      artists: [],
    });
    expect(service.findCachedTracks('ri')).toBeNull();
    expect(service.findCachedTracks('rihanna')).toHaveLength(1);
  });

  it('drops the result of a superseded request so stale rows never win', () => {
    search('first');
    search('second');
    const requests = http.match(isSearch);
    requests[1]!.flush({ tracks: [track('second', 'X')], albums: [], artists: [] });
    requests[0]!.flush({ tracks: [track('first', 'X')], albums: [], artists: [] });
    expect(service.tracks().map((t) => t.trackId)).toEqual(['second']);
  });

  it('ends up empty and stops loading when the request fails', () => {
    search('broken');
    http.expectOne(isSearch).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(service.tracks()).toEqual([]);
    expect(service.loadingTracks()).toBe(false);
  });

  it('issues three parallel requests on the all tab', () => {
    service.run('rihanna', 'all').subscribe();
    const urls = http.match((r) => r.url.startsWith('/api/search')).map((r) => r.request.url);
    expect(urls.sort()).toEqual([
      '/api/search/albums?q=rihanna',
      '/api/search/artists?q=rihanna',
      '/api/search?q=rihanna',
    ]);
    http.verify();
  });

  it('clears results on reset', () => {
    search('rihanna');
    http.expectOne(isSearch).flush({
      tracks: [track('a', 'Rihanna')],
      albums: [],
      artists: [],
    });
    service.reset(false);
    expect(service.tracks()).toEqual([]);
    expect(service.hasSearched()).toBe(false);
  });

  it('reports that a query was entered even when it returned nothing', () => {
    search('zzzzz');
    http.expectOne(isSearch).flush({
      tracks: [],
      albums: [],
      artists: [],
    });
    expect(service.hasSearched()).toBe(true);
    expect(service.tracks()).toEqual([]);
  });

  it('survives a backend that answers with a malformed body', () => {
    service.run('x', 'tracks').subscribe();
    http.expectOne(isSearch).flush(null, { status: 200, statusText: 'OK' });
    expect(service.loadingTracks()).toBe(false);
  });
});
