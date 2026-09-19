# Contratos, tipos y validación runtime

Los tipos comprueban usos del código; Zod comprueba datos que llegan en ejecución. Ninguno garantiza por sí solo que una regla de producto sea correcta. Sitúa la validación en la frontera dueña del contrato, sin duplicar schemas entre transporte, fixture y consumidor.

## Fuente única, expectativa independiente

- Reutiliza el schema de producción y sus tipos inferidos (`z.infer`, o `z.input` cuando la entrada difiera por transformación). No mantengas una interfaz manual que repita su forma ni uses casts para eludir el parseo.
- Eso no convierte al schema en su propio oráculo. Prueba que acepta y rechaza ejemplos obtenidos del contrato acordado, no solo datos generados por el mismo schema.
- Para inputs inválidos usa datos sin validar o `unknown`; es precisamente la frontera la que debe rechazarlos. No fuerces un objeto inválido a aparentar un tipo válido con `as` o `any`.
- Cubre coerciones, valores por defecto, límites y campos extra cuando cambien el comportamiento. Distingue dato ausente de dato explícitamente vacío, cero o falso según el contrato.

## Feedback útil

En fallos representativos, comprueba el código y la ruta del problema que identifican el dato culpable. Para reglas propias, conserva un mensaje accionable y fiel al dominio; verifica el texto exacto solo cuando sea parte del contrato público. Evita snapshots del error completo y de mensajes internos de la librería que pueden cambiar sin alterar el contrato.

Una regla entre campos necesita ejemplos incompatibles aunque todos tengan el tipo correcto. Las proyecciones públicas necesitan comprobar que no filtran campos administrativos. Validar solo la forma final no prueba permisos ni que el cálculo sea correcto.

## Encaje local

Schemas y tests en [packages/contracts](../../../../packages/contracts/src/catalog.ts) y [catalog.test.ts](../../../../packages/contracts/src/catalog.test.ts). La dirección de dependencias está en [arquitectura](../../../../docs/architecture.md): no importar schemas de transporte en el core para satisfacer un test. Comprueba con el typecheck existente el uso tipado y con Bun el parseo real; no presentes uno como sustituto del otro.
