import { Plus } from "lucide-react"

interface FabAddExpenseProps {
  onClick: () => void
}

export function FabAddExpense({ onClick }: FabAddExpenseProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-full bg-blue-500 shadow-lg flex items-center justify-center text-white text-3xl hover:bg-blue-600 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
      aria-label="Agregar nuevo gasto"
    >
      <Plus className="w-8 h-8" />
    </button>
  )
} 