// DOM (happy-dom + Docker): a fila de toasts. Antes só cabia UM toast — um
// delete durante outro descartava o desfazer anterior. Esta é a garantia que
// sustenta o "desfazer" do delete em lote de notas e do delete no diálogo.
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { UndoToastProvider, useUndoToast } from "@/components/UndoToast"

function Show({ label, onUndo }: { label: string; onUndo?: () => void }) {
  const toast = useUndoToast()
  return (
    <button onClick={() => toast.show({ label, onUndo })}>mostrar {label}</button>
  )
}

describe("UndoToast — fila", () => {
  it("mantém mais de um toast ao mesmo tempo", () => {
    render(
      <UndoToastProvider>
        <Show label="A" />
        <Show label="B" />
      </UndoToastProvider>
    )
    fireEvent.click(screen.getByText("mostrar A"))
    fireEvent.click(screen.getByText("mostrar B"))
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
  })

  it("DESFAZER roda o callback e remove só aquele toast", () => {
    const onUndoA = vi.fn()
    render(
      <UndoToastProvider>
        <Show label="A" onUndo={onUndoA} />
        <Show label="B" />
      </UndoToastProvider>
    )
    fireEvent.click(screen.getByText("mostrar A"))
    fireEvent.click(screen.getByText("mostrar B"))

    const botoes = screen.getAllByText("DESFAZER")
    expect(botoes).toHaveLength(1) // só o A tem onUndo
    fireEvent.click(botoes[0])

    expect(onUndoA).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("A")).not.toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
  })

  it("o × fecha o toast", () => {
    render(
      <UndoToastProvider>
        <Show label="A" />
      </UndoToastProvider>
    )
    fireEvent.click(screen.getByText("mostrar A"))
    expect(screen.getByText("A")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Fechar aviso"))
    expect(screen.queryByText("A")).not.toBeInTheDocument()
  })
})
