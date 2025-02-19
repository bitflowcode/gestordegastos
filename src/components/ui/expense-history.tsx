import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Expense } from "@/hooks/use-expenses"

interface ExpenseHistoryProps {
  expenses: Expense[]
}

export function ExpenseHistory({ expenses }: ExpenseHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  const filteredExpenses = expenses.filter((expense) => expense.date.startsWith(selectedMonth))

  const months = Array.from(new Set(expenses.map((expense) => expense.date.slice(0, 7)))).sort((a, b) =>
    b.localeCompare(a),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Gastos</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] mb-4">
            <SelectValue placeholder="Selecciona un mes" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {new Date(month).toLocaleString("es-ES", { month: "long", year: "numeric" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{new Date(expense.date).toLocaleDateString("es-ES")}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell>${expense.amount.toFixed(2)}</TableCell>
                <TableCell>{expense.note || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

