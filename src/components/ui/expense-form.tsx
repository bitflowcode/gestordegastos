"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Scan } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReceiptScanner } from "./receipt-scanner"
import { useRecurringExpenses } from "@/hooks/use-recurring-expenses"

const formSchema = z.object({
  amount: z.string().min(1, {
    message: "El importe es requerido.",
  }),
  category: z.string().min(1, {
    message: "La categoría es requerida.",
  }),
  date: z.date({
    required_error: "La fecha es requerida.",
  }),
  note: z.string().optional(),
})

export interface ExpenseFormProps {
  onSubmit: (values: z.infer<typeof formSchema>) => void
  categories: string[]
  initialValues?: {
    amount: number
    category: string
    date: Date
    note: string
  }
  addCategory?: (cat: string) => void
}

export function ExpenseForm({ onSubmit, categories, initialValues, addCategory }: ExpenseFormProps) {
  const [showScanner, setShowScanner] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [isRecurring, setIsRecurring] = useState(false)
  const { addRecurring } = useRecurringExpenses()
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues
      ? {
          amount: initialValues.amount.toString(),
          category: initialValues.category,
          date: typeof initialValues.date === 'string' ? new Date(initialValues.date) : initialValues.date,
          note: initialValues.note,
        }
      : {
          amount: "",
          category: "",
          date: new Date(),
          note: "",
        },
  })

  const handleScannerSubmit = (scannedValues: any) => {
    // Actualizar el formulario con los datos escaneados
    form.setValue("amount", scannedValues.amount?.toString() || "")
    form.setValue("category", scannedValues.category || "")
    form.setValue("date", scannedValues.date || new Date())
    form.setValue("note", scannedValues.note || "")
    
    // Cerrar el escáner - NO llamar a onSubmit aquí
    // El usuario debe confirmar los datos en el formulario
    setShowScanner(false)
  }

  if (showScanner) {
    return (
      <ReceiptScanner
        categories={categories}
        onSubmit={handleScannerSubmit}
        onClose={() => setShowScanner(false)}
      />
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          onSubmit(values)
          if (isRecurring) {
            const date = values.date instanceof Date ? values.date : new Date(values.date)
            addRecurring({
              amount: parseFloat(values.amount),
              category: values.category,
              day: date.getDate(),
              note: values.note,
            })
          }
        })}
        className="space-y-8"
      >
        {/* Botón del escáner */}
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowScanner(true)}
            className="w-full"
          >
            <Scan className="h-4 w-4 mr-2" />
            Escanear Recibo
          </Button>
        </div>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Importe</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  style={{ fontSize: 16 }}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select
                onValueChange={(val) => {
                  if (val === "__new__") {
                    setAddingCategory(true)
                  } else {
                    field.onChange(val)
                  }
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-blue-600 font-semibold">
                    + Nueva categoría
                  </SelectItem>
                </SelectContent>
              </Select>
              {addingCategory && (
                <div className="flex gap-2 mt-2">
                  <Input
                    autoFocus
                    placeholder="Nombre de la nueva categoría"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCategory.trim()) {
                        if (addCategory) addCategory(newCategory.trim())
                        form.setValue("category", newCategory.trim())
                        setAddingCategory(false)
                        setNewCategory("")
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newCategory.trim()) {
                        if (addCategory) addCategory(newCategory.trim())
                        form.setValue("category", newCategory.trim())
                        setAddingCategory(false)
                        setNewCategory("")
                      }
                    }}
                  >
                    Añadir
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setAddingCategory(false); setNewCategory("") }}>Cancelar</Button>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">¿Es un gasto recurrente?</div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="recurring"
                checked={!isRecurring}
                onChange={() => setIsRecurring(false)}
              />
              No recurrente
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="recurring"
                checked={isRecurring}
                onChange={() => setIsRecurring(true)}
              />
              Recurrente
            </label>
          </div>
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                    >
                      {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecciona una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(date) => {
                      field.onChange(date)
                      // Cerrar el popover después de seleccionar
                      const popoverTrigger = document.querySelector('[aria-expanded="true"]') as HTMLButtonElement
                      if (popoverTrigger) {
                        popoverTrigger.click()
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Añade una nota..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {initialValues ? "Guardar Cambios" : "Agregar Gasto"}
        </Button>
      </form>
    </Form>
  )
}

