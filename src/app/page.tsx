"use client"

// Forzar renderización dinámica para evitar errores de precompilación
export const dynamic = 'force-dynamic'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseCard } from "@/components/ui/expense-card"
import { ExpenseForm } from "@/components/ui/expense-form"
import { ExpenseHistory } from "@/components/ui/expense-history"
import { SettingsView } from "@/components/ui/settings-view"
import { useExpensesHybrid } from "@/hooks/use-expenses-hybrid"
import { useAuth } from "@/components/auth-provider"
import { formatDateToString } from "@/lib/utils"
import { useState, useEffect } from "react"
import { FabAddExpense } from "@/components/ui/fab-add-expense"
import { ChevronLeft, ChevronRight, Edit, Trash2, Cloud, Loader2, User } from "lucide-react"
import { useRecurringExpenses } from "@/hooks/use-recurring-expenses"
import { RecurringExpenseForm } from "@/components/ui/recurring-expense-form"
import { UpgradePrompt } from "@/components/ui/upgrade-prompt"
import { AuthModal } from "@/components/ui/auth-modal"
import type { Expense } from "@/hooks/use-expenses-hybrid"
import type { RecurringExpense } from "@/hooks/use-recurring-expenses"

// Lógica para sugerir recurrentes
function getRecurringSuggestions(expenses: Expense[], recurrings: RecurringExpense[]) {
  // Buscar gastos que se repiten (mismo importe y categoría, en al menos 2 meses distintos, y no son recurrentes ya)
  const map = new Map<string, Expense[]>()
  expenses.forEach((e: Expense) => {
    const key = `${e.amount}|${e.category}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  })
  // Sugerir si hay al menos 2 meses distintos y no existe ya como recurrente
  return Array.from(map.values())
    .filter((arr: Expense[]) => {
      const months = new Set(arr.map((e: Expense) => e.date.slice(0, 7)))
      const already = recurrings.some((r: RecurringExpense) => r.amount === arr[0].amount && r.category === arr[0].category)
      return months.size >= 2 && !already
    })
    .map((arr: Expense[]) => arr[0]) // Sugerir el primero de cada grupo
}

export default function ExpenseTrackerApp() {
  const { user, isGuest, isLoading: authLoading, signUp, signIn, signOut, shouldShowUpgradePrompt, dismissUpgradePrompt, canUpgrade } = useAuth()
  
  const {
    expenses,
    categories,
    isLoading: expensesLoading,
    isSyncing,
    addExpense,
    deleteExpense,
    updateExpense,
    getExpensesByCategory,
    getTotalByMonth,
    addCategory,
    removeCategory,
  } = useExpensesHybrid(user)

  const {
    recurrings,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  } = useRecurringExpenses()

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
      isRecurring: values.isRecurring || false,
    })
    setActiveTab("dashboard")
  }

  const handleEditExpense = (id: string, expense: any) => {
    updateExpense(id, expense)
  }

  const handleExportData = () => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return
    
    const dataStr = JSON.stringify(expenses, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    const exportFileDefaultName = "expense_data.json"

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  // Estado para modal de recurrentes
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState(null as null | string)

  // Alta automática de recurrentes
  useEffect(() => {
    if (!recurrings.length || !expenses.length) return
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    recurrings.forEach(rec => {
      const day = String(Math.min(rec.day, 28)) // Evitar problemas con febrero
      const dateStr = `${year}-${month}-${day}`
      const exists = expenses.some(e =>
        e.category === rec.category &&
        e.amount === rec.amount &&
        e.date === dateStr &&
        e.note === rec.note
      )
      if (!exists && now.getDate() >= rec.day) {
        addExpense({
          amount: rec.amount,
          category: rec.category,
          date: dateStr,
          note: rec.note || "(recurrente)",
          isRecurring: true,
        })
      }
    })
  }, [recurrings, expenses])

  const suggestions = getRecurringSuggestions(expenses, recurrings)

  // Estados para upgrade y auth
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<"login" | "signup">("signup")
  const [isManualUpgrade, setIsManualUpgrade] = useState(false) // Para diferenciar upgrade manual vs automático

  // Verificar si mostrar upgrade prompt automático
  useEffect(() => {
    if (!authLoading && !isManualUpgrade && shouldShowUpgradePrompt()) {
      setShowUpgradePrompt(true)
    }
  }, [authLoading, shouldShowUpgradePrompt, expenses.length, isManualUpgrade]) // También verificar cuando cambie el número de gastos

  if (authLoading || expensesLoading) {
    return (
      <div className="container mx-auto p-6 max-w-screen-lg flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-screen-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">Gestor de Gastos</h1>

        {/* Upgrade Prompt - mostrar en el dashboard o por click manual */}
        {showUpgradePrompt && isGuest && (activeTab === "dashboard" || isManualUpgrade) && (
          <UpgradePrompt
            expenseCount={expenses.length}
            isAutomatic={!isManualUpgrade}
            onCreateAccount={() => {
              setShowUpgradePrompt(false)
              setIsManualUpgrade(false)
              setAuthModalDefaultTab("signup")
              setShowAuthModal(true)
            }}
            onDismiss={() => {
              const wasManual = isManualUpgrade
              setShowUpgradePrompt(false)
              setIsManualUpgrade(false)
              if (!wasManual) {
                dismissUpgradePrompt() // Solo descartar automáticamente si era automático
              }
            }}
          />
        )}

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
            {/* Tarjeta de Gastos Recurrentes */}
            <div className="mt-6 mb-4">
              <div className="rounded-xl bg-background text-foreground border border-border shadow p-6 flex flex-col items-start w-full">
                <h2 className="text-lg font-bold text-foreground mb-1">Gastos Recurrentes</h2>
                <p className="text-foreground mb-4 text-sm">Programa aquí tus gastos fijos mensuales (suscripciones, alquiler, servicios, etc.) y olvídate de añadirlos manualmente cada mes.</p>
                <ul className="w-full mb-4">
                  {recurrings.length === 0 && <li className="text-muted-foreground text-sm">No tienes gastos recurrentes registrados.</li>}
                  {recurrings.map(r => (
                    <li key={r.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="text-xl">🔄</span>
                        <span className="font-medium">{r.category}</span>
                        <span className="text-xs text-muted-foreground">día {r.day}</span>
                        <span className="ml-2 text-sm">{r.note}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <button onClick={() => { setEditingRecurring(r.id); setShowRecurringForm(true) }} className="p-1 text-blue-700 hover:text-blue-900"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => deleteRecurring(r.id)} className="p-1 text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shadow transition-colors"
                  onClick={() => { setEditingRecurring(null); setShowRecurringForm(true) }}
                >
                  Agregar Gasto Recurrente
                </button>
              </div>
            </div>
            {/* Lista de Gastos Recurrentes del Mes */}
            <div className="mb-4">
              <div className="rounded-xl bg-background text-foreground border border-border shadow p-6 flex flex-col items-start w-full">
                <h2 className="text-lg font-bold text-foreground mb-2">Lista de Gastos Recurrentes del Mes</h2>
                <ul className="w-full">
                  {expenses.filter(e =>
                    (e.isRecurring || 
                     e.note?.includes('recurrente') || 
                     e.note?.includes('🔄') ||
                     recurrings.some(r =>
                       e.category === r.category &&
                       e.amount === r.amount &&
                       e.date.startsWith(selectedMonth)
                     )) && e.date.startsWith(selectedMonth)
                  ).length === 0 && (
                    <li className="text-muted-foreground text-sm">No hay gastos recurrentes materializados este mes.</li>
                  )}
                  {expenses.filter(e =>
                    (e.isRecurring || 
                     e.note?.includes('recurrente') || 
                     e.note?.includes('🔄') ||
                     recurrings.some(r =>
                       e.category === r.category &&
                       e.amount === r.amount &&
                       e.date.startsWith(selectedMonth)
                     )) && e.date.startsWith(selectedMonth)
                  ).map(e => (
                    <li key={e.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">{(e.isRecurring || e.note?.includes('recurrente') || e.note?.includes('🔄')) ? '🔄 ' : ''}{e.category}</span>
                        <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("es-ES")}</span>
                        <span className="text-sm text-foreground">{e.note}</span>
                      </span>
                      <span className="font-semibold text-foreground">{e.amount.toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Sugerencias de recurrentes */}
            {suggestions.length > 0 && (
              <div className="mb-4">
                <div className="rounded-xl bg-[#c2f8d0] border border-[#96c8a4] shadow p-4 flex flex-col items-start">
                  <h3 className="text-base font-bold text-blue-900 mb-1">¿Quieres marcar alguno de estos gastos como recurrente?</h3>
                  <ul className="w-full mb-2">
                    {suggestions.map(s => (
                      <li key={s.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <span className="flex items-center gap-2 text-blue-900">
                          <span className="font-medium">{s.category}</span>
                          <span className="text-xs text-blue-700">{s.amount} €</span>
                        </span>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded shadow text-sm"
                          onClick={() => addRecurring({ amount: s.amount, category: s.category, day: Number(s.date.slice(8, 10)), note: s.note })}
                        >
                          Marcar como recurrente
                        </button>
                      </li>
                    ))}
                  </ul>
                  <span className="text-xs text-blue-700">Detectamos gastos similares en meses distintos.</span>
                </div>
              </div>
            )}
            {/* Modal de formulario de recurrentes */}
            {showRecurringForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-background text-foreground rounded-xl shadow-lg p-6 w-full max-w-md mx-3 animate-fade-in">
                  <h3 className="text-lg font-bold mb-4 text-foreground">{editingRecurring ? "Editar Gasto Recurrente" : "Agregar Gasto Recurrente"}</h3>
                  <RecurringExpenseForm
                    categories={categories}
                    initialValues={editingRecurring ? recurrings.find(r => r.id === editingRecurring) : undefined}
                    onSubmit={values => {
                      if (editingRecurring) {
                        updateRecurring(editingRecurring, values)
                      } else {
                        addRecurring(values)
                      }
                      setShowRecurringForm(false)
                      setEditingRecurring(null)
                    }}
                    onCancel={() => { setShowRecurringForm(false); setEditingRecurring(null) }}
                    addCategory={addCategory}
                  />
                </div>
              </div>
            )}
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
            {/* Estado de la cuenta */}
            {isGuest ? (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Estado de tu cuenta</h3>
                <p className="text-blue-700 text-sm mb-3">
                  Estás usando la app sin cuenta. Tus datos se almacenan localmente en este dispositivo.
                </p>
                <button
                  onClick={() => {
                    setAuthModalDefaultTab("signup")
                    setShowAuthModal(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                >
                  Crear cuenta para sincronizar
                </button>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Cuenta sincronizada ✅</h3>
                <p className="text-green-700 text-sm mb-3">
                  Email: {user?.email}
                  <br />
                  Tus datos se sincronizan automáticamente en todos tus dispositivos.
                </p>
                <button
                  onClick={signOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                >
                  Cerrar sesión
                </button>
              </div>
            )}

            <SettingsView
              onExportData={handleExportData}
              categories={categories}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
            />
          </TabsContent>
        </Tabs>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSignUp={signUp}
          onSignIn={signIn}
          defaultTab={authModalDefaultTab}
        />

        {/* Indicador de sincronización */}
        {isSyncing && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Sincronizando datos...</span>
          </div>
        )}

        {/* Botones de acción - responsive */}
        {canUpgrade() && (
          <div className="flex justify-center md:justify-end md:fixed md:top-4 md:right-4 mb-4 md:mb-0 gap-2 z-40">
            <button
              onClick={() => {
                setAuthModalDefaultTab("login")
                setShowAuthModal(true)
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs md:text-sm font-medium transition-colors"
            >
              <User className="h-3 w-3 md:h-4 md:w-4" />
              <span>Iniciar Sesión</span>
            </button>
            
            <button
              onClick={() => {
                setIsManualUpgrade(true)
                setShowUpgradePrompt(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs md:text-sm font-medium transition-colors"
            >
              <Cloud className="h-3 w-3 md:h-4 md:w-4" />
              <span>Upgrade</span>
            </button>
          </div>
        )}

        {/* Indicador de usuario autenticado */}
        {!isGuest && (
          <div className="flex justify-center md:justify-end md:fixed md:top-4 md:right-4 mb-4 md:mb-0">
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <Cloud className="h-3 w-3" />
              <span>Sincronizado</span>
            </div>
          </div>
        )}
      </div>
  )
}

