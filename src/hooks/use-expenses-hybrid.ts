"use client"

import { useState, useEffect, useRef } from "react"
import { generateUUID, formatDateToString } from "@/lib/utils"
import { supabase, isSupabaseConfigured, type ExpenseSource } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export interface Expense {
  id: string
  amount: number
  category: string
  date: string
  note?: string
  isRecurring?: boolean

  // --- Módulo "Tarjetas" ---
  // Opcionales: un gasto manual no los lleva. `amount` sigue siendo siempre el
  // importe en la divisa base; originalAmount/currency/exchangeRate conservan
  // el dato de origen para que la conversión sea auditable y recalculable.
  source?: ExpenseSource
  externalId?: string | null
  cardLast4?: string | null
  merchant?: string | null
  currency?: string | null
  originalAmount?: number | null
  exchangeRate?: number | null
}

const STORAGE_KEY = "expenses-data"
const CATEGORIES_KEY = "expense-categories"
const MIGRATION_KEY = "data-migrated"

const DEFAULT_CATEGORIES = ["Alimentación", "Transporte", "Vivienda", "Entretenimiento", "Salud", "Educación", "Otros"]

/**
 * Meses que se cargan por defecto. Acota el crecimiento sin ocultar nada:
 * la importación de extractos puede añadir entre 50 y 150 movimientos al mes,
 * y hasta ahora se cargaba el histórico completo sin paginar en cada arranque.
 *
 * 24 y no 13 a propósito: con el volumen actual, 13 recortaría meses que hoy
 * son visibles a cambio de ningún ahorro. Los meses anteriores no se pierden,
 * se piden bajo demanda con loadMonth().
 */
const LOAD_WINDOW_MONTHS = 24

/**
 * Mínimo entre recargas al volver a la aplicación. Sin él, cambiar de ventana
 * tres veces seguidas dispararía tres cargas completas. Es el mismo criterio
 * que aplican las bibliotecas de datos al revalidar por foco.
 */
const REVALIDATE_MIN_MS = 60_000

/** Primer día del mes que abre la ventana de carga, en fecha local. */
function windowStartDate(months: number): string {
  const d = new Date()
  d.setDate(1)              // antes de restar meses, para que no desborde
  d.setMonth(d.getMonth() - months)
  return formatDateToString(d)   // nunca toISOString: desplazaría el día
}

/** Primer día del mes siguiente a 'YYYY-MM', para consultas por rango. */
function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

type ExpenseRow = {
  id: string
  amount: number
  category: string
  date: string
  note: string | null
  is_recurring: boolean | null
  source: string | null
  external_id: string | null
  card_last4: string | null
  merchant: string | null
  currency: string | null
  original_amount: number | null
  exchange_rate: number | null
}

/** Única conversión fila de BD -> Expense. */
function mapExpenseFromDb(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category,
    date: row.date,
    note: row.note || "",
    isRecurring: row.is_recurring || false,
    source: (row.source ?? 'manual') as ExpenseSource,
    externalId: row.external_id ?? null,
    cardLast4: row.card_last4 ?? null,
    merchant: row.merchant ?? null,
    currency: row.currency ?? null,
    originalAmount: row.original_amount ?? null,
    exchangeRate: row.exchange_rate ?? null,
  }
}

export function useExpensesHybrid(user: User | null) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  // Meses con gastos, también fuera de la ventana de carga.
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null)

  // Rastrea el userId previo para distinguir carga inicial de refrescos de token
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  // Meses anteriores a la ventana que el usuario ha pedido con loadMonth().
  // Hay que recordarlos porque loadFromSupabase() REEMPLAZA el estado, y se
  // ejecuta muchas más veces de lo que parece: onAuthStateChange dispara un
  // setUser nuevo al refrescar el token y al volver el foco a la ventana, así
  // que sin esto el mes consultado desaparecía de la pantalla solo con cambiar
  // de aplicación y volver.
  const extraMonthsRef = useRef<Set<string>>(new Set())

  /** Momento de la última carga completa, para no repetirla al volver el foco. */
  const lastLoadRef = useRef(0)

  const isGuest = !user

  // Cargar datos al inicializar o cuando cambia la identidad del usuario
  useEffect(() => {
    const isFirstLoad = prevUserIdRef.current === undefined
    const userIdChanged = prevUserIdRef.current !== (user?.id ?? null)
    prevUserIdRef.current = user?.id ?? null

    // Solo mostrar pantalla de carga en la primera carga o si el usuario cambia.
    // Si es un refresco de token (mismo userId), sincronizar en segundo plano.
    loadData(isFirstLoad || userIdChanged)
    // Depende del IDENTIFICADOR, no del objeto: onAuthStateChange entrega un
    // `user` nuevo en cada refresco de token, y con [user] este efecto recargaba
    // todo tres veces al arrancar y otra más cada vez que la ventana recuperaba
    // el foco, borrando de paso los meses pedidos con loadMonth().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true)
    try {
      if (isGuest) {
        // Modo guest: usar localStorage
        await loadFromLocalStorage()
      } else {
        // Modo autenticado: usar Supabase
        await loadFromSupabase()
        // Migrar datos de localStorage si es la primera vez
        await migrateLocalDataIfNeeded()
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      lastLoadRef.current = Date.now()
      setIsLoading(false)
    }
  }

  // Revalidación al volver a la aplicación. Es deliberada y acotada: los datos
  // cambian sin que el usuario toque nada (importador de Gmail, webhooks de
  // n8n), así que conviene refrescar al regresar, pero no en cada alternancia
  // de ventana. Antes ocurría por accidente, como efecto colateral de los
  // eventos de sesión, y de forma distinta en cada navegador.
  useEffect(() => {
    if (isGuest) return

    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastLoadRef.current < REVALIDATE_MIN_MS) return
      loadData(false)
    }

    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, user?.id])

  const loadFromLocalStorage = async () => {
    try {
      const storedExpenses = localStorage.getItem(STORAGE_KEY)
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses))
      }

      const storedCategories = localStorage.getItem(CATEGORIES_KEY)
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories))
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error)
    }
  }

  /** Gastos de un mes concreto, ya mapeados y sin los excluidos. */
  const fetchMonthExpenses = async (month: string): Promise<Expense[]> => {
    if (!user || !supabase) return []
    const { data, error } = await supabase
      .from('user_expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${month}-01`)
      .lt('date', nextMonthStart(month))
      .order('date', { ascending: false })

    if (error) throw error
    return (data || [])
      .filter(e => e.source !== 'card_import_excluded')
      .map(mapExpenseFromDb)
  }

  const loadFromSupabase = async () => {
    if (!user || !supabase) return

    try {
      // Cargar gastos de la ventana. Se apoya en el índice (user_id, date).
      const { data: expensesData, error: expensesError } = await supabase
        .from('user_expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', windowStartDate(LOAD_WINDOW_MONTHS))
        .order('date', { ascending: false })

      if (expensesError) throw expensesError

      // Meses con gastos, incluidos los anteriores a la ventana: es lo que
      // permite ofrecerlos en el Historial y pedirlos con loadMonth(). Sin esta
      // consulta, la carga bajo demanda no tendría disparador, porque el
      // selector se construiría solo con lo ya cargado.
      const { data: monthsData, error: monthsError } = await supabase
        .from('user_expenses')
        .select('date')
        .eq('user_id', user.id)
        .neq('source', 'card_import_excluded')

      // No aborta la carga —los gastos de la ventana ya están—, pero tampoco se
      // ignora: sin esta comprobación, un fallo aquí dejaba availableMonths
      // vacío y el Historial se quedaba sin selector de meses en silencio.
      if (monthsError) console.error("Error cargando los meses disponibles:", monthsError)

      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('user_categories')
        .select('name')
        .eq('user_id', user.id)

      if (categoriesError) throw categoriesError

      // Mapear datos de Supabase al formato local.
      //
      // El filtro de 'card_import_excluded' vive AQUÍ, en la carga, y no debe
      // confundirse con la consulta de deduplicación del importador, que es la
      // opuesta: aquella SÍ tiene que devolver los excluidos (acotada por el
      // rango de fechas del extracto), porque su external_id es justo lo que
      // impide que un movimiento descartado reaparezca al reimportar.
      // Son dos lecturas de la misma tabla con propósitos contrarios.
      const mappedExpenses = (expensesData || [])
        .filter(expense => expense.source !== 'card_import_excluded')
        .map(mapExpenseFromDb)

      const mappedCategories = categoriesData?.map(cat => cat.name) || DEFAULT_CATEGORIES

      // Se recuperan los meses pedidos bajo demanda que quedan fuera de la
      // ventana. Si alguno falla, se pierde ese mes pero no la carga entera.
      const inicioVentana = windowStartDate(LOAD_WINDOW_MONTHS).slice(0, 7)
      const mesesExtra = Array.from(extraMonthsRef.current).filter(m => m < inicioVentana)
      let filasExtra: Expense[] = []
      if (mesesExtra.length > 0) {
        const resultados = await Promise.all(
          mesesExtra.map(m =>
            fetchMonthExpenses(m).catch(error => {
              console.error(`Error recargando el mes ${m}:`, error)
              return [] as Expense[]
            })
          )
        )
        filasExtra = ([] as Expense[]).concat.apply([], resultados)
      }

      const conocidos = new Set(mappedExpenses.map(e => e.id))
      setExpenses(mappedExpenses.concat(filasExtra.filter(e => !conocidos.has(e.id))))
      setCategories(mappedCategories)
      // Si la consulta de meses falló, se degrada a los meses de la ventana ya
      // cargada: son menos de los que hay, pero todos son ciertos y navegables.
      const mesesOrigen = monthsError
        ? mappedExpenses.map(e => e.date)
        : (monthsData || []).map((r: { date: string }) => r.date)
      setAvailableMonths(
        Array.from(new Set(mesesOrigen.map(d => d.slice(0, 7)))).sort()
      )
    } catch (error) {
      console.error("Error loading from Supabase:", error)
      // Fallback a localStorage si hay error
      await loadFromLocalStorage()
    }
  }

  const migrateLocalDataIfNeeded = async () => {
    if (!user || !supabase) return

    // Verificar si ya se migró
    const migrated = localStorage.getItem(MIGRATION_KEY)
    if (migrated) return

    setIsSyncing(true)
    try {
      // Obtener datos de localStorage
      const localExpenses = localStorage.getItem(STORAGE_KEY)
      const localCategories = localStorage.getItem(CATEGORIES_KEY)

      if (localExpenses) {
        const expenses = JSON.parse(localExpenses)
        if (expenses.length > 0) {
          console.log(`Migrando ${expenses.length} gastos a la nube...`)
          
          // Subir gastos a Supabase
          const { error: expensesError } = await supabase
            .from('user_expenses')
            .insert(
              expenses.map((expense: Expense) => ({
                id: expense.id,
                user_id: user.id,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
                note: expense.note || null,
                is_recurring: expense.isRecurring || false,
              }))
            )

          if (expensesError) throw expensesError
        }
      }

      if (localCategories) {
        const categories = JSON.parse(localCategories)
        // Solo migrar categorías que no estén ya en la base de datos
        const { data: existingCategories } = await supabase
          .from('user_categories')
          .select('name')
          .eq('user_id', user.id)

        const existingNames = existingCategories?.map(cat => cat.name) || []
        const newCategories = categories.filter((cat: string) => 
          !existingNames.includes(cat) && !DEFAULT_CATEGORIES.includes(cat)
        )

        if (newCategories.length > 0) {
          const { error: categoriesError } = await supabase
            .from('user_categories')
            .insert(
              newCategories.map((name: string) => ({
                user_id: user.id,
                name,
              }))
            )

          if (categoriesError) throw categoriesError
        }
      }

      // Marcar como migrado
      localStorage.setItem(MIGRATION_KEY, 'true')
      console.log("✅ Migración completada exitosamente")
      
      // Recargar datos desde Supabase
      await loadFromSupabase()
    } catch (error) {
      console.error("Error en migración:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  const saveData = async () => {
    if (isGuest) {
      // Guardar en localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
    }
    // Si está autenticado, los datos ya se guardan en tiempo real via Supabase
  }

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const newExpense = {
      ...expense,
      id: generateUUID(),
    }

    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => [...prev, newExpense])
    } else if (supabase) {
      // Modo autenticado: insertar en Supabase
      const { error } = await supabase
        .from('user_expenses')
        .insert({
          id: newExpense.id,
          user_id: user!.id,
          amount: newExpense.amount,
          category: newExpense.category,
          date: newExpense.date,
          note: newExpense.note || null,
          is_recurring: newExpense.isRecurring || false,
          // Imputación manual a una tarjeta: solo el last4. El source se queda
          // en 'manual' (el default de la columna): no viene de un extracto y
          // no debe entrar en el juego de external_id del importador.
          card_last4: newExpense.cardLast4 || null,
        })

      if (error) {
        console.error("Error adding expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => [...prev, newExpense])
    }
  }

  const deleteExpense = async (id: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => prev.filter(expense => expense.id !== id))
    } else if (supabase) {
      // Un movimiento importado de un extracto NO se borra: se marca como
      // excluido. La fila conserva su external_id, y eso es justo lo que
      // impide que reaparezca en la siguiente importación (el extracto del mes
      // en curso se reimporta varias veces dentro del mismo mes). Al quedar
      // fuera del mapeo de carga, deja de contar en totales y presupuesto, y
      // sigue siendo recuperable.
      const esImportado = expenses.find(e => e.id === id)?.source === 'card_import'

      const { error } = esImportado
        ? await supabase
            .from('user_expenses')
            .update({ source: 'card_import_excluded' })
            .eq('id', id)
            .eq('user_id', user!.id)
        : await supabase
            .from('user_expenses')
            .delete()
            .eq('id', id)
            .eq('user_id', user!.id)

      if (error) {
        console.error("Error deleting expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => prev.filter(expense => expense.id !== id))
    }
  }

  const updateExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => 
        prev.map(expense => 
          expense.id === id ? { ...expense, ...updatedExpense } : expense
        )
      )
    } else if (supabase) {
      // Solo se envían los campos presentes. Construirlo como
      // `note: updatedExpense.note || null` borraba la nota en cualquier
      // actualización parcial, y lo mismo `is_recurring`.
      //
      // Los campos del módulo de tarjetas no se tocan aquí, con UNA excepción:
      // `cardLast4`, para poder corregir a qué tarjeta se imputó un gasto
      // manual. El Historial solo lo envía al editar manuales, así que el
      // external_id de un importado —la clave de la deduplicación— y su
      // tarjeta de extracto siguen siendo intocables.
      const payload: Record<string, unknown> = {}
      if (updatedExpense.amount !== undefined) payload.amount = updatedExpense.amount
      if (updatedExpense.category !== undefined) payload.category = updatedExpense.category
      if (updatedExpense.date !== undefined) payload.date = updatedExpense.date
      if (updatedExpense.note !== undefined) payload.note = updatedExpense.note || null
      if (updatedExpense.isRecurring !== undefined) payload.is_recurring = updatedExpense.isRecurring
      if (updatedExpense.cardLast4 !== undefined) payload.card_last4 = updatedExpense.cardLast4 || null

      const { error } = await supabase
        .from('user_expenses')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user!.id)

      if (error) {
        console.error("Error updating expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => 
        prev.map(expense => 
          expense.id === id ? { ...expense, ...updatedExpense } : expense
        )
      )
    }
  }

  const addCategory = async (category: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setCategories(prev => [...prev, category])
    } else if (supabase) {
      // Modo autenticado: insertar en Supabase
      const { error } = await supabase
        .from('user_categories')
        .insert({
          user_id: user!.id,
          name: category,
        })

      if (error) {
        console.error("Error adding category:", error)
        return
      }

      // Actualizar estado local
      setCategories(prev => [...prev, category])
    }
  }

  const removeCategory = async (category: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setCategories(prev => prev.filter(c => c !== category))
    } else if (supabase) {
      // Modo autenticado: eliminar de Supabase
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('user_id', user!.id)
        .eq('name', category)

      if (error) {
        console.error("Error removing category:", error)
        return
      }

      // Actualizar estado local
      setCategories(prev => prev.filter(c => c !== category))
    }
  }

  // Guardar en localStorage cuando cambian los datos (solo en modo guest)
  useEffect(() => {
    if (!isLoading && isGuest) {
      saveData()
    }
  }, [expenses, categories, isLoading, isGuest])

  /**
   * ¿Está ese mes en memoria? Falso significa "pídelo con loadMonth".
   *
   * Un mes dentro de la ventana cuenta como cargado aunque no tenga ni un gasto:
   * ahí el cero es cierto y hay que mostrarlo. Sin esa condición, el mes en
   * curso sin gastos se confundiría con un mes no disponible.
   */
  const isMonthLoaded = (month: string) =>
    isGuest ||
    month >= windowStartDate(LOAD_WINDOW_MONTHS).slice(0, 7) ||
    expenses.some(e => e.date.startsWith(month))

  /**
   * Carga bajo demanda un mes anterior a la ventana y lo fusiona en el estado.
   *
   * Sin esto, seleccionar un mes antiguo mostraría cero gastos: un número falso
   * y creíble, que es peor que no poder consultarlo. Quien pinte un mes que no
   * esté cargado debe llamar aquí antes, o indicar que no está disponible.
   */
  const loadMonth = async (month: string) => {
    if (isGuest || !user || !supabase) return   // en guest está todo en memoria
    if (isMonthLoaded(month)) return           // la ventana ya lo cubre, o ya está

    setLoadingMonth(month)
    try {
      const nuevos = await fetchMonthExpenses(month)
      extraMonthsRef.current.add(month)

      setExpenses(prev => {
        const conocidos = new Set(prev.map(e => e.id))
        return [...prev, ...nuevos.filter(e => !conocidos.has(e.id))]
      })
    } catch (error) {
      console.error("Error cargando el mes:", error)
    } finally {
      setLoadingMonth(null)
    }
  }

  // Refresca los gastos desde Supabase sin mostrar pantalla de carga.
  // Lo necesita el importador de extractos: sin esto, los movimientos recién
  // insertados no aparecerían hasta recargar la página.
  const reload = async () => {
    await loadData(false)
  }

  // Funciones de utilidad (sin cambios)
  const getExpensesByMonth = (month: string) => {
    return expenses.filter((expense) => expense.date.startsWith(month))
  }

  const getTotalByMonth = (month: string) => {
    return getExpensesByMonth(month).reduce((sum, expense) => sum + expense.amount, 0)
  }

  const getExpensesByCategory = (month: string) => {
    const monthExpenses = getExpensesByMonth(month)
    return monthExpenses.reduce(
      (acc, expense) => {
        const existingCategory = acc.find((item) => item.name === expense.category)
        if (existingCategory) {
          existingCategory.value += expense.amount
        } else {
          acc.push({ name: expense.category, value: expense.amount })
        }
        return acc
      },
      [] as Array<{ name: string; value: number }>,
    )
  }

  return {
    expenses,
    categories,
    isLoading,
    isSyncing,
    isGuest,
    reload,
    // En guest todo está en memoria, así que los meses salen de los gastos.
    availableMonths: isGuest
      ? Array.from(new Set(expenses.map(e => e.date.slice(0, 7)))).sort()
      : availableMonths,
    loadMonth,
    isMonthLoaded,
    loadingMonth,
    addExpense,
    deleteExpense,
    updateExpense,
    getExpensesByMonth,
    getTotalByMonth,
    getExpensesByCategory,
    addCategory,
    removeCategory,
  }
} 