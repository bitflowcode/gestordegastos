-- ============================================================
-- 02_notas_comercio.sql — corrección de DATOS, una sola vez.
--
-- Los movimientos importados el 16 de noviembre de 2026 llevaban como nota la
-- descripción de Wise («Transacción con tarjeta de 7,30 EUR emitida por…»),
-- que repite el importe y entierra el comercio. Desde el commit que acompaña a
-- este archivo la nota de las importaciones nuevas es el comercio; esto
-- arregla las filas que ya estaban insertadas.
--
-- DÓNDE SE EJECUTA: en el SQL Editor del panel web de Supabase (navegador),
-- pegando el contenido y pulsando Run. Nunca desde la app ni desde el
-- terminal local.
--
-- Es idempotente: la condición sobre la nota hace que una segunda ejecución
-- no encuentre filas que tocar. No toca gastos manuales (filtra por source)
-- ni notas ya editadas a mano (solo las que empiezan por la frase de Wise).
-- ============================================================

-- 1) Mirar antes de tocar: estas son las filas que se van a cambiar.
SELECT id, date, note, merchant
FROM user_expenses
WHERE source IN ('card_import', 'card_import_excluded')
  AND merchant IS NOT NULL AND merchant <> ''
  AND note LIKE 'Transacción con tarjeta%';

-- 2) Si la lista de arriba es la esperada, ejecutar la corrección:
UPDATE user_expenses
SET note = merchant
WHERE source IN ('card_import', 'card_import_excluded')
  AND merchant IS NOT NULL AND merchant <> ''
  AND note LIKE 'Transacción con tarjeta%';

-- 3) Comprobar: no debe quedar ninguna.
SELECT count(*) AS pendientes
FROM user_expenses
WHERE source IN ('card_import', 'card_import_excluded')
  AND note LIKE 'Transacción con tarjeta%'
  AND merchant IS NOT NULL AND merchant <> '';
