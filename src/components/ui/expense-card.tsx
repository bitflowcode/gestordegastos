"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { formatCurrency } from "@/lib/utils"

interface ExpenseCardProps {
  title: string
  description?: string
  total: number
  data: Array<{
    name: string
    value: number
  }>
  onAddExpense?: () => void
  onViewHistory?: () => void
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

export function ExpenseCard({ title, description, total, data, onAddExpense, onViewHistory }: ExpenseCardProps) {
  const chartConfig = data.reduce(
    (acc, item, index) => {
      acc[item.name] = { color: COLORS[index % COLORS.length] }
      return acc
    },
    {} as Record<string, { color: string }>,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-2xl font-bold">Total: {formatCurrency(total)}</div>

        {/* Chart container with fixed aspect ratio */}
        <div className="aspect-square w-full max-w-[400px] mx-auto">
          {data.length > 0 ? (
            <ChartContainer config={chartConfig}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius="90%" fill="#8884d8" dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No hay gastos registrados
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center">
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span>
                {entry.name}: {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {onAddExpense && (
          <Button onClick={onAddExpense} className="w-full">
            Agregar Nuevo Gasto
          </Button>
        )}
        {onViewHistory && (
          <Button onClick={onViewHistory} variant="outline" className="w-full">
            Ver Gastos del Mes
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

