import { apiUrl, getApiBaseUrl } from "../config/api.js";

let activeUser = null;
let fetchInterceptorInstalled = false;

function getBackendUrlFromInput(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
}

function isBackendApiUrl(url) {
    return url.startsWith(`${getApiBaseUrl()}/`);
}

function updateLoginStatus(statusEl) {
    if (!statusEl) return;

    if (!activeUser) {
        statusEl.textContent = "Ikke logget inn";
        return;
    }

    const displayName = activeUser.display_name || activeUser.username;
    statusEl.textContent = `Logget inn som ${displayName} (id: ${activeUser.id})`;
}

export function installAuthFetchInterceptor() {
    if (fetchInterceptorInstalled) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
        const requestUrl = getBackendUrlFromInput(input);

        if (!isBackendApiUrl(requestUrl) || !activeUser?.id) {
            return originalFetch(input, init);
        }

        const nextInit = init ? { ...init } : {};
        const headers = new Headers(nextInit.headers || {});
        headers.set("X-User-Id", String(activeUser.id));
        nextInit.headers = headers;

        return originalFetch(input, nextInit);
    };

    fetchInterceptorInstalled = true;
}

export function initLogin(options = {}) {
    const { onLoginSuccess } = options;

    const usernameInput = document.getElementById("login-username");
    const submitBtn = document.getElementById("login-submit-btn");
    const statusEl = document.getElementById("login-status");

    if (!usernameInput || !submitBtn) return;

    updateLoginStatus(statusEl);

    submitBtn.onclick = async () => {
        const username = (usernameInput.value || "").trim().toLowerCase();
        const loginEndpoint = apiUrl("/auth/login");

        if (!username) {
            if (statusEl) statusEl.textContent = "Skriv inn et brukernavn";
            return;
        }

        submitBtn.disabled = true;
        if (statusEl) statusEl.textContent = `Logger inn mot ${loginEndpoint} ...`;

        try {
            const response = await fetch(loginEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                let backendError = `Innlogging feilet (${response.status})`;
                try {
                    const body = await response.json();
                    backendError = body.error || backendError;
                } catch {
                    // Ignore parse errors.
                }
                throw new Error(backendError);
            }

            const payload = await response.json();
            activeUser = payload.user || null;

            updateLoginStatus(statusEl);

            if (typeof onLoginSuccess === "function") {
                onLoginSuccess(activeUser);
            }
        } catch (error) {
            if (statusEl) {
                statusEl.textContent = `Feil: ${error.message}. Endpoint: ${loginEndpoint}`;
            }
        } finally {
            submitBtn.disabled = false;
        }
    };
}

export function getActiveUser() {
    return activeUser;
}
