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
}

export function ExpenseForm({ onSubmit, categories, initialValues }: ExpenseFormProps) {
  const [showScanner, setShowScanner] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues
      ? {
          amount: initialValues.amount.toString(),
          category: initialValues.category,
          date: initialValues.date,
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
                <PopoverContent className="w-auto p-0" align="start">
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

