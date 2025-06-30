"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Removido import de Alert - usaremos div simple
import { Loader2, Mail, Lock, User, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSignUp: (email: string, password: string) => Promise<{ error: any }>
  onSignIn: (email: string, password: string) => Promise<{ error: any }>
  defaultTab?: "login" | "signup"
}

export function AuthModal({ isOpen, onClose, onSignUp, onSignIn, defaultTab = "signup" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [resetPasswordSent, setResetPasswordSent] = useState(false)
  
  // Estados para el signup
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("")
  
  // Estados para el login
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Actualizar activeTab cuando cambie defaultTab y el modal esté abierto
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      setError(null)
      setResetPasswordSent(false)
    }
  }, [isOpen, defaultTab])

  if (!isOpen) return null

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validaciones
    if (!signupEmail || !signupPassword) {
      setError("Por favor completa todos los campos")
      return
    }
    
    if (signupPassword !== signupConfirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }
    
    if (signupPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    
    setIsLoading(true)
    try {
      const { error } = await onSignUp(signupEmail, signupPassword)
      if (error) {
        if (error.message.includes("already registered")) {
          setError("Este email ya está registrado. Usa la pestaña de Iniciar Sesión.")
        } else {
          setError(error.message)
        }
      } else {
        // Éxito - mostrar pantalla de confirmación
        setError(null)
        setSignupSuccess(true)
      }
    } catch (err) {
      setError("Error inesperado. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!loginEmail || !loginPassword) {
      setError("Por favor completa todos los campos")
      return
    }
    
    setIsLoading(true)
    try {
      const { error } = await onSignIn(loginEmail, loginPassword)
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos")
        } else {
          setError(error.message)
        }
      } else {
        // Éxito - cerrar el modal automáticamente
        handleClose()
      }
    } catch (err) {
      setError("Error inesperado. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!loginEmail) {
      setError("Por favor ingresa tu email para recuperar la contraseña")
      return
    }
    
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        setError(error.message)
      } else {
        setResetPasswordSent(true)
      }
    } catch (err) {
      setError("Error inesperado. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSignupEmail("")
    setSignupPassword("")
    setSignupConfirmPassword("")
    setLoginEmail("")
    setLoginPassword("")
    setError(null)
    setSignupSuccess(false)
    setResetPasswordSent(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="w-full max-w-md relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="absolute top-2 right-2 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Gestor de Gastos
          </CardTitle>
          <CardDescription>
            Sincroniza tus datos en todos tus dispositivos
          </CardDescription>
        </CardHeader>

        <CardContent>
          {signupSuccess ? (
            // Pantalla de éxito después del signup
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¡Cuenta creada con éxito!
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Hemos enviado un enlace de confirmación a:
                  <br />
                  <strong>{signupEmail}</strong>
                </p>
                <p className="text-gray-500 text-xs mb-6">
                  Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
                  Después podrás acceder a tus datos desde cualquier dispositivo.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleClose}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Entendido
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSignupSuccess(false)
                    setActiveTab("login")
                  }}
                  className="w-full"
                >
                  Ya confirmé mi cuenta
                </Button>
              </div>
            </div>
          ) : resetPasswordSent ? (
            // Pantalla de confirmación de reset de contraseña
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Email de recuperación enviado
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Hemos enviado un enlace para restablecer tu contraseña a:
                  <br />
                  <strong>{loginEmail}</strong>
                </p>
                <p className="text-gray-500 text-xs mb-6">
                  Revisa tu bandeja de entrada y haz clic en el enlace para crear una nueva contraseña.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setResetPasswordSent(false)}
                  variant="outline"
                  className="w-full"
                >
                  Volver al inicio de sesión
                </Button>
                <Button
                  onClick={handleClose}
                  className="w-full"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            // Formularios normales de login/signup
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value as "login" | "signup")
              setError(null)
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Crear Cuenta</TabsTrigger>
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="space-y-4 mt-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Crea tu cuenta gratis y sincroniza tus gastos
                  </p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Repite tu contraseña"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear Cuenta Gratis"
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Al crear una cuenta, aceptas nuestros términos de servicio y política de privacidad.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="login" className="space-y-4 mt-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Accede a tu cuenta existente
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Tu contraseña"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
                      <p className="text-sm text-red-800">{error}</p>
                      {error.includes("Email o contraseña incorrectos") && (
                        <Button
                          type="button"
                          variant="link"
                          onClick={handleResetPassword}
                          disabled={isLoading}
                          className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                        >
                          ¿Olvidaste tu contraseña? Recupérala aquí
                        </Button>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleResetPassword}
                      disabled={isLoading || !loginEmail}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 