"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    danger?: boolean;
    resolve?: (value: boolean) => void;
  }>({ open: false, title: "" });

  const confirm = (opts: { title: string; description?: string; danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  };

  const dialog: ReactNode = (
    <Modal
      open={state.open}
      onClose={() => {
        state.resolve?.(false);
        setState((s) => ({ ...s, open: false }));
      }}
      title={state.title}
      description={state.description}
    >
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            state.resolve?.(false);
            setState((s) => ({ ...s, open: false }));
          }}
        >
          Cancelar
        </Button>
        <Button
          variant={state.danger ? "danger" : "primary"}
          onClick={() => {
            state.resolve?.(true);
            setState((s) => ({ ...s, open: false }));
          }}
        >
          Confirmar
        </Button>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}
