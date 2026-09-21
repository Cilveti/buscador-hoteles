---
name: abordar-tarea
description: Refina una tarea mediante grill-me, conviértela en una especificación y lanza el workflow local normal o Ralph. Para trabajadores ya invocados por un controlador, aplica solo el procedimiento de implementación. No usar para preguntas de solo lectura.
---

# Abordar una tarea

Actúa como interfaz del proceso, no como implementador de todos los pasos.

## 1. Grill-me

Usa [grill-me](../grill-me/SKILL.md) para resolver propósito, alcance, comportamiento, casos límite y decisiones humanas. Consulta primero el código para las dudas técnicas. Haz preguntas de tres en tres como máximo. No repitas decisiones ya dadas ni una entrevista completa cuando la especificación ya está resuelta. No inventes respuestas del usuario.

## 2. To-spec

Usa [to-spec](../to-spec/SKILL.md). Guarda el contrato JSON y su explicación breve en `docs/workflows/tasks/<id>/`. Las decisiones pendientes permanecen explícitas: el workflow se bloquea si existen. El encargo de implementar autoriza ejecutar el workflow una vez preparado el contrato; no requiere otra aprobación rutinaria.

## 3. Lanza el workflow

Desde la raíz del buscador:

```sh
bun run workflow start --spec docs/workflows/tasks/<id>/spec.json --mode normal
```

Si el usuario pide Ralph, usa `--mode ralph`. Añade `--plan-review` solo si quiere aprobar el plan y `--headed` si quiere ver el navegador del QA. El modo normal no pide aprobar el plan: solo se detiene ante bloqueos o límites. El agente padre ejecuta este comando, sigue su salida y comunica fase, resultado o decisión pendiente; no implementa el cambio en paralelo.

El controlador llama a investigadores, planificador, implementador, revisor y QA, y ejecuta las verificaciones deterministas entre fases. Cada rol agéntico usa el arnés/modelo de `workflow.agents.json`; la configuración actual usa solo Codex. Son sesiones separadas, no necesariamente proveedores distintos. Los scripts controlan transiciones, permisos del parche, intentos y evidencia. No cambies estado, gates ni presupuestos para conseguir un verde.

Para una pausa solicitada: muestra `plan.md` del run y, tras aprobación explícita de ese plan, ejecuta `bun run workflow resume <directorio> --approve-plan`. Si se piden cambios en la especificación, prepara otra ejecución; no continúes con un contrato distinto.

## 4. Entrega

Lee `RESULTADO.md` y `state.json`. Enseña el cambio y las evidencias; un proceso terminado no equivale a checks superados. El workspace y el patch quedan aislados: no aplicar, publicar o fusionar sin encargo. Describe el límite del QA sin base de datos; no atribuirle persistencia ni SSR.

## Cuando ya eres un trabajador

Si `LOCAL_WORKFLOW_WORKER=1` o el prompt te identifica como trabajador de un workflow, NO entrevistes, conviertas a spec ni lances otro workflow. Respeta tu fase: investigadores, planificador, revisor y QA no implementan. El implementador sigue [implementar](../implementar/SKILL.md), ejecuta los checks relevantes y entrega sus resultados. El controlador verifica después de forma independiente.

Si estás dentro del laboratorio de evaluación de agentes, sigue [el procedimiento de implementación evaluado](references/implementation.md). Conserva sus comandos completos y su aceptación específica; el perfil rápido del workflow no sustituye el control del experimento.

Operación y límites: [workflow local](../../../docs/workflows/README.md).
