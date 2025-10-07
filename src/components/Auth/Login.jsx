// src/components/Auth/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await login(password);
      navigate("/", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Invalid password");
    }
  };

  return (
    <div className="login-wrap">
      <style>{css}</style>
      <form className="card" onSubmit={submit}>
        <h1>Log In</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
          autoFocus
        />
        {err && <div className="err" role="alert">{err}</div>}
        <button type="submit">Enter</button>
      </form>
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
html, body, #root { height: 100%; background: #0B1220; margin: 0; }

/* ✅ Make widths include padding + border so inputs don't overflow */
*, *::before, *::after { box-sizing: border-box; }

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
  width: 100%;                 /* with border-box this fits perfectly */
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
button:active{ transform: translateY(1px); }
`;
