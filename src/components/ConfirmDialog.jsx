import React, { createContext, useCallback, useContext, useState } from "react";
import { ACCENT, CARD, FONT_BODY, FONT_HEAD, INK, LINE, PAPER, PENDIENTE } from "../constants.js";

/* ============================================================
   Reemplaza los window.confirm / window.alert nativos del navegador
   (los feos, grises, que no combinan con la app) por un cartel propio,
   con la misma estética de la aplicación.

   Uso:
     const confirm = useConfirm();
     const alertUser = useAppAlert();

     const eliminar = async () => {
       if (!(await confirm("¿Seguro que querés eliminar esto?"))) return;
       ...
     };

   Hay que envolver el árbol de la app con <ConfirmProvider> una sola vez
   (ya está hecho en App.jsx), y listo: cualquier componente hijo puede
   usar los hooks de acá arriba sin necesidad de recibir nada por props.
   ============================================================ */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  // dialog: { kind: "confirm" | "alert", message, resolve, danger, confirmLabel, cancelLabel }

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        kind: "confirm",
        message,
        resolve,
        danger: !!opts.danger,
        confirmLabel: opts.confirmLabel || "Sí, confirmar",
        cancelLabel: opts.cancelLabel || "Cancelar",
      });
    });
  }, []);

  const alertUser = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        kind: "alert",
        message,
        resolve,
        confirmLabel: opts.confirmLabel || "Entendido",
      });
    });
  }, []);

  const cerrar = (valor) => {
    if (dialog) dialog.resolve(valor);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alertUser }}>
      {children}
      {dialog && (
        <div
          className="no-print"
          onClick={() => cerrar(dialog.kind === "confirm" ? false : undefined)}
          style={{
            position: "fixed", inset: 0, background: "rgba(44, 31, 27, 0.55)",
            zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: CARD, border: `1px solid ${LINE}`, borderRadius: 10,
              padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 18px 44px rgba(44, 31, 27, 0.3)",
            }}
          >
            <p style={{
              fontFamily: FONT_HEAD, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em",
              color: dialog.danger ? PENDIENTE : ACCENT, fontWeight: 700, marginBottom: 10,
            }}>
              {dialog.kind === "confirm" ? "Confirmar" : "Aviso"}
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: INK, lineHeight: 1.5, marginBottom: 22, whiteSpace: "pre-line" }}>
              {dialog.message}
            </p>
            <div className="flex gap-2 justify-end">
              {dialog.kind === "confirm" && (
                <button
                  onClick={() => cerrar(false)}
                  className="px-4 py-2 rounded text-sm"
                  style={{ border: `1px solid ${LINE}`, color: INK, fontFamily: FONT_BODY, background: "transparent", cursor: "pointer" }}
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                onClick={() => cerrar(true)}
                autoFocus
                className="px-4 py-2 rounded text-sm font-medium"
                style={{ border: "none", color: "#fff", fontFamily: FONT_BODY, background: dialog.danger ? PENDIENTE : ACCENT, cursor: "pointer" }}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  return ctx.confirm;
}

export function useAppAlert() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useAppAlert debe usarse dentro de <ConfirmProvider>");
  return ctx.alertUser;
}
