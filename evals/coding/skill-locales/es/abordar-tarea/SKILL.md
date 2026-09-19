---
name: abordar-tarea
description: Implementar una tarea de desarrollo a partir de requisitos, con exploración proporcionada, pruebas de comportamiento y revisión final por requisito. Usar al construir o corregir funcionalidad; no para preguntas de solo lectura ni para ejecutar el evaluador de agentes.
---

# Abordar una tarea de desarrollo

La especificación define qué debe cumplir el producto. Esta skill define cómo abordar el trabajo y reunir evidencia para entregarlo. Decide el diseño técnico y la descomposición según el código existente; no hace falta convertir una tarea pequeña en un plan ceremonial.

## Entender y ejecutar

Lee los requisitos, el contexto afectado y las instrucciones del proyecto. Identifica lo que ya está resuelto y las fronteras que debes respetar. Consulta las skills específicas que aporten criterios a esta tarea: en este proyecto, [testing](../hoteles-testing/SKILL.md), [arquitectura](../hoteles-hexagonal/SKILL.md) y, para UI, [verificación del buscador](../hoteles-verificar-buscador/SKILL.md).

Relaciona cada requisito con un comportamiento observable y una forma de comprobarlo. Puedes mantener esta relación en tus notas; no se exige crear un documento ni una prueba por cada frase. Resuelve decisiones técnicas reversibles con criterio. Si falta una decisión de producto que cambia el resultado, identifica el bloqueo; no inventes requisitos.

Implementa incrementos verificables y utiliza el feedback de las herramientas para corregir. Cuando amplíes una prueba existente, comprueba que sus expectativas puedan detectar una implementación incorrecta: las salidas de la misma función no deben ser la única fuente de verdad. Sigue las directrices de testing del proyecto, sin duplicar casos ni añadir pruebas que solo reproduzcan la implementación.

## Comprobar el resultado antes de terminar

Contrasta cada requisito con la implementación y una evidencia de verificación. Comprueba el recorrido principal y los casos límite relevantes: por ejemplo, valores ausentes, eliminación de la última selección, combinaciones, restauración del estado y recuperación de errores cuando apliquen. Selecciona los casos por las reglas y riesgos de la tarea; no hagas combinaciones exhaustivas sin utilidad.

Antes de terminar, verifica las transiciones de estado relevantes. Para cada una, identifica el estado inicial, la acción y el estado resultante esperado según los requisitos. Prepara ese estado inicial, realiza la acción y comprueba qué debe aparecer, desaparecer o mantenerse. Aplica esto también a los caminos de error y los límites: verifica el estado resultante, no solo que se haya ejecutado la acción o aparezca un mensaje.

En UI, comprueba comportamiento, textos y estados visibles **después de interactuar y restaurar la página**, además del estado inicial. Revisa accesibilidad pertinente. Ejecuta o amplía los recorridos de navegador que cubran estos comportamientos; pasar una suite existente no acredita requisitos que esa suite no comprueba. No repitas manualmente recorridos ya cubiertos salvo que haya una duda concreta.

Usa el entorno de navegador indicado por la skill correspondiente. Si el controlador proporciona una conexión a un navegador existente, úsala también en scripts propios; no lances otro proceso ni sustituyas sus parámetros. Un fallo de arranque no valida la interfaz: diagnostica con la guía disponible o registra la comprobación pendiente.

En este proyecto, ejecuta `bun run verify` (lint, tipos, suite completa y navegador base) y el comando `acceptanceCommand` de `evals/coding/tasks/<tarea>/task.json` cuando la tarea tenga aceptación visible. Corrige fallos introducidos y vuelve a comprobar después de la última modificación. Si una comprobación ya ejecutada sigue cubriendo exactamente el estado entregado, no la repitas sin motivo.

Revisa el diff final: alcance, legibilidad, contratos, pruebas útiles y ausencia de cambios accidentales. No rebajes requisitos ni debilites verificaciones para obtener un verde. Separa fallos introducidos de errores de entorno o deuda previa; atribuye la causa solo cuando tengas evidencia, no porque el archivo esté fuera de tu cambio.

## Entregar

Resume lo implementado, las comprobaciones ejecutadas y sus resultados, con enlaces a evidencia útil. Indica los requisitos o casos que no pudiste comprobar. No presentes una comprobación fallida o un intento de ejecución como aprobado. No necesitas una tabla enorme: que el revisor pueda entender qué funciona, qué se verificó y qué falta.
