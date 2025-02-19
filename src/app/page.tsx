"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseCard } from "@/components/ui/expense-card"
import { ExpenseForm } from "@/components/ui/expense-form"
import { ExpenseHistory } from "@/components/ui/expense-history"
import { SettingsView } from "@/components/ui/settings-view"
import { useExpenses } from "@/hooks/use-expenses"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

export default function ExpenseTrackerApp() {
  const { expenses, categories, addExpense, getExpensesByCategory, getTotalByMonth, addCategory, removeCategory } =
    useExpenses()
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const monthlyTotal = getTotalByMonth(currentMonth)
  const expensesByCategory = getExpensesByCategory(currentMonth)

  const handleAddExpense = () => {
    const addExpenseTab = document.querySelector('[value="add-expense"]') as HTMLElement
    if (addExpenseTab) {
      addExpenseTab.click()
    }
  }

  const handleSubmitExpense = (values: any) => {
    addExpense({
      amount: Number.parseFloat(values.amount),
      category: values.category,
      date: values.date.toISOString().slice(0, 10),
      note: values.note,
    })
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

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard">Inicio</TabsTrigger>
            <TabsTrigger value="add-expense">Agregar Gasto</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ExpenseCard
              title="Resumen del Mes"
              description="Vista general de tus gastos"
              total={monthlyTotal}
              data={expensesByCategory}
              onAddExpense={handleAddExpense}
            />
          </TabsContent>

          <TabsContent value="add-expense">
            <ExpenseForm onSubmit={handleSubmitExpense} categories={categories} />
          </TabsContent>

          <TabsContent value="history">
            <ExpenseHistory expenses={expenses} />
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

