"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, CheckCircle2, AlertCircle } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    if (!supabase) return

    // Supabase procesa el hash de la URL y emite PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true)
      }
    })

    // Por si la sesión ya fue establecida antes de que nos suscribamos
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password || !confirmPassword) {
      setError("Por favor completa todos los campos")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    if (!supabase) {
      setError("Servicio no disponible temporalmente")
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => router.push("/"), 3000)
      }
    } catch {
      setError("Error inesperado. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-blue-600" />
            Restablecer Contraseña
          </CardTitle>
          <CardDescription>
            Introduce tu nueva contraseña para acceder a tu cuenta
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">¡Contraseña actualizada!</h3>
                <p className="text-sm text-muted-foreground">
                  Tu contraseña se ha cambiado correctamente. Serás redirigido a la aplicación en unos segundos.
                </p>
              </div>
              <Button onClick={() => router.push("/")} className="w-full">
                Ir a la aplicación
              </Button>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-4 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm text-muted-foreground">Verificando enlace de recuperación...</p>
              <p className="text-xs text-muted-foreground">
                Si esta pantalla no avanza, el enlace puede haber expirado.{" "}
                <button
                  onClick={() => router.push("/")}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Volver al inicio
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando contraseña...
                  </>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/")}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
