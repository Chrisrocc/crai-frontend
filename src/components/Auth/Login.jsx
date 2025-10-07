// src/components/Auth/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);

    try {
      // 1) Call your existing auth flow
      //    Expecting it to return { token } now that backend /login responds with it.
      const result = await login(password);

      // 2) If backend returned a token, ask Cloudflare Pages Function to set
      //    a first-party cookie for your domain (works on Brave/Chrome iOS/Android)
      const token = result?.token;
      if (token) {
        try {
          const r = await fetch("/api/token-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token }),
          });
          if (!r.ok) {
            // Not fatal for UX, but helpful to surface during setup
            console.warn("token-cookie failed:", await r.text());
          }
        } catch (e) {
          console.warn("token-cookie request error:", e);
        }
      } else {
        // If your login() didn’t return token, that’s fine—backend also set httpOnly cookie.
        // We keep this warning to help diagnose mobile browser issues.
        console.warn("login() returned no token; relying on backend cookie only.");
      }

      // 3) Go home
      navigate("/", { replace: true });
    } catch (e2) {
      const msg =
        e2?.response?.data?.message ||
        e2?.message ||
        "Invalid password";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <style>{css}</style>
      <form className="card" onSubmit={submit} noValidate>
        <h1>Log In</h1>

        <label className="sr-only" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
          autoFocus
          disabled={loading}
        />

        {err && (
          <div className="err" role="alert">
            {err}
          </div>
        )}

        <button type="submit" disabled={loading || !password}>
          {loading ? "Signing in…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
html, body, #root { height: 100%; background: #0B1220; margin: 0; }

/* ✅ Make widths include padding + border so inputs don't overflow */
*, *::before, *::after { box-sizing: border-box; }

/* Screen-reader only utility */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}

/* Hard-center */
.login-wrap{
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  min-height: 100svh;
  color: #E5E7EB;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif;
}

.card{
  width: clamp(260px, 90vw, 380px);
  background: #0F172A;
  border: 1px solid #1F2937;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}

.card h1{ margin:0 0 12px; font-size:22px; }

input{
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #243041;
  background: #0B1220;
  color: #E5E7EB;
  margin-bottom: 12px;
}
input:focus{
  border-color: #2E4B8F;
  box-shadow: 0 0 0 3px rgba(37,99,235,.25);
  outline: none;
}
input:disabled{
  opacity:.6;
}

.err{
  background:#3B0D0D;
  border:1px solid #7F1D1D;
  color:#FECACA;
  padding:8px 10px;
  border-radius:10px;
  margin-bottom:8px;
}

button{
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: #2563EB;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
button:disabled{
  opacity:.6;
  cursor: not-allowed;
}
button:active{ transform: translateY(1px); }
`;
