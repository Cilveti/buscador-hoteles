# Unitarios y casos de uso

Usa Bun para reglas puras y casos de uso con efectos controlados. La unidad es un comportamiento coherente, no necesariamente una función aislada. Prueba por la interfaz que consumen sus clientes; no exportes detalles privados solo para testearlos.

## Elegir casos que discriminen

- Parte de un ejemplo mínimo cuyo resultado puedas justificar sin ejecutar el código. Añade fronteras y combinaciones que cambien una decisión, no variaciones cosméticas del mismo caso.
- Distingue ausencia, cero, falso y desconocido cuando el dominio lo haga. En el catálogo, valoración desconocida no es valoración cero y una política condicionada no equivale a permiso confirmado.
- Para una transición de estado, observa qué queda vigente después de la acción: filtros conservados, resultados invalidados o cancelación efectiva. No pruebes la secuencia privada de llamadas si no forma parte del contrato.
- Al reproducir un bug, verifica que el test falla con el defecto presente y pasa con la corrección. Un error de import o de fixture no demuestra que detecte el bug.

## Dobles y datos

Inyecta hechos no deterministas a través de los puntos de extensión existentes. Usa un fake pequeño del puerto cuando necesites estado, o una respuesta controlada cuando baste un valor. No simules todas las funciones internas ni introduzcas una interfaz por test.

Un resultado esperado debe ser independiente, aunque los datos de entrada se creen con factories tipadas. No uses el mismo helper de producción para calcular ambos lados de la aserción. Verifica efectos relevantes mediante el contrato observable; contar llamadas solo tiene sentido si la cantidad es una obligación real, como no duplicar un cargo o una petición.

## Encaje local

Los tests de reglas viven junto a su código. [La búsqueda del catálogo](../../../../packages/core/src/catalog/search.test.ts) muestra filtros combinados, desconocidos y políticas confirmadas. Las pruebas del estado de interacción viven en `apps/web/src/features/*/application/`, sin necesitar React o navegador para reglas que no dependen de ellos.

No añadas una librería de property-based testing por defecto. Si hay una invariante útil y muchos datos posibles, puede ser una extensión justificada; una propiedad que reproduce el algoritmo sigue siendo una mala comprobación.
