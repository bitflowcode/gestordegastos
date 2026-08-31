-- ============================================================
-- REVERSIÓN de sql/01_card_summary.sql
--
-- Ejecutar SOLO si hay que deshacer la migración del módulo "Tarjetas".
-- Escrito contra el estado real de la base de datos verificado antes de
-- migrar (PostgreSQL 17.6, 105 filas en user_expenses).
--
-- CUIDADO: esto ELIMINA las columnas y la tabla del módulo, y con ellas
-- cualquier movimiento de tarjeta que se hubiera importado. Los gastos
-- manuales NO se ven afectados: solo pierden columnas que estaban a NULL.
-- ============================================================


-- ============================================================
-- 1) LO QUE ESTE SCRIPT **NO** DESHACE, A PROPÓSITO
-- ============================================================
--
-- a) La columna `merchant`.
--    YA EXISTÍA antes de la migración (text, nullable, sin default), creada
--    en su momento para el endpoint de informes. La migración se la saltó
--    por el IF NOT EXISTS, así que NO es nuestra y no se elimina.
--    Eliminarla rompería `reports/generate/route.ts`, que la usa.
--
-- b) El índice `idx_user_expenses_user_id_date` — btree (user_id, date DESC).
--    YA EXISTÍA. La migración no lo creó (su bloque DO comprueba por
--    definición y lo encontró), así que tampoco se elimina.
--
-- c) Los índices `idx_user_expenses_category` y `user_expenses_pkey`.
--    Preexistentes y ajenos al módulo.
--
-- d) El UPDATE que normalizaba external_id = '' a NULL.
--    No tiene reversión ni la necesita: la columna no existía antes de la
--    migración, así que no había ninguna fila con cadena vacía.


-- ============================================================
-- 2) TABLA DE PRESUPUESTOS
-- ============================================================
-- DROP TABLE se lleva por delante sus políticas RLS y su índice UNIQUE.
DROP TABLE IF EXISTS card_budgets;


-- ============================================================
-- 3) ÍNDICES CREADOS POR LA MIGRACIÓN
-- ============================================================
DROP INDEX IF EXISTS uq_user_expenses_user_external;
DROP INDEX IF EXISTS idx_user_expenses_user_card_date;

-- Solo por si la migración se ejecutó en un entorno SIN el índice
-- preexistente (una instalación desde cero), donde su bloque DO sí lo habría
-- creado con este nombre. En esta base de datos no existe y no hace nada.
DROP INDEX IF EXISTS idx_user_expenses_user_date;


-- ============================================================
-- 4) RESTRICCIÓN DE source
-- ============================================================
ALTER TABLE user_expenses
  DROP CONSTRAINT IF EXISTS user_expenses_source_check;


-- ============================================================
-- 5) COLUMNAS AÑADIDAS POR LA MIGRACIÓN
-- ============================================================
-- Son las seis que la migración creó de verdad. `merchant` NO está en esta
-- lista: ver el apartado 1.a.
ALTER TABLE user_expenses
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS external_id,
  DROP COLUMN IF EXISTS card_last4,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS original_amount,
  DROP COLUMN IF EXISTS exchange_rate;


-- ============================================================
-- 6) COMPROBACIÓN POSTERIOR
-- ============================================================
-- Debe devolver: columnas_del_modulo = 'merchant'  (solo esa, la preexistente)
--                tabla_card_budgets  = 'no existe'
--                indices             = los tres preexistentes
select 'columnas_del_modulo' as clave,
       coalesce(string_agg(column_name, ', ' order by column_name), '(ninguna)') as valor
  from information_schema.columns
 where table_schema = 'public' and table_name = 'user_expenses'
   and column_name in ('source','external_id','card_last4','merchant',
                       'currency','original_amount','exchange_rate')
union all
select 'tabla_card_budgets',
       case when exists (select 1 from information_schema.tables
                          where table_schema='public' and table_name='card_budgets')
            then 'EXISTE' else 'no existe' end
union all
select 'indices',
       string_agg(indexname, ', ' order by indexname)
  from pg_indexes where schemaname='public' and tablename='user_expenses';
