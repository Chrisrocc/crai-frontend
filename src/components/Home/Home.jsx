// src/components/Home/Home.jsx
import HamburgerMenu from "../utils/HamburgerMenu";
import CustomerAppointmentsHome from "./CustomerAppointmentHome";
import ReconditionerAppointmentHome from "./ReconditionerAppointmentHome";

export default function Home() {
  return (
    <div className="home-wrap with-ham">
      <style>{css}</style>
      <HamburgerMenu />

      {/* Page header */}
      <header className="home-head">
        <div className="titles">
          <h1>Dashboard</h1>
          <p className="sub">Today & tomorrow at a glance. Inline edit supported.</p>
        </div>
      </header>

      {/* Two panels: Customer/Delivery + Reconditioner */}
      <main className="home-grid">
        <section className="home-panel">
          <h2 className="panel-title">Customer Appointments & Delivery</h2>
          <CustomerAppointmentsHome />
        </section>

        <section className="home-panel">
          <h2 className="panel-title">Reconditioner Appointments</h2>
          <ReconditionerAppointmentHome />
        </section>
      </main>
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
html, body, #root { background:#0B1220; }
* { box-sizing:border-box; }

/* Prevent the PAGE from getting a horizontal scrollbar */
html, body { overflow-x:hidden; }

.home-wrap{
  --bg:#0B1220; --text:#E5E7EB; --muted:#9CA3AF; --line:#1F2937;
  color:var(--text); background:var(--bg);
  min-height:100vh; padding:20px;
  font-family:Inter, system-ui, -apple-system, Segoe UI, Arial;
}

/* keep header clear of fixed hamburger */
.with-ham .home-head{ padding-left:56px; }
@media (max-width:480px){ .with-ham .home-head{ padding-left:48px; } }

.home-head{ margin:0 0 14px; }
.home-head h1{ margin:0 0 2px; font-size:22px; letter-spacing:.2px; }
.sub{ margin:0; color:var(--muted); font-size:12px; }

.home-grid{
  display:grid; gap:16px;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
}
@media (max-width: 1024px){
  .home-grid{ grid-template-columns:1fr; }
}

.home-panel{ min-width:0; }
.panel-title{
  margin:0 0 8px;
  font-size:16px; color:#cbd5e1; font-weight:600;
}
`;
