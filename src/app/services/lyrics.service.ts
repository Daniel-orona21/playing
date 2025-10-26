import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsResponse {
  success: boolean;
  synced: boolean;
  lyrics: LyricLine[] | string[];
}

@Injectable({
  providedIn: 'root'
})
export class LyricsService {
  private readonly API_URL = `${environment.apiUrl}/lyrics`;

  constructor(private http: HttpClient) {}

  /**
   * Fetch lyrics for a track
   * @param track - Track name
   * @param artist - Artist name
   * @param album - Album name (optional)
   * @param duration - Track duration in seconds (optional)
   * @returns Observable with lyrics response
   */
  getLyrics(track: string, artist: string, album?: string, duration?: number, token?: string): Observable<LyricsResponse> {
    const params: any = {
      track,
      artist
    };

    if (album) {
      params.album = album;
    }

    if (duration) {
      params.duration = duration;
    }

    // Use provided token or get from localStorage
    const authToken = token || localStorage.getItem('token');
    
    // Only add Authorization header if token exists
    let headers = new HttpHeaders();
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }

    return this.http.get<LyricsResponse>(this.API_URL, { params, headers });
  }
}

