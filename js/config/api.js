export function getApiBaseUrl() {
    const hostname = window.location.hostname;

    if (!hostname) {
        return "http://localhost:5000";
    }

    return `http://${hostname}:5000`;
}

export function apiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
}
