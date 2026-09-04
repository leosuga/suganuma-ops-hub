"use client"

import { useEffect, useReducer } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { personSchema } from "@/lib/schemas/people"
import type { Person } from "@/lib/schemas/people"
import type { PersonRow } from "@/lib/types"

type FormState = {
  name: string
  nickname: string
  side: Person["side"]
  circle: Person["circle"]
  household: string
  phone: string
  email: string
  birthday: string
  notes: string
  error: string | null
}

const EMPTY: FormState = {
  name: "",
  nickname: "",
  side: "outro",
  circle: "outro",
  household: "",
  phone: "",
  email: "",
  birthday: "",
  notes: "",
  error: null,
}

type Action =
  | { type: "set"; field: keyof Omit<FormState, "error">; value: string }
  | { type: "error"; message: string | null }
  | { type: "reset"; state: FormState }

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value, error: null }
    case "error":
      return { ...state, error: action.message }
    case "reset":
      return action.state
  }
}

function fromRow(person: PersonRow | null): FormState {
  if (!person) return EMPTY
  return {
    name: person.name,
    nickname: person.nickname ?? "",
    side: person.side,
    circle: person.circle,
    household: person.household ?? "",
    phone: person.phone ?? "",
    email: person.email ?? "",
    birthday: person.birthday ?? "",
    notes: person.notes ?? "",
    error: null,
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: PersonRow | null
  onSubmit: (values: Person, id?: string) => void
}

export function PersonFormDialog({ open, onOpenChange, person, onSubmit }: Props) {
  const [state, dispatch] = useReducer(reducer, EMPTY)

  // Deps primitivas: o objeto `person` muda de identidade a cada refetch do
  // TanStack Query e resetaria o formulário no meio da digitação.
  useEffect(() => {
    if (open) dispatch({ type: "reset", state: fromRow(person) })
  }, [open, person?.id])

  function handleSubmit() {
    const parsed = personSchema.safeParse({
      name: state.name,
      nickname: state.nickname || null,
      side: state.side,
      circle: state.circle,
      household: state.household || null,
      phone: state.phone || null,
      email: state.email || null,
      birthday: state.birthday || null,
      notes: state.notes || null,
      // Sem campo de tags nesta UI (fora do escopo). Preservar as tags
      // existentes da pessoa em edição — `tags: []` incondicional apagava
      // tags de pessoas editadas só para corrigir outro campo.
      tags: person?.tags ?? [],
    })
    if (!parsed.success) {
      dispatch({ type: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos" })
      return
    }
    onSubmit(parsed.data, person?.id)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-on-surface/20 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs tracking-wider text-on-surface">
            {person ? "EDITAR PESSOA" : "NOVA PESSOA"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="pf-name">NOME</label>
            <input
              id="pf-name"
              className={field}
              value={state.name}
              onChange={(e) => dispatch({ type: "set", field: "name", value: e.target.value })}
            />
          </div>

          <div>
            <label className={label} htmlFor="pf-nick">APELIDO</label>
            <input
              id="pf-nick"
              className={field}
              value={state.nickname}
              onChange={(e) => dispatch({ type: "set", field: "nickname", value: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="pf-side">LADO</label>
              <select
                id="pf-side"
                className={field}
                value={state.side}
                onChange={(e) => dispatch({ type: "set", field: "side", value: e.target.value })}
              >
                <option value="leo">Meu</option>
                <option value="parceira">Dela</option>
                <option value="comum">Comum</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pf-circle">CÍRCULO</label>
              <select
                id="pf-circle"
                className={field}
                value={state.circle}
                onChange={(e) => dispatch({ type: "set", field: "circle", value: e.target.value })}
              >
                <option value="familia_nuclear">Família nuclear</option>
                <option value="familia_extensa">Família extensa</option>
                <option value="amigos">Amigos</option>
                <option value="trabalho">Trabalho</option>
                <option value="vizinhos">Vizinhos</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="pf-email">E-MAIL</label>
            <input
              id="pf-email"
              type="email"
              className={field}
              value={state.email}
              onChange={(e) => dispatch({ type: "set", field: "email", value: e.target.value })}
            />
          </div>

          <div>
            <label className={label} htmlFor="pf-house">GRUPO FAMILIAR</label>
            <input
              id="pf-house"
              className={field}
              placeholder="Ex: Casa da tia Rosa"
              value={state.household}
              onChange={(e) => dispatch({ type: "set", field: "household", value: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="pf-phone">TELEFONE</label>
              <input
                id="pf-phone"
                className={field}
                value={state.phone}
                onChange={(e) => dispatch({ type: "set", field: "phone", value: e.target.value })}
              />
            </div>
            <div>
              <label className={label} htmlFor="pf-bday">ANIVERSÁRIO</label>
              <input
                id="pf-bday"
                type="date"
                className={field}
                value={state.birthday}
                onChange={(e) => dispatch({ type: "set", field: "birthday", value: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="pf-notes">NOTAS</label>
            <textarea
              id="pf-notes"
              rows={3}
              className={field}
              value={state.notes}
              onChange={(e) => dispatch({ type: "set", field: "notes", value: e.target.value })}
            />
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
