import { useEffect, useRef, type ReactNode } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { ApiError } from '../api';
import type { Order } from '../../shared/types';
import { states, shortDate, time } from '../lib/format';
export function Button({
  children,
  onClick,
  secondary = false,
  className = '',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${secondary ? 'btn-secondary' : 'btn'} ${className}`}
    >
      {children}
    </button>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {states[status] || status}
    </span>
  );
}
export function Message({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
      {error instanceof ApiError && error.fields.length > 0 && (
        <ul>
          {error.fields.map((f, i) => (
            <li key={i}>{f.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ForestArt() {
  return (
    <svg className="forest-art" viewBox="0 0 400 160" aria-hidden="true">
      <path d="M0 131Q90 58 186 128T400 88V160H0Z" fill="#769685" opacity=".24" />
      <path d="M0 142Q110 115 190 142T400 110V160H0Z" fill="#426d55" opacity=".4" />
      {[60, 120, 170, 260, 305, 350].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i % 2 ? 30 : 56})`}>
          <path d="M0 0L-26 44H-16L-32 71H32L16 44H26Z" fill={i % 2 ? '#44715b' : '#254d3a'} />
          <path d="M-2 69H2V90H-2Z" fill="#1d4031" />
        </g>
      ))}
      <path
        d="M176 161C210 140 227 133 252 123"
        stroke="#a3b59a"
        strokeWidth="14"
        fill="none"
        opacity=".4"
      />
    </svg>
  );
}
export function Dialog({
  title,
  description,
  children,
  onClose,
  dirty = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(dirty);
  onCloseRef.current = onClose;
  dirtyRef.current = dirty;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const root = ref.current!;
    (
      root.querySelector<HTMLElement>('input,select,textarea') ||
      root.querySelector<HTMLElement>('button')
    )?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!dirtyRef.current || window.confirm('Zahodit neuložené změny?')) onCloseRef.current();
      }
      if (e.key === 'Tab') {
        const controls = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,a[href]',
          ),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <span className="section-kicker">FORESTER</span>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Zavřít"
            onClick={() => {
              if (!dirty || window.confirm('Zahodit neuložené změny?')) onClose();
            }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Detail({ order }: { order: Order }) {
  return (
    <>
      <div className="detail-status">
        <span>{order.number}</span>
        <Badge status={order.status} />
      </div>
      <div className="route-detail">
        <div>
          <span className="route-dot" />
          <small>NAKLÁDKA</small>
          <h3>{order.pickup}</h3>
          <p>
            {shortDate(order.starts_at)} · {time(order.starts_at)}
          </p>
        </div>
        <div>
          <span className="route-dot end" />
          <small>VYKLÁDKA</small>
          <h3>{order.delivery}</h3>
          <p>
            {shortDate(order.ends_at)} · {time(order.ends_at)}
          </p>
        </div>
      </div>
      <div className="detail-meta">
        <div>
          <span>Řidič</span>
          <strong>{order.driver_name}</strong>
        </div>
        <div>
          <span>Souprava</span>
          <strong>
            {order.plate} {order.trailer_plate && `/ ${order.trailer_plate}`}
          </strong>
        </div>
        <div>
          <span>Náklad</span>
          <strong>Dřevo {order.weight_kg ? `· ${order.weight_kg / 1000} t` : ''}</strong>
        </div>
      </div>
      {order.note && (
        <div className="driver-note">
          <ClipboardList size={18} />
          <div>
            <strong>Pokyny k přepravě</strong>
            <p>{order.note}</p>
          </div>
        </div>
      )}
      <p className="muted small">Plánovaný interval · Europe/Prague</p>
    </>
  );
}
