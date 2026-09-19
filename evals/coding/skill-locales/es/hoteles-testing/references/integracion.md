# Integración

Elige esta prueba cuando el riesgo esté en cómo se conectan piezas reales: un adaptador traduce un contrato, la persistencia aplica una restricción o un endpoint compone un caso de uso. Declara qué componentes se ejecutan y qué dependencia se sustituye.

## Qué comprobar

- Verifica la ida y vuelta relevante: entrada aceptada, transformación, dato persistido o resultado público. Un HTTP 200 no demuestra que la operación hizo lo correcto.
- Cubre errores representativos de la frontera modificada: rechazo de permisos, datos incompatibles, ausencia o indisponibilidad. No generes un test por cada código HTTP imaginable.
- Ejecuta el adaptador que quieres validar. Un mock de ese mismo adaptador solo comprueba al consumidor. Un fake de repositorio puede servir para el caso de uso, pero no acredita SQL, transacciones ni restricciones de PostgreSQL.
- Para persistencia, observa el estado guardado mediante una lectura independiente apropiada a esa frontera. No impongas pasar por la UI para verificar una restricción de base de datos.

## Aislamiento

Usa registros sintéticos identificables o un schema de pruebas, y limpia únicamente los recursos creados por esa ejecución, también al fallar. Reutiliza las utilidades del repo. No vacíes tablas ni resetees el corpus para aislar un test.

Las integraciones locales opt-in tienen precondiciones: consulta [desarrollo](../../../../README.md) y el test antes de ejecutarlas. No cambies una URL a un servicio remoto si falta el local. Una prueba omitida por no tener infraestructura se reporta como no ejecutada, no como evidencia de integración correcta.

## Encaje local

Los [tests del handler de catálogo](../../../../apps/web/src/app/api/catalog/hotels/handler.test.ts) permiten comprobar la frontera HTTP con dependencias controladas; no confundirlos con una comprobación de Payload/PostgreSQL. Para modificar el adaptador real, selecciona además una prueba que lo ejecute contra el servicio local correspondiente.

Las llamadas pagadas a modelos no pertenecen a esta suite por defecto. Los contratos con proveedores usan respuestas reproducibles; la calidad y conectividad reales se comprueban aparte.
