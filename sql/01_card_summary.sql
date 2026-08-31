-- ============================================================
-- Módulo "Tarjetas" — migración aditiva y no destructiva (v2)
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente: puede
-- ejecutarse más de una vez sin romper nada.
--
-- Reemplaza a 01_card_summary.sql. Incorpora las decisiones de:
--   REVISION-Plan-Resumen-Tarjeta.md
--   FEEDBACK-Modulo-Tarjetas-v1.md
--   RESPUESTA-Feedback-Modulo-Tarjetas-v1.md
--   ADDENDUM-v1.1 / CIERRE-v1.2 / RESPUESTA-v1.3
--
-- Sigue las convenciones del proyecto (gen_random_uuid,
-- auth.users, DECIMAL(10,2), políticas "Users can ... their own ...").
-- ============================================================


-- ============================================================
-- 1) COLUMNAS NUEVAS EN user_expenses
--    Todo lo existente queda como source='manual' por el DEFAULT,
--    así que no cambia ningún total actual.
-- ============================================================

ALTER TABLE user_expenses
  ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id     TEXT,             -- id del movimiento en el extracto
  ADD COLUMN IF NOT EXISTS card_last4      TEXT,             -- 4 últimos dígitos (con cero inicial)
  ADD COLUMN IF NOT EXISTS merchant        TEXT,             -- comercio (informativo)
  ADD COLUMN IF NOT EXISTS currency        TEXT,             -- divisa original del movimiento (ISO 4217)
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(14,4),    -- importe en la divisa original (escala 4: cubre monedas de 3 decimales como KWD/BHD/TND)
  ADD COLUMN IF NOT EXISTS exchange_rate   DECIMAL(18,8);    -- tasa aplicada para obtener amount

-- amount sigue siendo SIEMPRE el importe en la divisa base (hoy EUR), en
-- DECIMAL(10,2) porque el euro tiene 2 decimales. original_amount usa escala 4
-- porque la divisa ORIGINAL puede tener 3 decimales (KWD, BHD, TND, OMR) o 4;
-- guardarlo en (10,2) redondearía 12,500 KWD a 12,50 y perdería el dato.
-- currency/original_amount/exchange_rate conservan el dato de origen y
-- hacen auditable y recalculable la conversión. Son también lo que hará
-- viable una divisa base configurable en el futuro sin pérdida de datos.


-- ============================================================
-- 2) RESTRICCIÓN DE VALORES DE source
-- ============================================================
--
-- IMPORTANTE: se usa DROP + ADD y NO un bloque
-- "DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$".
-- Ese patrón tiene una trampa de idempotencia: si la restricción ya
-- existe con una lista de valores ANTERIOR, la excepción se traga el
-- error y deja la restricción vieja en su sitio, que rechazaría
-- 'card_import_excluded'. DROP + ADD converge siempre al valor correcto.

ALTER TABLE user_expenses
  DROP CONSTRAINT IF EXISTS user_expenses_source_check;

ALTER TABLE user_expenses
  ADD CONSTRAINT user_expenses_source_check
  CHECK (source IN ('manual', 'card_import', 'card_import_excluded'));

-- 'manual'               -> gasto anotado por el usuario (formulario, OCR, Gmail, n8n)
-- 'card_import'          -> movimiento procedente de un extracto
-- 'card_import_excluded' -> movimiento descartado por el usuario (borrado desde el
--                           Historial o saltado en la previsualización). La fila NO
--                           se borra: conserva su external_id para que la
--                           deduplicación la omita y el movimiento no reaparezca.
--                           El hook la filtra al mapear, así que no cuenta en
--                           totales, gráficos ni presupuesto.


-- ============================================================
-- 3) NORMALIZACIÓN PREVIA: cadena vacía -> NULL
-- ============================================================
--
-- '' NO es NULL: el índice único lo trataría como un valor real y dos
-- filas con external_id = '' lo violarían, haciendo fallar el
-- CREATE UNIQUE INDEX y dejando la migración a medias.
--
-- Esto puede ocurrir si se hizo alguna importación de prueba con el
-- parser antes de corregir el defecto de la cadena vacía. La sentencia
-- es inofensiva si no hay nada que limpiar.

UPDATE user_expenses SET external_id = NULL WHERE external_id = '';


-- ============================================================
-- 4) ANTI-DUPLICADOS: ÍNDICE ÚNICO **PLENO** (no parcial)
-- ============================================================
--
-- ¡NO AÑADIR "WHERE external_id IS NOT NULL"!  Decisión deliberada.
--
-- Motivo por el que NO hace falta el predicado:
--   En PostgreSQL los NULL se consideran distintos entre sí en un índice
--   único (NULLS DISTINCT, comportamiento por defecto). Por tanto este
--   índice pleno YA permite infinitos gastos manuales con external_id
--   NULL, e impone unicidad solo sobre los valores no nulos. El predicado
--   solo ahorraría tamaño de índice, que aquí es irrelevante.
--
-- Motivo por el que el índice DEBE ser pleno:
--   Un índice único PARCIAL no puede usarse como árbitro de ON CONFLICT
--   sin repetir su predicado en la sentencia, y el cliente de Supabase no
--   puede emitir ese WHERE (error 42P10). Sin ON CONFLICT, una violación
--   de unicidad (23505) aborta el bloque de INSERT completo. Con el índice
--   pleno, el importador puede usar ON CONFLICT DO NOTHING como red de
--   integridad que omite la fila existente sin romper el bloque.
--
-- NO usar NULLS NOT DISTINCT: invertiría el comportamiento y prohibiría
-- múltiples gastos manuales con external_id NULL.

DROP INDEX IF EXISTS uq_user_expenses_user_external;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_expenses_user_external
  ON user_expenses (user_id, external_id);   -- NULLS DISTINCT por defecto

-- ADVERTENCIA PARA EL IMPORTADOR:
--   El índice pleno habilita ON CONFLICT DO NOTHING, pero también habilita
--   ON CONFLICT DO UPDATE. NO usar DO UPDATE: sobrescribiría las filas
--   existentes y revertiría las recategorizaciones que el usuario haya
--   hecho a mano desde el Historial. En el cliente eso significa mantener
--   siempre ignoreDuplicates: true.
--   Con el índice parcial anterior, DO UPDATE era imposible (fallaba con
--   42P10); con el pleno es solo inadvisable. La barrera pasó de mecánica
--   a documental: de ahí este comentario.


-- ============================================================
-- 5) ÍNDICES DE CONSULTA
-- ============================================================

-- 5.1. Vista de tarjeta y cálculo de presupuesto.
--
-- OJO: este índice solo se usa si las consultas expresan el mes como
-- RANGO de fechas. Envolver la columna en una función la inutiliza:
--     MAL:  AND to_char(date,'YYYY-MM') = :month
--     BIEN: AND date >= :primer_dia_mes AND date < :primer_dia_mes_siguiente
CREATE INDEX IF NOT EXISTS idx_user_expenses_user_card_date
  ON user_expenses (user_id, card_last4, date);

-- 5.2. Consultas por usuario y rango de fechas.
--
-- La v1 del módulo introduce tres patrones que dependen de un índice
-- (user_id, date):
--   a) carga con ventana móvil: WHERE user_id = X AND date >= :corte
--   b) deduplicación e importación: WHERE user_id = X AND date BETWEEN :min AND :max
--   c) meses disponibles: SELECT date WHERE user_id = X
--
-- VERIFICADO CONTRA LA BASE DE DATOS REAL: ya existe
-- `idx_user_expenses_user_id_date` como btree (user_id, date DESC), que
-- cubre los tres. El DESC es irrelevante: un B-tree se recorre en ambos
-- sentidos, sirve igual para rangos y además encaja con el
-- `order by date desc` del hook.
--
-- Por eso NO se crea aquí un índice con nombre propio: sería un duplicado.
-- Y ojo, IF NOT EXISTS no lo habría evitado, porque solo comprueba el
-- NOMBRE: mismo nombre con otra definición = el cambio no se aplica en
-- silencio; otro nombre con la misma definición = se duplica en silencio.
--
-- La comprobación se hace por DEFINICIÓN, no por nombre, para que una
-- instalación desde cero (que no tendría el índice preexistente) sí lo cree.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = 'user_expenses'
       AND indexdef  ~* 'btree \(user_id, date'
  ) THEN
    EXECUTE 'CREATE INDEX idx_user_expenses_user_date ON user_expenses (user_id, date)';
  END IF;
END $$;


-- ============================================================
-- 6) PRESUPUESTO POR TARJETA Y MES
-- ============================================================

CREATE TABLE IF NOT EXISTS card_budgets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_last4      TEXT NOT NULL,
  month           TEXT NOT NULL,                      -- 'YYYY-MM'; CHECK más abajo
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0,   -- en la divisa base (hoy EUR)
  alert_threshold DECIMAL(10,2),                      -- umbral de restante; NULL = 10% de amount
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, card_last4, month)
);

-- CONVERGENCIA SI LA TABLA YA EXISTÍA.
--   CREATE TABLE IF NOT EXISTS *no modifica* una tabla existente: si se
--   ejecutó una versión anterior de esta migración (con user_id NULLABLE y
--   sin CHECK en month), el CREATE se salta en silencio y esos defectos
--   permanecen. Se fuerzan explícitamente para que el script converja
--   siempre al mismo estado, venga de donde venga.

-- Las filas huérfanas son invisibles a RLS y por tanto imposibles de borrar
-- desde la aplicación. Se eliminan antes de imponer la restricción.
DELETE FROM card_budgets WHERE user_id IS NULL;

ALTER TABLE card_budgets ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE card_budgets DROP CONSTRAINT IF EXISTS card_budgets_month_check;
ALTER TABLE card_budgets ADD CONSTRAINT card_budgets_month_check
  CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- user_id es NOT NULL a propósito: sin ello se admitirían filas huérfanas
-- que además serían invisibles para las políticas RLS y, por tanto,
-- imposibles de borrar desde la aplicación.
--
-- No hay presupuesto "arrastrado" en el esquema: el modelo es por tarjeta
-- y mes, y la herencia del importe del mes anterior se resuelve en código.
--
-- updated_at es decorativa: el repositorio no tiene ningún trigger que la
-- actualice, igual que en el resto de las tablas. No confiar en su valor.

ALTER TABLE card_budgets ENABLE ROW LEVEL SECURITY;

-- DROP previo para que el script sea idempotente: CREATE POLICY no admite
-- IF NOT EXISTS y fallaría con error de duplicado en una segunda ejecución.
DROP POLICY IF EXISTS "Users can view their own card budgets"   ON card_budgets;
DROP POLICY IF EXISTS "Users can insert their own card budgets" ON card_budgets;
DROP POLICY IF EXISTS "Users can update their own card budgets" ON card_budgets;
DROP POLICY IF EXISTS "Users can delete their own card budgets" ON card_budgets;

CREATE POLICY "Users can view their own card budgets" ON card_budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own card budgets" ON card_budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- La política de UPDATE no necesita WITH CHECK: cuando se omite,
-- PostgreSQL aplica la expresión de USING también a la fila resultante,
-- por lo que no hay forma de reasignar una fila a otro usuario.
CREATE POLICY "Users can update their own card budgets" ON card_budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own card budgets" ON card_budgets
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 7) NOTAS PARA QUIEN IMPLEMENTE
-- ============================================================
--
-- TRES LECTURAS DE PROPÓSITO OPUESTO SOBRE user_expenses.
-- Es el punto más fácil de romper y ninguna prueba lo detecta:
--
--   1. DEDUPLICACIÓN (primaria). Acotada por el rango de fechas del
--      extracto que se importa, NUNCA por la ventana de carga ni contra el
--      array en memoria:
--        SELECT id, external_id, amount, date, source, category, note
--        FROM user_expenses
--        WHERE user_id = :uid AND date >= :min_csv AND date <= :max_csv;
--      NO debe filtrar por source: tiene que devolver también los
--      'card_import_excluded', porque es eso lo que impide que los
--      movimientos descartados reaparezcan. Esta misma lectura alimenta la
--      detección difusa de duplicados frente a gastos manuales.
--
--   2. CARGA DE GASTOS (hook). SÍ filtra 'card_import_excluded', para que
--      esas filas no entren en totales ni gráficos.
--
--   3. GASTADO DEL PRESUPUESTO. SÍ los excluye. Se calcula sobre el array
--      ya filtrado; si alguna vez se hace como agregado en SQL, con rangos
--      de fecha (ver nota del índice 5.1).
--
-- FECHAS: la fecha de un movimiento es la del proveedor tomada
-- literalmente. Ninguna fecha se enruta por Date/toISOString(): se usa
-- formatDateToString de src/lib/utils.ts o manipulación de cadena.
--
-- DIVISA: el importador y el route handler de tipos de cambio NO deben
-- llevar 'EUR' escrito dentro. La divisa de destino es un parámetro que
-- hoy se resuelve a 'EUR' desde un único punto, para que añadir más
-- adelante un selector de divisa base no exija refactorizar la importación.
--
-- currency debe normalizarse a MAYÚSCULAS en el parser antes de insertar.
-- ============================================================
