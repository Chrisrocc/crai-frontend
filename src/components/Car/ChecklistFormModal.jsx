import { useEffect, useRef, useState } from 'react';

export default function ChecklistFormModal({
  open,
  items = [],
  onSave,
  onClose,
}) {
  const [list, setList] = useState([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Normalize incoming items on open
  useEffect(() => {
    if (!open) return;
    const clean = Array.from(
      new Set(
        (Array.isArray(items) ? items : [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
      )
    );
    setList(clean);
    setDraft('');
    // focus after open
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, items]);

  if (!open) return null;

  // ---- mutations (auto-save, do NOT close) ----
  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    if (list.includes(v)) {
      setDraft('');
      inputRef.current?.focus();
      return;
    }
    const updated = [...list, v];
    setList(updated);
    setDraft('');
    inputRef.current?.focus();
    onSave?.(updated); // auto-save on add
  };

  const removeItemAt = (idx) => {
    const updated = list.filter((_, i) => i !== idx);
    setList(updated);
    onSave?.(updated); // auto-save on delete
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  // Click-away to close (only if click lands on the backdrop)
  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cl-title">
        {/* Sticky header */}
        <div className="modal-header">
          <h2 id="cl-title" className="modal-title">Edit Checklist</h2>
          <button className="close-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        {/* Scrollable body */}
        <div className="modal-body">
          <div className="grid-table">
            <div className="grid-row grid-header">
              <div className="grid-cell">Item</div>
              <div className="grid-cell grid-cell--actions">Actions</div>
            </div>

            {list.map((text, idx) => (
              <div key={`${text}-${idx}`} className="grid-row">
                <div className="grid-cell grid-cell--item" title={text}>
                  {text}
                </div>
                <div className="grid-cell grid-cell--actions">
                  <button
                    className="btn btn--danger"
                    onClick={() => removeItemAt(idx)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            <div className="grid-row grid-row--add">
              <input
                ref={inputRef}
                className="input"
                type="text"
                placeholder="Add new checklist item"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="grid-cell grid-cell--actions">
                <button
                  className="btn btn--primary"
                  onClick={addItem}
                  disabled={!draft.trim()}
                  title={draft.trim() ? 'Add item' : 'Type something to add'}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="modal-actions">
          <button className="btn btn--muted" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        /* Backdrop fills the safe mobile viewport and can scroll if needed */
        .modal-backdrop{
          position:fixed; inset:0;
          height:100dvh;              /* mobile safe */
          background:rgba(0,0,0,.5);
          display:flex; align-items:center; justify-content:center;
          padding:10px; z-index:1000;
          overflow:auto;              /* allow whole-sheet scroll if keyboard pushes */
        }

        /* Card uses a column flex layout with sticky header/footer and scrollable body */
        .modal-card{
          width:min(900px, 94vw);
          max-height:92dvh;           /* stay inside viewport */
          background:#0b1220; border:1px solid #1f2a3a; border-radius:14px;
          box-shadow:0 10px 40px rgba(0,0,0,.5);
          color:#e5e7eb;
          display:flex; flex-direction:column;
          overflow:hidden;            /* clip sticky edges nicely */
        }

        .modal-header{
          position:sticky; top:0; z-index:2;
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 14px; background:#0b1220; border-bottom:1px solid #1f2937;
        }
        .modal-title{font-size:18px; margin:0; font-weight:800;}
        .close-x{
          border:none; background:#1f2937; color:#e5e7eb;
          width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:18px; line-height:1;
        }

        /* This is the only scrollable area (makes Close always accessible) */
        .modal-body{
          flex:1 1 auto;
          overflow:auto;
          -webkit-overflow-scrolling:touch;  /* momentum on iOS */
          padding:12px;
        }

        .modal-actions{
          position:sticky; bottom:0; z-index:2;
          display:flex; justify-content:flex-end; gap:10px;
          padding:10px 12px;
          background:linear-gradient(to top, #0b1220, rgba(11,18,32,0.9) 60%, transparent);
          border-top:1px solid #1f2937;
        }

        .grid-table{border:1px solid #1f2a3a;border-radius:12px;padding:8px;background:#0d1526;}
        .grid-row{
          display:grid; align-items:center; gap:12px;
          grid-template-columns: minmax(0,1fr) 132px;
          padding:10px 8px; border-bottom:1px solid #162235;
        }
        .grid-row:last-child{border-bottom:none;}
        .grid-header{background:#0f182a;border-radius:8px 8px 0 0;font-weight:600;}
        .grid-cell{display:flex;align-items:center;}
        .grid-cell--actions{justify-content:flex-end;}

        .grid-cell--item{
          min-width:0;
          overflow-wrap:anywhere;
          word-break:break-word;
          white-space:pre-wrap;
          line-height:1.35;
        }

        .grid-row--add{grid-template-columns:minmax(0,1fr) 132px;}
        .input{
          width:100%; box-sizing:border-box;
          background:#0f172a;border:1px solid #243041;border-radius:10px;
          padding:10px 12px;color:#e5e7eb;outline:none;
        }

        .btn{
          border:none;border-radius:10px;padding:8px 12px;cursor:pointer;
          background:#1f2a3a;color:#e5e7eb;
        }
        .btn[disabled]{opacity:.5;cursor:not-allowed;}
        .btn--primary{background:#2563eb;}
        .btn--danger{background:#dc2626;}
        .btn--muted{background:#343c4a;color:#cbd5e1;}

        @media (max-width: 560px){
          .modal-title{font-size:16px;}
          .grid-row, .grid-row--add{
            grid-template-columns: minmax(0,1fr) 104px;
          }
        }
      `}</style>
    </div>
  );
}
