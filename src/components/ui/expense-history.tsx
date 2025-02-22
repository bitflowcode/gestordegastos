"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"
import { Button } from "@/components/ui/button"
import { Edit, Download, FileDown, Printer, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./sheet"
import { ExpenseForm } from "./expense-form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Input } from "./input"
import jsPDF from "jspdf"
import "jspdf-autotable"

interface Expense {
  id: string
  amount: number
  category: string
  date: string
  note?: string
}

interface ExpenseHistoryProps {
  expenses: Expense[]
  onDeleteExpense?: (id: string) => void
  onEditExpense?: (id: string, expense: Omit<Expense, "id">) => void
  categories: string[]
}

export function ExpenseHistory({ expenses, onDeleteExpense, onEditExpense, categories }: ExpenseHistoryProps) {
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>("all") // Valor por defecto "all"
  const [searchTerm, setSearchTerm] = useState("")

  const handleDelete = () => {
    if (expenseToDelete && onDeleteExpense) {
      onDeleteExpense(expenseToDelete)
      setExpenseToDelete(null)
    }
  }

  const handleEdit = (values: any) => {
    if (expenseToEdit && onEditExpense) {
      onEditExpense(expenseToEdit.id, {
        amount: Number.parseFloat(values.amount),
        category: values.category,
        date: values.date.toISOString().slice(0, 10),
        note: values.note,
      })
      setExpenseToEdit(null)
    }
  }

  // Obtener lista única de meses disponibles
  const months = Array.from(new Set(expenses.map((expense) => expense.date.slice(0, 7)))).sort((a, b) =>
    b.localeCompare(a),
  )

  // Filtrar gastos por mes seleccionado (si no es "all") y término de búsqueda
  const filteredExpenses = expenses
    .filter((expense) => (selectedMonth === "all" ? true : expense.date.startsWith(selectedMonth)))
    .filter(
      (expense) =>
        searchTerm === "" ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.amount.toString().includes(searchTerm),
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  // Calcular total de los gastos filtrados
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const handleExportCSV = () => {
    const headers = ["Fecha", "Categoría", "Importe", "Nota"]
    const csvContent = [
      headers.join(","),
      ...filteredExpenses.map((expense) =>
        [
          new Date(expense.date).toLocaleDateString("es-ES"),
          expense.category,
          expense.amount.toString(),
          expense.note || "",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    const fileName = selectedMonth === "all" ? "todos_los_gastos" : `gastos_${selectedMonth}`
    link.download = `${fileName}.csv`
    link.click()
  }

  const handleExportPDF = () => {
    // Crear una nueva instancia de jsPDF
    const doc = new jsPDF()

    // Título
    const title =
      selectedMonth === "all"
        ? "Todos los Gastos"
        : `Gastos - ${new Date(selectedMonth).toLocaleString("es-ES", { month: "long", year: "numeric" })}`
    doc.setFontSize(16)
    doc.text(title, 14, 15)

    // Total
    doc.setFontSize(12)
    doc.text(`Total: ${formatCurrency(totalAmount)}`, 14, 25)

    // Tabla de gastos
    const tableData = filteredExpenses.map((expense) => [
      new Date(expense.date).toLocaleDateString("es-ES"),
      expense.category,
      formatCurrency(expense.amount),
      expense.note || "-",
    ])

    doc.autoTable({
      head: [["Fecha", "Categoría", "Importe", "Nota"]],
      body: tableData,
      startY: 30,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 66, 66] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    })

    // Guardar el PDF
    const fileName = selectedMonth === "all" ? "todos_los_gastos" : `gastos_${selectedMonth}`
    doc.save(`${fileName}.pdf`)
  }

  const handlePrint = () => {
    const printContent = document.createElement("div")
    const title =
      selectedMonth === "all"
        ? "Todos los Gastos"
        : `Gastos - ${new Date(selectedMonth).toLocaleString("es-ES", { month: "long", year: "numeric" })}`

    printContent.innerHTML = `
      <h2>${title}</h2>
      <p>Total: ${formatCurrency(totalAmount)}</p>
      <table border="1" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Importe</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          ${filteredExpenses
            .map(
              (expense) => `
            <tr>
              <td>${new Date(expense.date).toLocaleDateString("es-ES")}</td>
              <td>${expense.category}</td>
              <td>${formatCurrency(expense.amount)}</td>
              <td>${expense.note || "-"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `

    const printWindow = window.open("", "", "height=600,width=800")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Historial de Gastos</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Gastos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecciona un período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver Todos los Gastos</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {new Date(month).toLocaleString("es-ES", { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoría, nota o importe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="text-lg font-semibold">Total: {formatCurrency(totalAmount)}</div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{new Date(expense.date).toLocaleDateString("es-ES")}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{expense.note || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setExpenseToEdit(expense)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setExpenseToDelete(expense.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!expenseToEdit} onOpenChange={() => setExpenseToEdit(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar Gasto</SheetTitle>
          </SheetHeader>
          {expenseToEdit && (
            <ExpenseForm
              onSubmit={handleEdit}
              categories={categories}
              initialValues={{
                amount: expenseToEdit.amount,
                category: expenseToEdit.category,
                date: new Date(expenseToEdit.date),
                note: expenseToEdit.note || "",
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  )
}

