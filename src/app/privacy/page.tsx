import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidad – GastoGuru",
  description: "Política de privacidad de GastoGuru: qué datos recopilamos, cómo los usamos y cuáles son tus derechos.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          ← Volver a la app
        </Link>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidad de GastoGuru</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: 30 de abril de 2026</p>

        <div className="space-y-10 text-sm leading-7">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Qué es GastoGuru</h2>
            <p>
              GastoGuru es una aplicación de gestión de gastos personales y empresariales que permite
              registrar, categorizar y analizar tus gastos de forma sencilla.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Datos que recopilamos</h2>
            <h3 className="font-medium mb-2">Datos de cuenta</h3>
            <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">
              <li>Dirección de correo electrónico (para autenticación)</li>
              <li>Nombre de usuario (opcional)</li>
            </ul>
            <h3 className="font-medium mb-2">Datos de gastos</h3>
            <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">
              <li>Importes, fechas, categorías, comercios y notas de los gastos que registres</li>
            </ul>
            <h3 className="font-medium mb-2">Integración con Gmail (opcional)</h3>
            <p className="mb-2">
              Si decides conectar tu cuenta de Gmail, GastoGuru accede exclusivamente a:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3 text-muted-foreground">
              <li>Emails que contengan facturas o comprobantes de pago, identificados mediante etiquetas que tú configures</li>
              <li>Archivos PDF adjuntos a dichos emails</li>
            </ul>
            <p className="mb-2">GastoGuru <strong>NO</strong> accede a:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Tus contactos</li>
              <li>Tus borradores</li>
              <li>Emails que no estén en las etiquetas configuradas</li>
              <li>Ningún otro servicio de Google</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Cómo usamos tus datos</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Los datos de gastos se utilizan exclusivamente para mostrarte tus registros y análisis dentro de la aplicación</li>
              <li>Los emails de Gmail se procesan únicamente para extraer información de facturas (comercio, importe, fecha, concepto) y registrarla como gasto en tu cuenta</li>
              <li>Utilizamos inteligencia artificial (Claude de Anthropic) para extraer datos estructurados de las facturas. El contenido del email se envía a la API de Anthropic exclusivamente para este procesamiento y no se almacena en sus servidores</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Seguridad</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Las credenciales de acceso a Gmail se almacenan cifradas con AES-256</li>
              <li>La comunicación se realiza mediante HTTPS en todo momento</li>
              <li>Cada usuario solo puede acceder a sus propios datos</li>
              <li>Aplicamos Row Level Security (RLS) en nuestra base de datos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Compartición de datos</h2>
            <p className="mb-3">
              No vendemos, compartimos ni cedemos tus datos personales a terceros. Los únicos servicios
              externos que procesan datos son:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Supabase</strong>: alojamiento seguro de la base de datos (con cifrado en reposo)</li>
              <li><strong className="text-foreground">Anthropic (Claude API)</strong>: procesamiento puntual de texto de facturas para extracción de datos (sin almacenamiento)</li>
              <li><strong className="text-foreground">Google Gmail API</strong>: acceso a tu correo exclusivamente con tu autorización expresa, revocable en cualquier momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Tus derechos</h2>
            <p className="mb-3">Puedes en cualquier momento:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Desconectar Gmail</strong>: desde la configuración de tu cuenta en GastoGuru</li>
              <li>
                <strong className="text-foreground">Revocar el acceso</strong>: desde tu cuenta de Google en{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80"
                >
                  myaccount.google.com/permissions
                </a>
              </li>
              <li><strong className="text-foreground">Eliminar tus datos</strong>: contactando con nosotros para solicitar la eliminación completa de tu cuenta y datos asociados</li>
              <li><strong className="text-foreground">Exportar tus datos</strong>: descargando tus gastos desde la aplicación</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground">
              GastoGuru utiliza únicamente cookies técnicas necesarias para el funcionamiento de la sesión.
              No utilizamos cookies de seguimiento ni publicitarias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cambios en esta política</h2>
            <p className="text-muted-foreground">
              Nos reservamos el derecho de actualizar esta política. Cualquier cambio será publicado
              en esta página con la fecha de actualización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contacto</h2>
            <p className="text-muted-foreground">
              Para cualquier consulta sobre privacidad, puedes contactarnos en:{" "}
              <a
                href="mailto:soporte@gastoguru.com"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80"
              >
                soporte@gastoguru.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
