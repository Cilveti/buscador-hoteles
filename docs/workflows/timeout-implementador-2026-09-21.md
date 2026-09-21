# Timeout del implementador: corrección y prueba real

## Resultado

21/09/2026: workflow normal completado con **Codex gpt-5.6-luna / high en todos los roles**, un intento de implementación y una ronda de revisión/QA. Duración desde creación del estado hasta final: **705,034 s (11 min 45 s)**. El candidato Escape permanece aislado; no se ha integrado en main.

Run local: `.tmp/local-workflows/2026-09-21T13-14-13-188Z-escape-search-normal/`.
El contrato exacto queda congelado en `spec.json` dentro del run: incluye AC1–AC4, con borrador escrito sin enviar. No se redujo el alcance para conseguir un verde.

## Qué fallaba y qué cambió

El run original `2026-09-21T12-35-50-838Z-escape-search-normal` pasó los checks del implementador pero alcanzó 300 s sin entrega estructurada final. Se conserva intacto. El controlador convertía ese timeout en fallo definitivo, sin utilizar el segundo intento.

Ahora un timeout del implementador consume el siguiente intento disponible conservando código parcial, logs y feedback. Se exige una respuesta válida y después checks externos, review y QA; nunca se acepta el timeout como éxito. Se mantienen 300 s por llamada, dos intentos y dos rondas. Otros errores técnicos y bloqueos no se reintentan indiscriminadamente. El prompt indica ejecutar el perfil completo una vez sobre el estado final y entregar inmediatamente después.

La nueva ejecución real **no necesitó reintento**. La recuperación por timeout, su agotamiento y el rechazo de otros errores se verificaron con pruebas automáticas del controlador; el runner también prueba un proceso real que excede su límite. No atribuir al run real una recuperación que no ocurrió.

## Medición por fase

| Fase | Segundos |
|---|---:|
| Baseline | 13,023 |
| Investigación (dos agentes en paralelo) | 234,361 |
| Plan | 36,688 |
| Implementación y sus comprobaciones | 228,107 |
| Verificación externa | 12,016 |
| Revisión | 63,792 |
| QA interactivo | 117,046 |

Fuente: `events.jsonl`, `createdAt` y `updatedAt` de `state.json`. El total incluye una pequeña sobrecarga entre creación y primera fase. Es una medición local, no un SLA. La investigación fue la fase más larga; los checks externos tardaron 12 s.

## Evidencias inspeccionadas

Dentro del run:

- `RESULTADO.md`: entrega terminada y enlaces a capturas.
- `round-1/implementation-1-1/agent/result.json`: entrega válida del implementador.
- `round-1/implementation-1-1/verification/verification.json`: lint, tipos, **60 tests de producto/arquitectura y 8 casos Playwright** verdes.
- `round-1/review/result.json`: pass, sin hallazgos.
- `round-1/qa/qa.json`: AC1–AC4 aprobados; 7 acciones de navegador.
- `round-1/qa/screen-03.txt` y `screen-04.txt`: antes/después del segundo Escape, misma URL, foco y contador de peticiones (3).
- `round-1/qa/screen-06.png` y `screen-07.png`: capturas inspeccionadas, borrador Lisboa con Málaga aplicada → campo vacío, España y orden por valoración conservados, dos resultados.
- `round-1/qa/trace.zip`: traza de las interacciones.
- `candidate.patch`: cinco líneas de producto y dos pruebas de navegador; aislado.

Verificación del propio arreglo del workflow: `bun run verify`, **205 tests y 6 casos de navegador**, lint y tipos verdes. Informe: `.tmp/verification/2026-09-21T13-14-11.897Z-ddb192ab/verification.json`.

Alcance: React, HTTP y core con catálogo sintético. No acredita PostgreSQL/Payload, SSR, Sonar, CI remoto ni despliegue. Los artefactos `.tmp` son locales y no se publican con este documento.
