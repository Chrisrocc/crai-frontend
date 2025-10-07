// src/components/Car/NextLocationsFormModal.jsx
import { useEffect, useRef, useState } from 'react';
import './CarList.css';

/**
 * Props:
 *  - open: boolean
 *  - items: string[] | { text: string, createdAt?: string }[]
 *  - onSave: (items: string[]) => void
 *  - onSetCurrent: (loc: string) => void
 *  - onClose: () => void
 *  - title?: string
 */
export default function NextLocationsFormModal({
  open,
  items,
  onSave,
  onSetCurrent,
  onClose,
  title = 'Edit Next Destinations',
}) {
  const [list, setList] = useState([]);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  // Normalize incoming items → [{ text, createdAt }]
  useEffect(() => {
    if (!open) return;
    const arr = Array.isArray(items) ? items : [];
    const normalized = arr.map((it) => {
      if (typeof it === 'string') return { text: it, createdAt: null };
      return { text: it?.text ?? '', createdAt: it?.createdAt ?? null };
    }).filter(x => (x.text ?? '').trim() !== '');
    setList(normalized);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, items]);

  const addItem = () => {
    const val = input.trim();
    if (!val) return;
    setList(prev => [...prev, { text: val, createdAt: new Date().toISOString() }]);
    setInput('');
    inputRef.current?.focus();
  };

  const deleteIdx = (idx) => {
    setList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  };

  const toDisplayDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return '—';
    }
  };

  const handleSave = () => {
    // Return only text array to keep API simple/compatible
    const cleaned = [];
    const seen = new Set();
    for (const { text } of list) {
      const t = (text || '').trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
    }
    onSave?.(cleaned);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ width: 'min(820px, 92vw)' }}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
        </div>

        <div className="modal__body">
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Location</th>
                  <th style={{ width: '25%' }}>Created</th>
                  <th style={{ width: '25%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={3} className="empty">No next destinations yet.</td></tr>
                ) : list.map((item, idx) => (
                  <tr key={`${item.text}-${idx}`}>
                    <td>{item.text}</td>
                    <td>{toDisplayDate(item.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => onSetCurrent?.(item.text)}
                        >
                          Set Current Location
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => deleteIdx(idx)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        ref={inputRef}
                        className="input"
                        type="text"
                        placeholder="Add new destination"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <button
                        type="button"
                        className="btn btn--primary"
                        title="Add"
                        onClick={addItem}
                        aria-label="Add destination"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="modal__footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--muted" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn--success" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>

      {/* light styles if not in your CSS already */}
      <style>{`
        .modal-backdrop{ position:fixed; inset:0; background:rgba(2,6,23,.6);
          display:flex; align-items:center; justify-content:center; z-index:9999; }
        .modal{ background:#0b1220; border:1px solid #243041; border-radius:12px;
          box-shadow:0 10px 40px rgba(0,0,0,.5); }
        .modal__header{ padding:16px 20px; border-bottom:1px solid #1f2a3a;}
        .modal__title{ margin:0; font-size:22px; }
        .modal__body{ padding:16px 20px; }
        .table{ width:100%; border-collapse:separate; border-spacing:0; }
        .table th, .table td{ padding:10px 12px; border-top:1px solid #1f2a3a;}
        .table thead th{ background:#0e1626; border-top:none; }
        .empty{ text-align:center; color:#94a3b8; }
        .input{ flex:1; min-width:120px; padding:8px 10px; border-radius:8px;
          border:1px solid #243041; background:#0f172a; color:#e5e7eb; outline:none; }
        .btn{ cursor:pointer; border:none; border-radius:8px; padding:8px 12px; }
        .btn--sm{ padding:6px 10px; font-size:14px; }
        .btn--muted{ background:#334155; color:#e2e8f0; }
        .btn--primary{ background:#3b82f6; color:white; }
        .btn--success{ background:#16a34a; color:white; }
        .btn--danger{ background:#ef4444; color:white; }
      `}</style>
    </div>
  );
}
