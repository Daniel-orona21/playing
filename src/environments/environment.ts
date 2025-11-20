// Función para obtener la URL del API basándose en el hostname actual
function getApiUrl(): string {
  // Si estamos en el navegador, usar el hostname actual
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Si es localhost o 127.0.0.1, usar localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    
    // Si es una IP local (192.168.x.x, 10.x.x.x, 172.16-31.x.x), usar esa IP
    // Esto permite que funcione cuando se accede desde otro dispositivo
    if (hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/)) {
      return `http://${hostname}:3000/api`;
    }
  }
  
  // Por defecto, usar localhost
  return 'http://localhost:3000/api';
}

export const environment = {
  production: false,
  apiUrl: getApiUrl(),
  // apiUrl: 'https://playing-svrw.onrender.com/api',
  googleClientId: '990138169107-7blqi2dlp5ov4t8d48at1d9vjll4nose.apps.googleusercontent.com',
  spotifyClientId: 'e61210ff14cf41dbbf451c1da9abbcca'
};
