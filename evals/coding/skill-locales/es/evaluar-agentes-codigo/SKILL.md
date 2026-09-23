---
name: evaluar-agentes-codigo
description: Desarrollar y utilizar el laboratorio local de evaluación de arneses de código del proyecto, con recetas, skills, aceptación privada y juez informado. Usar para implementar el sistema, ejecutar campañas autorizadas y analizar entregas de código, no para añadir IA al buscador.
---
# Evaluar arneses de código

El laboratorio vive en `scripts/coding-eval/` y `evals/coding/`. Lee la [guía del runner](../../../evals/coding/README.md) para configuración y artefactos, y el [estado de implementación](references/estado.md) al retomar desarrollo. Mantén el trabajo dentro del proyecto; no extraigas un framework sin una nueva petición.

## Diseñar la comparación

Congela baseline de código, especificación, prompt de proceso, skills y referencias, checks, rúbrica y conocimiento privado del juez. Cambia el ingrediente previsto y registra diferencias del entorno. Las runs siguen siendo estocásticas. Dos observaciones no establecen fiabilidad ni un efecto causal del idioma entre repositorios distintos.

`skillLanguage` selecciona inglés (`en`) o castellano (`es`); `skillLanguages` sobrescribe skills individuales. Las fuentes inglesas se descubren en `.agents/skills/`; las españolas viven en `evals/coding/skill-locales/es/`. Traduce fielmente instrucciones y referencias, sin añadir requisitos más fuertes en un idioma. El candidato recibe solo las versiones elegidas en las rutas canónicas. Mantén IDs, rutas y comandos estables. Los textos editados `promptText` y `specificationText` tienen prioridad sobre las fuentes y nunca se traducen automáticamente.

Separa skills disponibles, inyectadas al inicio y prompt de proceso. Cargar una skill demuestra entrega, no cumplimiento. Lee trazas para determinar si se abrió; la inyección inline no exige una lectura posterior. No puntúes el número de llamadas a skills como calidad.

## Ejecutar

Implementar infraestructura no autoriza campañas ilimitadas. Usa modelo, esfuerzo, repeticiones y concurrencia pedidos. Primero prepara y verifica el baseline sin modelos. Un fallo de los gates del repositorio bloquea candidatos; la aceptación roja esperada de una funcionalidad pendiente no. Congela el commit resultante para comparaciones posteriores.

Cada candidato trabaja en un worktree desechable. Aceptación privada y dossier permanecen fuera de su checkout e historial Git legible. Los candidatos Codex usan una raíz Git independiente y reglas nativas de denegación para almacenamiento del controlador y privados. Si no está disponible el aislamiento, falla explícitamente; no retires restricciones para arrancar una run. El navegador usa un perfil nativo separado que deniega el acceso a archivos del controlador y privados y se comprueba en cada arranque; no es una certificación de aislamiento de código hostil.

Usa puertos/endpoints asignados y datos sintéticos. Detén solo procesos de la run. No uses la app/base habitual ni modifiques credenciales. Los candidatos usan una copia aislada de dependencias (reflinks cuando se soportan); los paquetes del workspace resuelven al candidato. El worktree se ejecuta fuera de los padres privados del controlador y se restaura después. Antes de llamar al modelo, ejecuta cada check habilitado con los mismos permisos nativos y entorno. Un fallo bloquea el modelo y guarda evidencia en environment-preflight/. Usa `bun run eval:coding:validate` para diagnosticar la provisión sin modelos; añade `--models` solo para pruebas breves autorizadas con el SDK. Ejecuta checks externos tras entregar y, por separado, los tests del candidato. No devuelvas fallos privados al candidato salvo que se evalúe explícitamente un protocolo de corrección.

## Juzgar e interpretar

Juez fijo: Codex `gpt-6-sol`, `high`. Lee entrega congelada, requisitos, checks, trazas y dossier privilegiado. El Golden Dataset es conocimiento privilegiado de comportamiento esperado, restricciones y bugs conocidos; no un patch literal obligatorio. Los juicios históricos conservan la identidad de su juez original. No abras un proyecto independiente de evaluación del juez.

Informa por separado de funcionalidad, código, tests, cumplimiento de directrices, proceso de verificación y precisión del informe. Un hallazgo del juez no equivale a reproducción determinista ni resultado de mutación. Distingue deuda previa, adaptación necesaria a legacy y ampliación de alcance no pedida. Las compactaciones son datos del proceso, no fallos por sí mismas; cobertura desconocida no equivale a cero.

Conserva los resultados finales inmutables y los resúmenes de intentos fallidos. El usuario exige retener sólo resultados: elimina worktrees de evaluación, trazas brutas, paquetes temporales del juez y artefactos pesados del navegador tras terminar, preparar o fallar. Conserva configuración, prompts, patch, mensajes finales y métricas; nunca limpies un worktree activo o ajeno. Las runs compactadas no pueden rejuzgarse con evidencia descartada. Errores de CLI, cancelaciones, timeouts, checks fallidos y costes ausentes deben permanecer explícitos. El coste equivalente API es una estimación, no factura de suscripción. Rejuzgar crea un resultado junto al original y reutiliza checks históricos; no los repite ni sobrescribe el historial.

## Acumular regresiones privadas

Los jueces devuelven `regressionTests` ejecutables; el controlador los guarda fuera del repositorio con requisito, hallazgo, hash de especificación y procedencia de entrega. Recogerlos nunca ejecuta ni promueve código generado. Antes de añadir un test a un bundle versionado de aceptación privada, el orquestador debe reproducir la aserción de producto prevista en la entrega defectuosa y obtener verde en una referencia correcta para ese requisito. Fallos de infraestructura/selectores quedan pendientes. Selecciona el nuevo bundle en recetas futuras; las campañas históricas conservan suite y notas congeladas. Consulta rutas y artefactos en la guía del runner. Los candidatos pueden consultar documentación oficial pública por red; disponer del acceso no demuestra haberlo usado.

## Dirección futura

Prioriza compositor desktop, vistas de tabla y snapshots exactos antes de ampliar. Próximos experimentos: bases limpias/legacy, alcance ambiguo, efectos de compactación y tareas sucesivas. La mejora continua puede detectar fallos, proponer cambios de arnés y compararlos en tareas congeladas. La evidencia informa la autonomía; las notas no autorizan merge, despliegue ni ampliar permisos.
