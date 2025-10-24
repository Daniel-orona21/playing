export interface Cancion {
  id_cancion?: number;
  spotify_id: string;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  imagen_url: string;
  genero?: string;
  preview_url?: string;
}

export interface ColaCancion {
  id: number;
  cancion_id: number;
  cancion: Cancion;
  anadido_por: number;
  usuario: { nombre: string };
  posicion: number;
  status: 'pending' | 'playing' | 'skipped' | 'played';
  agregada_en: string;
}

export interface HistorialReproduccion {
  id_historial: number;
  cancion: Cancion;
  usuario: { nombre: string };
  reproducida_en: string;
  completada: boolean;
}

export interface ConfiguracionMusica {
  limite_canciones_por_usuario_hora: number;
  limite_reproducciones_cancion: number | null;
}

export interface FiltroContenido {
  id_filtro: number;
  establecimiento_id: number;
  tipo: 'cancion' | 'genero';
  spotify_id?: string;
  genero?: string;
  razon?: string;
}

export interface SpotifyTrack {
  spotify_id: string;
  titulo: string;
  artista: string;
  album: string;
  duracion: number;
  imagen_url: string;
  genero?: string;
  preview_url?: string;
}

export interface SpotifyArtist {
  spotify_id: string;
  nombre: string;
  imagen_url: string | null;
  genres: string[];
  followers: number;
  popularity: number;
}

export interface SpotifySearchResponse {
  success: boolean;
  tracks: SpotifyTrack[];
  artists?: SpotifyArtist[];
  totalArtists?: number;
}

export interface SpotifyGenresResponse {
  success: boolean;
  genres: string[];
}

export interface QueueResponse {
  success: boolean;
  queue: ColaCancion[];
}

export interface HistoryResponse {
  success: boolean;
  history: HistorialReproduccion[];
}

export interface ConfigResponse {
  success: boolean;
  config: ConfiguracionMusica;
}

export interface FiltersResponse {
  success: boolean;
  filters: FiltroContenido[];
}

export interface CurrentTrackResponse {
  success: boolean;
  currentTrack: ColaCancion | null;
}

export interface ValidationResponse {
  success: boolean;
  canAdd: boolean;
}
