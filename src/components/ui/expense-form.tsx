"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { Button } from "./button"
import { Calendar } from "./calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./form"
import { Input } from "./input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Textarea } from "./textarea"
import { toast } from "./use-toast"
import { cn } from "@/lib/utils"

const expenseFormSchema = z.object({
  amount: z.string().min(1, {
    message: "El monto es requerido.",
  }),
  category: z.string({
    required_error: "Por favor selecciona una categoría.",
  }),
  date: z.date({
    required_error: "Por favor selecciona una fecha.",
  }),
  note: z.string().optional(),
})

interface ExpenseFormProps {
  onSubmit: (values: z.infer<typeof expenseFormSchema>) => void
  categories: string[]
}

export function ExpenseForm({ onSubmit, categories }: ExpenseFormProps) {
  const form = useForm<z.infer<typeof expenseFormSchema>>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: "",
      note: "",
      date: new Date(),
    },
  })

  function onFormSubmit(values: z.infer<typeof expenseFormSchema>) {
    onSubmit(values)
    toast({
      title: "Gasto registrado",
      description: `Se ha registrado un gasto de $${values.amount} en ${values.category}`,
    })
    form.reset({
      amount: "",
      category: "",
      date: new Date(),
      note: "",
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0.00" {...field} />
              </FormControl>
              <FormDescription>Ingresa el monto del gasto en tu moneda local.</FormDescription>
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
              <Select onValueChange={field.onChange} value={field.value}>
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
              <FormDescription>Selecciona la categoría que mejor describe este gasto.</FormDescription>
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
                      {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>Selecciona la fecha en que realizaste el gasto.</FormDescription>
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
                <Textarea placeholder="Agrega una nota sobre este gasto..." {...field} />
              </FormControl>
              <FormDescription>Puedes agregar detalles adicionales sobre este gasto.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Guardar Gasto</Button>
      </form>
    </Form>
  )
}

