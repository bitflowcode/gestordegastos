"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseCard } from "@/components/ui/expense-card"
import { ExpenseForm } from "@/components/ui/expense-form"
import { ExpenseHistory } from "@/components/ui/expense-history"
import { SettingsView } from "@/components/ui/settings-view"
import { useExpenses } from "@/hooks/use-expenses"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { formatDateToString } from "@/lib/utils"
import { useState } from "react"
import { FabAddExpense } from "@/components/ui/fab-add-expense"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function ExpenseTrackerApp() {
  const {
    expenses,
    categories,
    addExpense,
    deleteExpense,
    updateExpense,
    getExpensesByCategory,
    getTotalByMonth,
    addCategory,
    removeCategory,
  } = useExpenses()

  // Obtener todos los meses con gastos registrados
  const allMonths = Array.from(new Set(expenses.map(e => e.date.slice(0, 7)))).sort()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [activeTab, setActiveTab] = useState("dashboard")

  // Calcular el índice del mes seleccionado
  const selectedMonthIndex = allMonths.indexOf(selectedMonth)

  // Actualizar resumen según el mes seleccionado
  const monthlyTotal = getTotalByMonth(selectedMonth)
  const expensesByCategory = getExpensesByCategory(selectedMonth)

  // Funciones para navegar entre meses
  const goToPrevMonth = () => {
    if (selectedMonthIndex > 0) setSelectedMonth(allMonths[selectedMonthIndex - 1])
  }
  const goToNextMonth = () => {
    if (selectedMonthIndex < allMonths.length - 1) setSelectedMonth(allMonths[selectedMonthIndex + 1])
  }

  const handleAddExpense = () => {
    setActiveTab("add-expense")
  }

  const handleViewHistory = () => {
    setActiveTab("history")
  }

  const handleSubmitExpense = (values: any) => {
    // Asegurar que la fecha esté en el formato correcto sin problemas de zona horaria
    let dateString: string
    if (values.date instanceof Date) {
      dateString = formatDateToString(values.date)
    } else if (typeof values.date === 'string') {
      dateString = values.date
    } else {
      dateString = formatDateToString(new Date())
    }

    addExpense({
      amount: Number.parseFloat(values.amount),
      category: values.category,
      date: dateString,
      note: values.note || "",
    })
    setActiveTab("dashboard")
  }

  const handleEditExpense = (id: string, expense: any) => {
    updateExpense(id, expense)
  }

  const handleExportData = () => {
    const dataStr = JSON.stringify(expenses, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    const exportFileDefaultName = "expense_data.json"

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Gestor de Gastos</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard">Inicio</TabsTrigger>
            <TabsTrigger value="add-expense">Agregar Gasto</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            {/* Selector de mes con flechas */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={goToPrevMonth} disabled={selectedMonthIndex <= 0} className="p-2 disabled:opacity-30">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-lg font-medium">
                {selectedMonth ? new Date(selectedMonth + "-01").toLocaleString("es-ES", { month: "long", year: "numeric" }) : ""}
              </span>
              <button onClick={goToNextMonth} disabled={selectedMonthIndex >= allMonths.length - 1} className="p-2 disabled:opacity-30">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            <ExpenseCard
              title="Resumen del Mes"
              description="Vista general de tus gastos"
              total={monthlyTotal}
              data={expensesByCategory}
              onViewHistory={handleViewHistory}
            />
            <FabAddExpense onClick={() => setActiveTab("add-expense")}/>
          </TabsContent>

          <TabsContent value="add-expense">
            <ExpenseForm onSubmit={handleSubmitExpense} categories={categories} addCategory={addCategory} />
          </TabsContent>

          <TabsContent value="history">
            <ExpenseHistory
              expenses={expenses}
              categories={categories}
              onDeleteExpense={deleteExpense}
              onEditExpense={handleEditExpense}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsView
              onExportData={handleExportData}
              categories={categories}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
            />
          </TabsContent>
        </Tabs>

        <Toaster />
      </div>
    </ThemeProvider>
  )
}

