import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useEffect, useState } from "react"

const schema = z.object({
  amount: z.string().min(1, "El importe es requerido"),
  category: z.string().min(1, "La categoría es requerida"),
  day: z.number().min(1).max(31),
  note: z.string().optional(),
})

export function RecurringExpenseForm({
  categories,
  initialValues,
  onSubmit,
  onCancel,
  addCategory,
}: {
  categories: string[]
  initialValues?: { amount: number; category: string; day: number; note?: string }
  onSubmit: (values: { amount: number; category: string; day: number; note?: string }) => void
  onCancel: () => void
  addCategory?: (cat: string) => void
}) {
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initialValues
      ? {
          amount: initialValues.amount.toString(),
          category: initialValues.category,
          day: initialValues.day,
          note: initialValues.note || "",
        }
      : {
          amount: "",
          category: "",
          day: 1,
          note: "",
        },
  })

  useEffect(() => {
    if (initialValues) {
      form.reset({
        amount: initialValues.amount.toString(),
        category: initialValues.category,
        day: initialValues.day,
        note: initialValues.note || "",
      })
    }
  }, [initialValues])

  return (
    <div className="bg-background text-foreground rounded-xl shadow-lg p-6 w-full max-w-md">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            onSubmit({
              amount: parseFloat(values.amount),
              category: values.category,
              day: values.day,
              note: values.note,
            })
          })}
          className="space-y-6"
        >
          
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
                    inputMode="decimal"
                    pattern="[0-9]*"
                    placeholder="0.00"
                    style={{ fontSize: 16 }}
                    {...field}
                    className="bg-background text-foreground"
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
                  key={categories.length} // Force re-render when categories change
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setAddingCategory(true)
                    } else {
                      field.onChange(val)
                    }
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="bg-background text-foreground">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
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
                          e.preventDefault()
                          if (addCategory) addCategory(newCategory.trim())
                          field.onChange(newCategory.trim())
                          setAddingCategory(false)
                          setNewCategory("")
                        }
                        if (e.key === 'Escape') {
                          setAddingCategory(false)
                          setNewCategory("")
                        }
                      }}
                      className="bg-background text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newCategory.trim()) {
                          if (addCategory) addCategory(newCategory.trim())
                          field.onChange(newCategory.trim())
                          setAddingCategory(false)
                          setNewCategory("")
                        }
                      }}
                    >
                      Añadir
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => { 
                        setAddingCategory(false); 
                        setNewCategory("") 
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Día del mes</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    value={field.value}
                    onChange={e => field.onChange(Number(e.target.value))}
                    className="w-full rounded border border-border px-3 py-2 bg-background text-foreground"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </FormControl>
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
                  <Input
                    placeholder="Añade una nota..."
                    style={{ fontSize: 16 }}
                    {...field}
                    className="bg-background text-foreground"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              className="bg-background text-foreground border-border"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground">
              Guardar
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}