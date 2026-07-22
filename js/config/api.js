function normalizeBaseUrl(value) {
    if (!value || typeof value !== "string") return "";
    return value.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl() {
    const explicitBase =
        normalizeBaseUrl(window.__API_BASE_URL) ||
        normalizeBaseUrl(localStorage.getItem("sk_api_base_url"));

    if (explicitBase) {
        return explicitBase;
    }

    const hostname = window.location.hostname;

    if (!hostname) {
        return "http://localhost:5000";
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:5000";
    }

    // LAN/dev fallback: assume backend runs on same host at port 5000.
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) {
        return `http://${hostname}:5000`;
    }

    // Production fallback if frontend and backend are served from same origin.
    return window.location.origin;
}

export function apiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
}
