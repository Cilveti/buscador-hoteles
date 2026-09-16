# Propuesta: contrato de respuesta del modelo

Estado: propuesta revisable, sin adoptar en `main`. Evaluación del 16-09-2026.

## Problema y cambio

La tarea visual #3 falló en los intentos [35071825830](https://github.com/Cilveti/buscador-hoteles/actions/runs/35071825830) y [35072051343](https://github.com/Cilveti/buscador-hoteles/actions/runs/35072051343): el último mensaje no era JSON. El formato JSON del CLI describe eventos; no impone la estructura de la respuesta del modelo. No conservamos el texto completo de aquellos runners.

La propuesta usa el servidor local de la misma versión fijada de OpenCode (1.18.30) y pide un resultado mediante JSON Schema. El driver valida también la respuesta fuera del modelo. No interpreta una respuesta inválida como éxito ni concede permisos a partir del texto.

- Servidor efímero en loopback con contraseña aleatoria; se termina al finalizar.
- `PWD`, directorio de la petición y comprobación `/path` apuntan al snapshot candidato.
- `StructuredOutput` permitido expresamente; herramientas de ejecución y red siguen denegadas.
- Sin reintentos adicionales de esquema (`retryCount: 0`); permanece el presupuesto de tres intentos por tarea.
- Artefacto diagnóstico limitado a versión, modelo, rol y presencia de resultado/error. No incluye prosa ni credenciales. Un fallo anterior a la respuesta puede no producirlo.
- Patch, permisos externos, ejecución aislada, revisión y publicación mantienen sus controles.

## Comparación congelada

Dos casos, una repetición por mecanismo, mismo modelo `opencode-go/glm-5.3-flash`. Entradas: tareas admitidas de los segundos intentos #3/#5, base `dc78c7887e4b6f2f052a4d2b84872a5bbc4c7d8d`, parche y feedback del primer intento. Cada par usa exactamente el mismo prompt. Es un experimento del arnés separado del ledger, no una reanudación de #3.

| Caso | Transporte | Modelo + respuesta | Serialización | Duración local |
|---|---|---|---|---:|
| Visual | Texto/eventos | Válida | Pasa | 33,29 s |
| Visual | Schema | Válida | Pasa | 39,93 s |
| Dependencia | Texto/eventos | Válida | Pasa | 23,03 s |
| Dependencia | Schema | Válida | Pasa | 32,83 s |

**Ambos mecanismos: 2/2 respuestas válidas. Esta muestra no demuestra mayor fiabilidad ni ahorro.** El beneficio demostrado es poder solicitar y validar un contrato explícito; los dos replays con esquema terminaron correctamente. Falta probar el nuevo transporte completo en Actions, incluido el revisor.

Los dos parches visuales son idénticos y pasan Biome. El parche de dependencia/schema coincide exactamente con la [PR #6](https://github.com/Cilveti/buscador-hoteles/pull/6), que pasó 69 tests, 10 E2E, build, revisión y Sonar mediante el transporte original. Esa evidencia valida el código coincidente, no la integración CI del nuevo driver. El candidato dependencia/text explicita `locale: 'en'`; no se completó su ensayo aislado local porque Docker dejó de responder. No se ejecutó ese candidato directamente en la cuenta del operador.

### Identidad de las entradas y salidas

SHA256:

- Prompt visual: `20e72e5b85e4d37d13cffd12a57f06c15ae90617c81077be9a6e41b5793d426a`.
- Prompt dependencia: `8f68eb377e68d2013bb8bd875d9cfe66df654de9e16a2c41ec986fbd3f18da39`.
- Patch visual, ambos: `0271e5b51a8ea41213e77948bc8d25d9f4073546b72b10fdeb22433fab7efe72`.
- Patch dependencia/text: `5d95305a077274dc3525917f3cc7c01595d02123078c4ca2457be899af24d669`.
- Patch dependencia/schema: `90a640ef09d6e1a5ee1a3c8c537c1ec5b19ed644a65aa2fde3cd096575689b63`.

## Incidentes de preparación excluidos de la comparación

1. Un primer montaje conservó el `PWD` del workspace del operador. OpenCode buscó fuera del snapshot; los permisos rechazaron la edición. Se interrumpió ese ensayo y se añadieron directorio explícito y preflight. No se cuenta como resultado de los casos congelados.
2. Un prototipo schema no permitía `StructuredOutput` bajo la regla global deny: completó ediciones, pero hizo llamadas repetidas y terminó por timeout a los 360,6 s. Se corrigió el permiso de esa herramienta de resultado y se añadió un test que rechaza la configuración antes de arrancar servidor/modelo. La fila visual/schema corresponde al replay corregido, no oculta este intento fallido.

## Repetir y decidir

1. Consultar los artefactos admitidos de los runs indicados mientras estén disponibles (retención siete días). Conservar tarea, base, diseño, patch y feedback juntos; no usar la descripción editable actual de la issue.
2. Crear snapshots limpios de esa base, preparar con el mismo worker y comprobar los hashes del prompt. Fijar OpenCode 1.18.30, modelo, permisos y límite de tiempo.
3. Ejecutar una vez por transporte y caso, con la clave solo en el proceso del modelo. El formato schema requiere `StructuredOutput: allow`; mantener denegadas shell y herramientas de red.
4. Serializar y validar el patch fuera del modelo. Pasar ambos candidatos por los mismos checks aislados y registrar fallos de montaje separadamente. No ejecutar código candidato en la cuenta personal.
5. Ampliar repeticiones antes de estimar tasas de fallo o ahorro. Revisar el cambio del arnés como PR humana; un resultado del experimento no autoriza su merge.

Validación local del cambio: 21 tests / 73 aserciones, TypeScript del arnés, Biome y actionlint verdes. No hay nuevas dependencias. Baseline remota de la rama pendiente al redactar este informe.

Referencias: [salida estructurada](https://opencode.ai/docs/sdk/#structured-output), [servidor](https://opencode.ai/docs/server/). Se contrastó además el OpenAPI generado por **1.18.30**: su campo de respuesta es `info.structured`; no se copió el nombre de campos de ejemplos de otra versión.
