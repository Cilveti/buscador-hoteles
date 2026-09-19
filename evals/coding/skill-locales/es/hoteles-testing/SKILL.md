---
name: hoteles-testing
description: Elegir, escribir y revisar las comprobaciones de un cambio en el buscador de hoteles. Usar al implementar comportamiento, corregir bugs o mejorar tests; carga referencias por tipo de prueba. No sustituye las evals de calidad con LLM.
---
# Filosofía y estrategia de testing

Los tests protegen comportamientos y decisiones del producto, no la forma incidental del código. Antes de añadir uno, identifica qué rotura relevante detectaría y de dónde procede el resultado esperado: requisito acordado, ejemplo resuelto o fixture revisada. No recalcules la expectativa con la implementación bajo prueba.

Consulta el criterio de aceptación, los tests del área y los [comandos del proyecto](../../../README.md); contrasta los scripts con [package.json](../../../package.json). Bun es el gestor y runner determinista; Playwright y Stryker ya están configurados. Usa lo existente, sin instalar otra metodología, runner o catálogo de comandos por defecto.

## Cómo elegir y trabajar

- Escoge la comprobación más pequeña que pueda detectar el fallo real. Sube a integración o navegador cuando la propiedad dependa de esa unión; no dupliques cada caso en todas las capas ni persigas una proporción o cobertura universal.
- Para comportamiento nuevo o un bug, trabaja por incrementos verticales: observa el rojo por la razón correcta, implementa lo necesario y refactoriza conservando verde. Un refactor puro usa los tests que ya protegen el contrato; si faltan, caracteriza primero el comportamiento relevante. No exige un test por función ni aprobación humana de cada prueba.
- Ejecuta código propio real. Controla reloj, IDs y proveedores no deterministas en fronteras justificadas; un doble no prueba la integración que sustituye. Las abstracciones se justifican por el diseño y el comportamiento, no por facilitar un mock.
- Usa fixtures pequeñas, legibles y tipadas; evita `any`, casts que disimulan datos imposibles, snapshots masivos y tests que solo inspeccionan texto fuente o llamadas internas. Un helper debe aclarar la intención, no ocultar escenario y expectativa.
- La exploración puntual sirve para aprender; no obliga a conservar un test permanente. Conserva pruebas cuando protejan una regla, recorrido o riesgo que importe mantener.

## Referencias según el cambio

Lee las referencias aplicables antes de diseñar o modificar esas pruebas; no cargues el resto. Un cambio puede necesitar más de una.

| Lo que necesitas comprobar | Referencia |
|---|---|
| Regla pura, caso de uso o transición de estado | [Unitarios y casos de uso](references/unitarios.md) |
| Mapeo, persistencia o colaboración real entre componentes | [Integración](references/integracion.md) |
| Datos externos, schemas Zod y tipos inferidos | [Contratos y validación](references/contratos.md) |
| Dependencias permitidas y aislamiento arquitectónico | [Integridad arquitectónica](references/arquitectura.md) |
| Recorrido visible, interacción o recuperación en navegador | [E2E con Playwright](references/e2e.md) |
| Si los tests detectan cambios incorrectos en una regla | [Mutation testing](references/mutacion.md) |

## Ante un fallo y al terminar

Un fallo puede señalar un bug, una expectativa incorrecta o un problema del entorno. Identifica cuál con evidencia. No borres, debilites, saltes ni actualices tests/snapshots para acomodar una regresión. Si el requisito ha cambiado explícitamente, actualiza la prueba explicando la nueva expectativa; si el contrato es ambiguo o contradictorio, consulta esa decisión, no inventes una para conseguir verde.

Ejecuta primero la prueba focalizada y después los checks afectados por el radio del cambio, incluidos tipos y otras fronteras si corresponde. Comprueba qué incluye realmente el script: ni un nombre como `test` acredita cobertura total ni una suite omitida equivale a una suite correcta. Revisa también el diff de tests, fixtures y configuración.

Informa brevemente del comportamiento comprobado, comando y resultado, dependencias sustituidas y verificaciones pendientes. No atribuyas a una inspección en navegador las garantías de una suite ni a un verde la ausencia de bugs.

Las respuestas de LLM usadas en tests comunes son fixtures deterministas. Las evals reales de calidad requieren dataset, configuración y presupuesto propios: se ejecutan aparte según la [guía de evaluaciones](../../../evals/coding/README.md), no como consecuencia de pedir los tests habituales.
