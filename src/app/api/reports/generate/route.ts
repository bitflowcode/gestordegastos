import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface ReportRequest {
  userId: string
  templateId: string
  config: {
    name: string
    frequency: 'monthly' | 'weekly' | 'quarterly'
    categories: string[]
    dateRange: number // meses hacia atrás
    email: string
  }
}

interface ExpenseData {
  id: string
  amount: number
  category: string
  merchant: string
  date: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId, templateId, config }: ReportRequest = await request.json()
    
    // Validar datos de entrada
    if (!userId || !templateId || !config) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Verificar si Supabase está configurado
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 500 })
    }

    // Obtener datos de gastos del usuario
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', getStartDate(config.dateRange))
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching expenses:', error)
      return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 })
    }

    // Generar informe según el template
    const report = generateReport(templateId, expenses || [], config)
    
    // Si es una generación manual, devolver el informe
    if (request.nextUrl.searchParams.get('preview') === 'true') {
      return NextResponse.json(report)
    }

    // Guardar configuración del informe automático
    const { error: saveError } = await supabase!
      .from('report_configs')
      .insert({
        user_id: userId,
        template_id: templateId,
        name: config.name,
        frequency: config.frequency,
        email: config.email,
        categories: config.categories,
        date_range: config.dateRange,
        enabled: true,
        created_at: new Date().toISOString(),
        next_run: calculateNextRun(config.frequency)
      })

    if (saveError) {
      console.error('Error saving report config:', saveError)
      return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Informe automático configurado exitosamente',
      reportId: Date.now().toString(),
      nextRun: calculateNextRun(config.frequency)
    })

  } catch (error) {
    console.error('Error in report generation:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

function getStartDate(monthsBack: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - monthsBack)
  return date.toISOString().split('T')[0]
}

function calculateNextRun(frequency: string): string {
  const now = new Date()
  
  switch (frequency) {
    case 'weekly':
      now.setDate(now.getDate() + 7)
      break
    case 'monthly':
      now.setMonth(now.getMonth() + 1)
      now.setDate(1) // Primer día del mes
      break
    case 'quarterly':
      now.setMonth(now.getMonth() + 3)
      now.setDate(1)
      break
  }
  
  return now.toISOString()
}

function generateReport(templateId: string, expenses: ExpenseData[], config: any) {
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount
    return acc
  }, {} as Record<string, number>)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonth))
  const currentMonthTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0)

  const reportData = {
    templateId,
    generatedAt: new Date().toISOString(),
    period: {
      start: getStartDate(config.dateRange),
      end: new Date().toISOString().split('T')[0]
    },
    summary: {
      totalExpenses,
      totalTransactions: expenses.length,
      averagePerTransaction: totalExpenses / expenses.length || 0,
      currentMonthTotal
    },
    categoryBreakdown: expensesByCategory,
    topCategories: Object.entries(expensesByCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount })),
    topMerchants: expenses.reduce((acc, expense) => {
      acc[expense.merchant] = (acc[expense.merchant] || 0) + expense.amount
      return acc
    }, {} as Record<string, number>),
    trends: calculateTrends(expenses),
    recommendations: generateRecommendations(expenses, expensesByCategory)
  }

  return reportData
}

function calculateTrends(expenses: ExpenseData[]) {
  const monthlyTotals = expenses.reduce((acc, expense) => {
    const month = expense.date.slice(0, 7)
    acc[month] = (acc[month] || 0) + expense.amount
    return acc
  }, {} as Record<string, number>)

  const months = Object.keys(monthlyTotals).sort()
  const trends = []

  for (let i = 1; i < months.length; i++) {
    const current = monthlyTotals[months[i]]
    const previous = monthlyTotals[months[i - 1]]
    const change = ((current - previous) / previous) * 100

    trends.push({
      month: months[i],
      total: current,
      change: Math.round(change * 100) / 100,
      direction: change > 0 ? 'up' : 'down'
    })
  }

  return trends
}

function generateRecommendations(expenses: ExpenseData[], categoryTotals: Record<string, number>) {
  const recommendations = []
  
  // Categoría con más gastos
  const topCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0]
  
  if (topCategory) {
    recommendations.push({
      type: 'category_focus',
      title: `Enfócate en ${topCategory[0]}`,
      description: `Esta categoría representa el mayor gasto (€${topCategory[1].toFixed(2)}). Revisa si puedes optimizar estos gastos.`
    })
  }

  // Detectar gastos inusuales
  const averageExpense = expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length
  const highExpenses = expenses.filter(e => e.amount > averageExpense * 3)
  
  if (highExpenses.length > 0) {
    recommendations.push({
      type: 'unusual_expenses',
      title: 'Gastos inusuales detectados',
      description: `Se detectaron ${highExpenses.length} gastos significativamente altos. Revisa si son necesarios.`
    })
  }

  // Tendencia de crecimiento
  const recentExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    return expenseDate > cutoff
  })
  
  const olderExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoff2 = new Date()
    cutoff2.setDate(cutoff2.getDate() - 30)
    return expenseDate > cutoff && expenseDate <= cutoff2
  })

  if (recentExpenses.length > 0 && olderExpenses.length > 0) {
    const recentTotal = recentExpenses.reduce((sum, e) => sum + e.amount, 0)
    const olderTotal = olderExpenses.reduce((sum, e) => sum + e.amount, 0)
    const change = ((recentTotal - olderTotal) / olderTotal) * 100

    if (change > 20) {
      recommendations.push({
        type: 'spending_increase',
        title: 'Aumento en gastos recientes',
        description: `Tus gastos han aumentado ${change.toFixed(1)}% en el último mes. Considera revisar tu presupuesto.`
      })
    }
  }

  return recommendations
} 