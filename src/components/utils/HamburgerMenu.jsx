// src/components/utils/HamburgerMenu.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext"; // ⬅️ up two levels

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Close drawer on route change or ESC
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const NavItem = ({ to, label }) => (
    <Link
      to={to}
      className={`nav-item ${loc.pathname === to ? "is-active" : ""}`}
      onClick={() => setOpen(false)}
    >
      {label}
    </Link>
  );

  const handleSignOut = async () => {
    try { await logout(); } finally {
      setOpen(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <>
      <style>{css}</style>

      {/* Button (fixed, always visible) */}
      <button
        className="hm-btn"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="hm-bar" />
        <span className="hm-bar" />
        <span className="hm-bar" />
      </button>

      {/* Overlay */}
      {open && <div className="hm-overlay" onClick={() => setOpen(false)} />}

      {/* Drawer */}
      <aside className={`hm-drawer ${open ? "is-open" : ""}`} role="dialog" aria-modal="true">
        <div className="hm-head">
          <div className="hm-title">Navigation</div>
          <button className="hm-close" onClick={() => setOpen(false)} aria-label="Close menu">×</button>
        </div>

        <nav className="hm-nav">
          <NavItem to="/" label="Home" />

          <div className="nav-group">Cars</div>
          <NavItem to="/car-list" label="Car List" />

          <div className="nav-group">Appointments</div>
          <NavItem to="/customer-appointment-list" label="Customer Appointments" />
          <NavItem to="/reconditioner-appointment-list" label="Reconditioner Appointments" />

          <div className="nav-group">Tasks</div>
          <NavItem to="/task-list" label="Tasks" />

          <div className="hm-sep" />

          {/* Sign out */}
          <button type="button" className="nav-item nav-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </nav>
      </aside>
    </>
  );
}

const css = `
:root { color-scheme: dark; }
.hm-btn{
  position:fixed; top:16px; left:16px; z-index:1100;
  background:#0F172A; border:1px solid #1F2937; color:#E5E7EB;
  border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:4px;
  cursor:pointer; box-shadow:0 10px 20px rgba(0,0,0,.25);
}
.hm-btn .hm-bar{ width:22px; height:2px; background:#E5E7EB; border-radius:2px; }

.hm-overlay{
  position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1099;
  backdrop-filter:saturate(80%) blur(2px);
}

.hm-drawer{
  position:fixed; top:0; left:0; height:100vh; width:290px; max-width:86vw;
  background:#0B1220; border-right:1px solid #1F2937; z-index:1101;
  transform:translateX(-100%); transition:transform .22s ease-out;
  box-shadow: 0 10px 40px rgba(0,0,0,.45);
  display:flex; flex-direction:column;
}
.hm-drawer.is-open{ transform:translateX(0); }

.hm-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 14px; border-bottom:1px solid #1F2937; }
.hm-title{ font-weight:700; color:#E5E7EB; }
.hm-close{
  background:#111827; border:1px solid #243041; color:#E5E7EB; border-radius:10px;
  padding:6px 10px; cursor:pointer;
}

.hm-nav{ display:flex; flex-direction:column; padding:10px; gap:6px; }
.nav-group{ margin:10px 6px 4px; color:#9CA3AF; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
.nav-item{
  display:block; padding:10px 12px; border-radius:10px; color:#E5E7EB; text-decoration:none;
  border:1px solid transparent; background:#0F172A;
}
.nav-item:hover{ border-color:#2E4B8F; }
.nav-item.is-active{ border-color:#2E4B8F; box-shadow:0 0 0 3px rgba(37,99,235,.18) inset; }

/* Sign-out button look */
.nav-signout{
  text-align:left;
  cursor:pointer;
  background:#111827;
  border:1px solid #243041;
}
.nav-signout:hover{
  border-color:#7F1D1D;
  box-shadow:0 0 0 3px rgba(127,29,29,.25) inset;
}

/* thin separator */
.hm-sep{
  height:1px; background:#1F2937; margin:10px 6px;
}
`;
