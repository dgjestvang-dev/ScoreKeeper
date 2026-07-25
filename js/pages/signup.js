import { apiUrl } from "../config/api.js";

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 30;
const USERNAME_REGEX = /^[a-z0-9_.-]+$/;

function validateUsername(username) {
    if (!username) {
        return "Skriv inn et brukernavn";
    }

    if (username.length < USERNAME_MIN_LEN) {
        return `Brukernavn må ha minst ${USERNAME_MIN_LEN} tegn`;
    }

    if (username.length > USERNAME_MAX_LEN) {
        return `Brukernavn kan maks ha ${USERNAME_MAX_LEN} tegn`;
    }

    if (!USERNAME_REGEX.test(username)) {
        return "Bruk kun små bokstaver, tall, punktum, understrek eller bindestrek";
    }

    return null;
}

export function initSignup(options = {}) {
    const { onSignupSuccess } = options;

    const usernameInput = document.getElementById("signup-username");
    const submitBtn = document.getElementById("signup-submit-btn");
    const statusEl = document.getElementById("signup-status");

    if (!usernameInput || !submitBtn) return;

    if (statusEl) {
        statusEl.textContent = "";
    }

    submitBtn.onclick = async () => {
        const username = (usernameInput.value || "").trim().toLowerCase();
        const usernameError = validateUsername(username);

        if (usernameError) {
            if (statusEl) statusEl.textContent = usernameError;
            return;
        }

        submitBtn.disabled = true;
        if (statusEl) statusEl.textContent = "Oppretter bruker...";

        try {
            const response = await fetch(apiUrl("/users"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error("Brukernavnet er allerede i bruk");
                }

                let backendError = `Oppretting feilet (${response.status})`;
                try {
                    const body = await response.json();
                    backendError = body.error || backendError;
                } catch {
                    // Ignore parse errors.
                }
                throw new Error(backendError);
            }

            await response.json();

            alert(`Bruker '${username}' er opprettet`);
            usernameInput.value = "";

            if (typeof onSignupSuccess === "function") {
                onSignupSuccess();
            }
        } catch (error) {
            if (statusEl) {
                statusEl.textContent = `Feil: ${error.message}`;
            }
        } finally {
            submitBtn.disabled = false;
        }
    };
}
