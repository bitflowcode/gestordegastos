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
import { useMemo, useState } from "react"
import { formatCurrency, formatDateToString, formatMonthLabel } from "@/lib/utils"
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
  isRecurring?: boolean
}

interface ExpenseHistoryProps {
  expenses: Expense[]
  onDeleteExpense?: (id: string) => void
  onEditExpense?: (id: string, expense: Omit<Expense, "id">) => void
  categories: string[]
  /**
   * Meses con gastos en la base de datos, incluidos los anteriores a la ventana
   * de carga. Sin esto el selector se construye solo con lo que hay en memoria,
   * y los meses antiguos desaparecen sin forma de pedirlos.
   */
  availableMonths?: string[]
  isMonthLoaded?: (month: string) => boolean
  loadMonth?: (month: string) => Promise<void>
  loadingMonth?: string | null
}

export function ExpenseHistory({
  expenses,
  onDeleteExpense,
  onEditExpense,
  categories,
  availableMonths,
  isMonthLoaded,
  loadMonth,
  loadingMonth,
}: ExpenseHistoryProps) {
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
        date: formatDateToString(values.date),
        note: values.note,
        isRecurring: values.isRecurring,
      })
      setExpenseToEdit(null)
    }
  }

  // Meses cargados en memoria. Como conjunto y no con isMonthLoaded() por mes:
  // esa función recorre el array de gastos en cada llamada, y el volumen crece
  // mucho al importar extractos.
  const loadedMonths = useMemo(
    () => new Set(expenses.map((expense) => expense.date.slice(0, 7))),
    [expenses]
  )

  // Meses ofrecidos: los que existen en la base de datos más los que hay en
  // memoria. La unión importa porque `availableMonths` se calcula al cargar y
  // no se recalcula al añadir un gasto: sin ella, un gasto en un mes nuevo no
  // aparecería en el selector hasta recargar.
  const months = useMemo(
    () =>
      Array.from(new Set((availableMonths || []).concat(Array.from(loadedMonths)))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [availableMonths, loadedMonths]
  )

  // Meses que existen pero cuyos gastos no están cargados. Se avisa porque el
  // total de "Ver Todos los Gastos" solo suma lo cargado.
  const unloadedMonths = months.filter((m) => !loadedMonths.has(m))
  // Ningún mes en memoria y sí meses con gastos en la base: el total sería un
  // 0,00 € creíble y falso, así que no se muestra total en ese caso.
  const nothingLoaded =
    selectedMonth === "all" && loadedMonths.size === 0 && unloadedMonths.length > 0
  const selectedMonthMissing =
    selectedMonth !== "all" && !!isMonthLoaded && !isMonthLoaded(selectedMonth)
  const isLoadingSelectedMonth = loadingMonth === selectedMonth

  // Pide el mes al seleccionarlo. El estado se cambia igualmente: mientras
  // llega, la vista dice que está cargando en lugar de enseñar un total de cero.
  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month)
    if (month !== "all" && loadMonth && isMonthLoaded && !isMonthLoaded(month)) {
      void loadMonth(month)
    }
  }

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
    if (typeof window === 'undefined') return
    
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
        : `Gastos - ${formatMonthLabel(selectedMonth)}`
    doc.setFontSize(16)
    doc.text(title, 14, 15)

    // Total
    doc.setFontSize(12)
    doc.text(`Total: ${formatCurrency(totalAmount)}`, 14, 25)

    // Tabla de gastos
    const tableData = filteredExpenses.map((expense) => [
      new Date(expense.date).toLocaleDateString("es-ES"),
      (expense.isRecurring || expense.note?.includes('recurrente') || expense.note?.includes('🔄')) ? '🔄 ' + expense.category : expense.category,
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
    if (typeof window === 'undefined') return
    
    const printContent = document.createElement("div")
    const title =
      selectedMonth === "all"
        ? "Todos los Gastos"
        : `Gastos - ${formatMonthLabel(selectedMonth)}`

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
              <td>${(expense.isRecurring || expense.note?.includes('recurrente') || expense.note?.includes('🔄')) ? '🔄 ' : ''}${expense.category}</td>
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
          <Select value={selectedMonth} onValueChange={handleSelectMonth}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecciona un período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver Todos los Gastos</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {/* Sin los datos del mes cargados, exportar produciría un archivo
                vacío con apariencia de completo. */}
            <Button variant="outline" onClick={handleExportCSV} disabled={selectedMonthMissing || nothingLoaded}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={selectedMonthMissing || nothingLoaded}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={selectedMonthMissing || nothingLoaded}>
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

        {/* Un mes fuera de la ventana de carga no muestra total ni tabla: un cero
            o una tabla vacía se leen como "no hubo gastos", que es falso. */}
        {selectedMonthMissing ? (
          <div className="rounded-md border p-6 text-center space-y-3">
            {isLoadingSelectedMonth ? (
              <p className="text-muted-foreground">
                Cargando los gastos de {formatMonthLabel(selectedMonth)}…
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Los gastos de {formatMonthLabel(selectedMonth)} no se han podido cargar.
                </p>
                <Button variant="outline" onClick={() => loadMonth?.(selectedMonth)}>
                  Reintentar
                </Button>
              </>
            )}
          </div>
        ) : (
        <>
        <div className="space-y-1">
          {nothingLoaded ? (
            <p className="text-muted-foreground">
              Ningún mes está cargado todavía. Hay {unloadedMonths.length} meses con gastos:
              selecciona uno en la lista para consultarlo.
            </p>
          ) : (
            <>
              <div className="text-lg font-semibold">
                {selectedMonth === "all" && unloadedMonths.length > 0 ? "Total cargado: " : "Total: "}
                {formatCurrency(totalAmount)}
              </div>
              {selectedMonth === "all" && unloadedMonths.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  No incluye {unloadedMonths.length}{" "}
                  {unloadedMonths.length === 1 ? "mes anterior" : "meses anteriores"} sin cargar.
                  Selecciónalos en la lista para consultarlos.
                </p>
              )}
            </>
          )}
        </div>

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
                  <TableCell>{(expense.isRecurring || expense.note?.includes('recurrente') || expense.note?.includes('🔄')) ? '🔄 ' + expense.category : expense.category}</TableCell>
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
        </>
        )}
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
                isRecurring: expenseToEdit.isRecurring || false,
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  )
}

