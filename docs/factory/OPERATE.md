# Operar la fábrica

## Estados

`ready → running → retry | waiting-human | review | exhausted | failed`.

- `retry` inicia otro run con contexto nuevo, parche anterior y feedback. Máximo tres intentos acumulados.
- `waiting-human` termina el run; espera una respuesta a la petición identificada.
- `review` significa que el proceso terminó con una propuesta y sus gates verdes; sigue siendo draft para revisión humana.
- `failed` es infraestructura/publicación/integración o respuesta inválida; no se disfraza de defecto de producto.
- `rejected` y `cancelled` son finales. Una respuesta tardía del modelo no debe reabrirlos.

La fuente de estado está en `factory-state:tasks/<issue>.json`, escrita por el controlador. Las etiquetas sirven para admisión y visibilidad, no como contador de gasto. Solo los operadores configurados pueden iniciar o decidir. El presupuesto de intentos es por issue; abrir otra issue sigue siendo una nueva autorización y puede consumir. No es un límite monetario de cuenta.

## Decisiones humanas

El agente explica el bloqueo. El controlador publica una petición con UUID, especificación congelada, permisos solicitados e intentos usados.

```text
/factory approve UUID-DE-LA-PETICION
/factory reject UUID-DE-LA-PETICION
/factory cancel
```

Una aprobación concede el perfil completo para **esa tarea**, no para todo el repositorio ni tareas futuras. Completo permite dependencias de registro, pero no scripts de package.json, workflows, checks externos, secretos o diseños aprobados. El comentario debe venir de un operador humano configurado.

La versión inicial de este protocolo resuelve solicitudes de permiso de dependencias. Una ambigüedad de producto que cambie requisitos debe resolverse en una nueva especificación/issue; aprobar un permiso no inventa una respuesta de producto.

## Fallos y recuperación

- No usar re-run como forma de reiniciar intentos: conserva SHA y contexto de GitHub, y el ledger rechaza duplicados.
- Si falla la infraestructura, revisar el estado y las evidencias antes de reanudar. Recuperación administrativa aún en validación; no borrar el ledger para fingir una primera ejecución.
- Los artefactos se conservan siete días. Una reanudación que necesita un artefacto expirado debe detenerse, no continuar sin el parche o feedback.
- Un fallo después de publicar puede dejar una draft PR. Comprobar sus gates antes de crear otra tarea.
- El análisis Sonar se ejecuta después de abrir la draft para poder asociarlo a la PR. La mera existencia de esa PR no demuestra que Sonar haya pasado.
- La aplicación de pruebas vive solo en el runner. Los humanos inspeccionan trazas/capturas; no existe todavía una URL pública de preview.

## Mejora del arnés

```bash
bun factory/improvements.ts 12 15 19
```

Genera una propuesta local desde estados reales. Añadir `--publish` crea una issue de mejora que no se ejecuta automáticamente. Un agente puede investigar la causa y preparar un cambio, comparándolo sobre tareas congeladas y un caso de control. La aprobación humana decide su incorporación. No se permite que el worker modifique su controlador para pasar sus propios checks.

## Medición

Conservar tiempo de instalación y de cada fase, intentos, estado final y atención humana solicitada. Separar:

- minutos acumulados de runners (varios jobs pueden sumar más que el tiempo de reloj);
- consumo reportado por el modelo;
- coste equivalente estimado;
- factura o cuota real del proveedor.

Resultados locales iniciales: instalación 32 s fría y 25 s con caché, 10 E2E en 21,2 s sobre `67e61d3` y Docker local. No son tiempos prometidos para otra cuenta o GitHub Actions.
