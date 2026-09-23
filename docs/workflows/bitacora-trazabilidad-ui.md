# Bitácora · sala de control de workflows

## Objetivo

Construir una aplicación local para lanzar y observar en vivo workflows normales y evaluaciones con un contrato de representación común: fases/checks, agentes, trazas, feedback, evidencias y fallos. Mantener el lanzamiento sencillo desde UI o agente de confianza; no integrar ni publicar código automáticamente.

## Estado actual

Implementación validada. La UI del laboratorio proyecta workflows locales y evaluaciones con un contrato común y traza en vivo. Una ejecución real de `copy-search` iniciada desde la API terminó completa: seis agentes, checks de baseline y candidato, review, QA/Chrome y patch aplicable. Las limitaciones de enlaces nativos y trazas antiguas se describen abajo.

## Progreso

- Revisada la conversación «Arregla workflow y trazabilidad» del 22/09 y la transcripción de la sesión 4, 55:25–58:07.
- Leída la estructura real del workflow local y de la UI de evaluaciones. El prototipo inline anterior era una instantánea: sus enlaces y actualización eran demostrativos.
- Añadidos `WorkflowRun`, definiciones en `workflows/definitions`, adaptadores de workflow local/evaluación, API loopback autenticada, SSE, navegador de agentes, feedback, checks y artefactos. El formulario de la UI inicia un snapshot aislado y permite aprobar el plan pausado.
- Los nuevos workflows locales persisten la sesión Codex y muestran comando de reanudación con su workspace; evals e históricos efímeros no. OpenCode/Cursor siguen sin adaptador ni enlace nativo verificado.
- Al compactar evaluaciones nuevas se archivan eventos visibles de cada agente por separado antes de eliminar las trazas brutas. La UI pagina eventos antiguos. El razonamiento interno no se expone.
- Un run histórico `completed` con patch corrupto se representa como fallido. El controlador nuevo valida los bytes del patch contra el snapshot base antes de entregar.
- Test de navegador sin modelos: fase en curso → traza del agente → fallo y feedback aparecen sin recarga. Tests de API/seguridad, paginación, retención y política de patch pasan. El primer pase global detectó que el test simulado permite patch vacío: se ajustó la comprobación de aplicabilidad para que el no-op sea sintácticamente válido; aceptación/review deciden si cumple la tarea.
- Ejecución real `local:2026-09-23T00-04-04-997Z-copy-search-normal`, iniciada desde la API el 23/09: `completed` en 4 min 1 s, seis agentes Codex GPT-5.6 Luna high, nueve checks verdes contando baseline, candidato y aplicabilidad de entrega. QA observó AC1 y AC2 en Chrome sintético; `RESULTADO.md` enlaza su captura y traza. Snapshot aislado, sin integración ni publicación.
- Comprobación visual de la sala sobre ese run en curso: fases, sesiones identificadas, checks y trazas. Suite global: 227 tests, tipos y lint verdes. Suite UI: 13 tests verdes, incluido cambio de estado en vivo y representación de evaluación de agente único.
- Una evaluación histórica `incomplete` se mostraba como «Sin evidencia / Evaluación en curso». Ahora se presenta como fallida con el error real de preflight. Un run histórico `completed` con patch corrupto muestra check y paso final rojos.

## Decisiones

- Una única interfaz local autenticada y un contrato `WorkflowRun` normalizado; adaptadores para workflow local y evaluación. La UI nunca interpretará JSONL ad hoc.
- La vista principal debe responder qué paso está activo, qué checks han pasado, qué falló y qué feedback recibió el siguiente agente; la traza de cada agente es un segundo nivel.
- Mantener el servidor solo en loopback. No exponer archivos arbitrarios ni bundles privados a través de la UI.
- No fingir enlaces nativos a sesiones de otras herramientas. Codex CLI tiene ID en JSONL, pero `--ephemeral` actualmente impide reabrir esa sesión; comprobar el contrato antes de habilitar un enlace.
- Una sesión Codex nueva del workflow se conserva; se ofrece un comando de `codex resume` verificable por contrato CLI. No inventar `codex://` para Desktop sin prueba. El archivo proyectado de eval no equivale a sesión reanudable.

## Aprendizajes confirmados

- Rubén pidió reconstruir la cadena para saber «si voy por buen camino» y «si el sistema funciona como espero», no solo un volcado de logs.
- El run real demuestra que la representación llega de extremo a extremo, incluido Chrome; no demuestra que review/QA encuentren todos los bugs. Esa capacidad se mide por separado.
- `codex exec --help` confirma que `--ephemeral` evita persistir sesión y que `codex exec resume` requiere una sesión previa. Los logs Codex actuales incluyen `thread.started.thread_id`.
- La UI local ya dispone de autenticación por capacidad en `Authorization`; SSE deberá usar `fetch` con cabecera, no `EventSource` anónimo.

## Errores y correcciones

- No confundir la etiqueta `completed` de un run con prueba de entregable aplicable; el diagnóstico previo encontró un patch corrupto pese a checks verdes. La UI debe mostrar esa contradicción y la evidencia, no maquillarla.

## Próximo paso

El núcleo pedido queda cerrado: tests finales 227/227, UI 13/13, tipos, lint y `git diff --check` verdes. La sala de control está servida en el puerto habitual 3415; la API final confirma el run real con seis outputs, nueve checks y patch aplicable. Como mejoras posteriores no bloqueantes: verificar un deep link de Codex Desktop si se publica un contrato oficial, y añadir adaptadores OpenCode/Cursor solo cuando se implementen y prueben sus sesiones. No reconstruir trazas que ya se borraron.
