# QA con y sin un atajo de preparación

20/09/2026. Dos revisiones terminadas del mismo candidato de Escape, con Codex `gpt-5.6-luna`, esfuerzo `high`, mismos tres criterios y máximo de 16 pasos. **El enlace preparado ahorró 32,312 segundos y tres llamadas al modelo en esta pareja.**

| Medida | Preparación mediante controles | Enlace al estado preparado |
|---|---:|---:|
| Tiempo, incluido arranque/cierre | 76,107 s | 43,795 s |
| Acciones de navegador | 7 | 4 |
| Llamadas al modelo, incluido veredicto | 8 | 5 |
| Tokens de entrada | 164.739 | 95.772 |
| Entrada cacheada | 53.760 | 33.024 |
| Entrada sin caché | 110.979 | 62.748 |
| Tokens de salida, incluido razonamiento | 2.108 | 1.093 |
| Tokens totales | 166.847 | 96.865 |
| Tasa de caché | 32,6 % | 34,5 % |
| Equivalente API estimado | 0,025801 USD | 0,014522 USD |
| Criterios comprobados | AC1–AC3 | AC1–AC3 |

Reducción observada: **42,5 % de tiempo, 41,9 % de tokens y 43,7 % del equivalente API**.

## Qué cambió

Ambos agentes empezaron en `/`. Uno preparó búsqueda, país y ordenación usando los controles. El otro recibió un único hotspot: `/?q=M%C3%A1laga&country=Spain&sort=rating`, con una descripción del estado esperado. El atajo no pulsaba Escape ni devolvía el veredicto.

Ambos observaron la búsqueda aplicada, pulsaron Escape, comprobaron campo/URL/foco/resultados y pulsaron Escape otra vez con el campo vacío. El contador de peticiones permaneció estable en esa segunda pulsación. Se revisaron historial, observaciones y capturas; no se aceptó únicamente la declaración de éxito del modelo. El hash del patch se comprobó antes y después: no cambió.

## Límites e incidencia conservada

Una muestra válida por condición, ejecutadas en paralelo con servidores, puertos, navegadores y contextos separados. Los tiempos pueden variar por latencia del modelo y concurrencia; no es una estimación estadística del ahorro habitual. La comparación fuerza preparación mediante controles frente a URL conocida: el QA actual ya dispone de navegación por URL y podría descubrir un enlace por sí mismo.

La primera pareja piloto fue inconclusa: el agente sin atajo terminó a los 26,704 s con los tres criterios pendientes; no se cuenta como una revisión más rápida. Con atajo terminó en 85,642 s, con seis llamadas y un intento de tecla mal especificado que corrigió. Se aclaró para **ambos** el protocolo de devolver una sola acción en el mensaje final y se repitió la pareja una vez. Se conservan los cuatro ensayos y sus costes; no hubo cambios de modelo, criterios o límite de pasos. Los cuatro ensayos suman aproximadamente **0,070796 USD equivalentes**.

## Coste y trazabilidad

Estimación por tokens informados por el CLI, no factura de Codex ni coste de la suscripción. Tarifas estándar comprobadas en la [documentación oficial de Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna): 0,20 USD por millón de entrada, 0,02 de entrada cacheada y 1,20 de salida. No hubo tokens de escritura de caché ni llamadas que superasen el umbral de contexto largo. El razonamiento es un subconjunto de la salida y no se suma dos veces. No se mide consumo de CPU ni se incluyen las llamadas del agente que preparó este experimento.

- [Comparación y configuración del cálculo](../../.tmp/qa-shortcuts-comparison/2026-09-20T18-08-52-065Z/comparison.json).
- [Condiciones exactas y hash del candidato](../../.tmp/qa-shortcuts-comparison/2026-09-20T18-08-52-065Z/experiment.json).
- [Sin atajo: acciones, criterios y evidencias](../../.tmp/qa-shortcuts-comparison/2026-09-20T18-08-52-065Z/without-shortcuts/qa.json).
- [Con atajo: acciones, criterios y evidencias](../../.tmp/qa-shortcuts-comparison/2026-09-20T18-08-52-065Z/with-shortcuts/qa.json).
- [Pareja piloto, incluido el resultado incompleto](../../.tmp/qa-shortcuts-comparison/2026-09-20T18-06-33-744Z/comparison.json).

Recomendación: proporcionar las URLs de preparación conocidas para escenarios frecuentes. Este ensayo no justifica construir un framework de scripts; un enlace ya evitó tres interacciones de preparación. El experimento usó una copia temporal del runner y no modifica el flujo de QA vigente.
