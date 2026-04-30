"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, CheckCircle2, XCircle, Loader2, Unlink } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"

interface GmailStatus {
  connected: boolean
  email?: string
  labelName?: string
  lastProcessedAt?: string
  lastError?: string
  isActive?: boolean
}

interface GmailIntegrationProps {
  userId: string
}

export function GmailIntegration({ userId }: GmailIntegrationProps) {
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [labelName, setLabelName] = useState("")
  const [savingLabel, setSavingLabel] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [userId])

  async function fetchStatus() {
    try {
      setLoading(true)
      const res = await fetch(`/api/gmail/status?userId=${userId}`)
      const data = await res.json()
      setStatus(data)
      if (data.labelName) setLabelName(data.labelName)
    } catch (err) {
      console.error("Error fetching Gmail status:", err)
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  function handleConnect() {
    window.location.href = `/api/gmail/auth?userId=${userId}`
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true)
      await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      setStatus({ connected: false })
      setShowDisconnect(false)
    } catch (err) {
      console.error("Error disconnecting:", err)
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSaveLabel() {
    if (!labelName.trim()) return
    try {
      setSavingLabel(true)
      await fetch("/api/gmail/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, labelName: labelName.trim() }),
      })
      await fetchStatus()
    } catch (err) {
      console.error("Error saving label:", err)
    } finally {
      setSavingLabel(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Conexión con Gmail
          </CardTitle>
          <CardDescription className="text-base md:text-sm">
            Conecta tu cuenta de Gmail para importar automáticamente facturas y comprobantes de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Gmail conectado
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {status.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisconnect(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Desconectar
                </Button>
              </div>

              {status.lastError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Error en la última ejecución
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {status.lastError}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Etiqueta de Gmail a monitorizar
                </label>
                <div className="flex gap-2">
                  <Input
                    value={labelName}
                    onChange={(e) => setLabelName(e.target.value)}
                    placeholder="Facturas"
                  />
                  <Button
                    onClick={handleSaveLabel}
                    disabled={savingLabel}
                    variant="outline"
                  >
                    {savingLabel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crea una etiqueta en Gmail y aplícala a los emails con facturas.
                  GastoGuru solo procesará los emails con esta etiqueta.
                </p>
              </div>

              {status.lastProcessedAt && (
                <p className="text-xs text-muted-foreground">
                  Última revisión: {new Date(status.lastProcessedAt).toLocaleString("es-ES")}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Conecta tu cuenta de Gmail para que GastoGuru importe
                  automáticamente tus facturas y comprobantes de pago.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Solo lee emails con la etiqueta que tú configures</li>
                  <li>✓ Extrae datos de facturas con IA</li>
                  <li>✓ Registra gastos automáticamente</li>
                  <li>✓ Puedes desconectar en cualquier momento</li>
                </ul>
              </div>
              <Button onClick={handleConnect} className="w-full sm:w-auto">
                <Mail className="h-4 w-4 mr-2" />
                Conectar Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Gmail?</AlertDialogTitle>
            <AlertDialogDescription className="text-base md:text-sm">
              Se dejará de importar facturas automáticamente desde {status?.email}.
              Los gastos ya registrados no se eliminarán. Puedes volver a conectar en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
