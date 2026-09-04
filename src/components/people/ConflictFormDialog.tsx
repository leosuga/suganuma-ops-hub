"use client"

import { useEffect, useReducer } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { personConflictSchema } from "@/lib/schemas/people"
import type { PersonConflict } from "@/lib/schemas/people"
import type { PersonRow, PersonConflictRow, ConflictHandling } from "@/lib/types"

type FormState = {
  subject_id: string
  object_id: string
  invite_policy: PersonConflict["invite_policy"]
  excluded_person_id: string
  handling: ConflictHandling[]
  veto_owner: PersonConflict["veto_owner"]
  reason: string
  status: PersonConflict["status"]
  error: string | null
}

type Action =
  | { type: "set"; field: keyof Omit<FormState, "error" | "handling">; value: string }
  | { type: "toggleHandling"; value: ConflictHandling }
  | { type: "error"; message: string | null }
  | { type: "reset"; state: FormState }

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set": {
      const next = { ...state, [action.field]: action.value, error: null }
      // Trocar de política para fora de excluir_um limpa o excluído, senão
      // sobra um id órfão que o refine do Zod rejeita sem motivo visível.
      if (action.field === "invite_policy" && action.value !== "excluir_um") {
        next.excluded_person_id = ""
      }
      // Se mudar subject_id ou object_id enquanto invite_policy é excluir_um,
      // limpar excluded_person_id se ele não aponta mais para nenhuma das duas pontas.
      if (
        (action.field === "subject_id" || action.field === "object_id") &&
        next.invite_policy === "excluir_um" &&
        next.excluded_person_id &&
        next.excluded_person_id !== next.subject_id &&
        next.excluded_person_id !== next.object_id
      ) {
        next.excluded_person_id = ""
      }
      return next
    }
    case "toggleHandling":
      return {
        ...state,
        error: null,
        handling: state.handling.includes(action.value)
          ? state.handling.filter((h) => h !== action.value)
          : [...state.handling, action.value],
      }
    case "error":
      return { ...state, error: action.message }
    case "reset":
      return action.state
  }
}

function initial(anchorPersonId: string, conflict: PersonConflictRow | null): FormState {
  if (conflict) {
    return {
      subject_id: conflict.subject_id,
      object_id: conflict.object_id,
      invite_policy: conflict.invite_policy,
      excluded_person_id: conflict.excluded_person_id ?? "",
      handling: conflict.handling,
      veto_owner: conflict.veto_owner,
      reason: conflict.reason ?? "",
      status: conflict.status,
      error: null,
    }
  }
  return {
    subject_id: anchorPersonId,
    object_id: "",
    invite_policy: "nao_juntos",
    excluded_person_id: "",
    handling: [],
    veto_owner: "eu",
    reason: "",
    status: "ativo",
    error: null,
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: PersonRow[]
  anchorPersonId: string
  conflict: PersonConflictRow | null
  onSubmit: (values: PersonConflict, id?: string) => void
}

export function ConflictFormDialog({
  open,
  onOpenChange,
  people,
  anchorPersonId,
  conflict,
  onSubmit,
}: Props) {
  const [state, dispatch] = useReducer(reducer, initial(anchorPersonId, conflict))

  useEffect(() => {
    if (open) dispatch({ type: "reset", state: initial(anchorPersonId, conflict) })
  }, [open, anchorPersonId, conflict?.id])

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? ""

  function handleSubmit() {
    const parsed = personConflictSchema.safeParse({
      subject_id: state.subject_id,
      object_id: state.object_id,
      invite_policy: state.invite_policy,
      excluded_person_id: state.excluded_person_id || null,
      handling: state.handling,
      veto_owner: state.veto_owner,
      reason: state.reason || null,
      status: state.status,
    })
    if (!parsed.success) {
      dispatch({ type: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos" })
      return
    }
    onSubmit(parsed.data, conflict?.id)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-on-surface/20 max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs tracking-wider text-on-surface">
            {conflict ? "EDITAR CONFLITO" : "NOVO CONFLITO"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="cf-subject">QUEM SE INCOMODA</label>
            <select
              id="cf-subject"
              className={field}
              value={state.subject_id}
              onChange={(e) => dispatch({ type: "set", field: "subject_id", value: e.target.value })}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="cf-object">COM QUEM</label>
            <select
              id="cf-object"
              className={field}
              value={state.object_id}
              onChange={(e) => dispatch({ type: "set", field: "object_id", value: e.target.value })}
            >
              <option value="">Escolha...</option>
              {people
                .filter((p) => p.id !== state.subject_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="cf-policy">POLÍTICA DE CONVITE</label>
            <select
              id="cf-policy"
              className={field}
              value={state.invite_policy}
              onChange={(e) => dispatch({ type: "set", field: "invite_policy", value: e.target.value })}
            >
              <option value="excluir_um">Excluir um dos dois (decisão permanente)</option>
              <option value="nao_juntos">Não podem estar juntos (decido no evento)</option>
              <option value="ok_com_ressalva">Podem vir, com ressalva</option>
            </select>
          </div>

          {state.invite_policy === "excluir_um" ? (
            <div>
              <label className={label} htmlFor="cf-excluded">QUEM FICA DE FORA</label>
              <select
                id="cf-excluded"
                className={field}
                value={state.excluded_person_id}
                onChange={(e) =>
                  dispatch({ type: "set", field: "excluded_person_id", value: e.target.value })
                }
              >
                <option value="">Escolha...</option>
                {state.subject_id ? (
                  <option value={state.subject_id}>{nameOf(state.subject_id)}</option>
                ) : null}
                {state.object_id ? (
                  <option value={state.object_id}>{nameOf(state.object_id)}</option>
                ) : null}
              </select>
            </div>
          ) : null}

          {state.invite_policy === "ok_com_ressalva" ? (
            <div>
              <span className={label}>O QUE FAZER</span>
              <label className="flex items-center gap-2 py-1 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={state.handling.includes("avisar_antes")}
                  onChange={() => dispatch({ type: "toggleHandling", value: "avisar_antes" })}
                />
                Avisar antes
              </label>
              <label className="flex items-center gap-2 py-1 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={state.handling.includes("separar_no_evento")}
                  onChange={() => dispatch({ type: "toggleHandling", value: "separar_no_evento" })}
                />
                Manter afastados no evento
              </label>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cf-veto">DE QUEM É A DECISÃO</label>
              <select
                id="cf-veto"
                className={field}
                value={state.veto_owner}
                onChange={(e) => dispatch({ type: "set", field: "veto_owner", value: e.target.value })}
              >
                <option value="eu">Minha</option>
                <option value="parceira">Dela</option>
                <option value="ambos">Nossa</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cf-status">SITUAÇÃO</label>
              <select
                id="cf-status"
                className={field}
                value={state.status}
                onChange={(e) => dispatch({ type: "set", field: "status", value: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="cf-reason">MOTIVO</label>
            <textarea
              id="cf-reason"
              rows={3}
              className={field}
              value={state.reason}
              onChange={(e) => dispatch({ type: "set", field: "reason", value: e.target.value })}
            />
            <p className="mt-1 font-mono text-[10px] text-on-surface/40">
              Fica só aqui: não entra em busca, embedding nem em ferramenta de IA.
            </p>
          </div>

          {state.error ? (
            <p className="font-mono text-[11px] text-danger">{state.error}</p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 font-mono text-[11px] text-on-surface/60 hover:text-on-surface"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
          >
            SALVAR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
