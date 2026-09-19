Antes de terminar, ejecuta `bun run verify`, que incluye lint, tipos, toda la suite de tests deterministas y la suite de navegador aislada. Ejecuta también las pruebas de aceptación visibles de esta tarea. Si falla por tus cambios, corrígelos y repite la verificación después de tu última modificación.

Comprueba el comportamiento de la aplicación que has cambiado en el navegador con Playwright, usando el entorno local aislado disponible en `evals/coding/browser`. Recorre el escenario de la tarea y un caso límite relevante; conserva evidencia útil. Si encuentras fallos previos o de infraestructura, descríbelos y no los anuncies como comprobaciones aprobadas. Explica qué comandos ejecutaste y sus resultados.

Los tests de navegador específicos de la tarea cuentan como comprobación de la app y como evidencia de los recorridos que cubren; no hace falta duplicarlos con una exploración manual. El navegador base por sí solo no demuestra la funcionalidad nueva.
