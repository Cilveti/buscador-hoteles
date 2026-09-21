# Escape con aceptación Dado / Cuando / Entonces

Misma funcionalidad pequeña de la simulación anterior. Cambia la concreción de los criterios: incluyen la URL para preparar el estado y exigen observar la transición real.

## Proceso de la prueba

- Codex `gpt-5.6-luna`, esfuerzo `high`, en todos los roles.
- Workflow normal completo, sin pausa de plan: base → investigación → plan → implementación → verificación externa → revisión → QA → entrega.
- Implementación: lint, tipos y tests automáticos relevantes, incluidos tests de Playwright. La exploración interactiva queda para el QA posterior.
- Revisión y QA reciben íntegros los criterios. El QA puede usar su URL, pero debe pulsar Escape y comprobar el resultado.
- Límites predeterminados: dos intentos y dos rondas. No integrar ni publicar el candidato.

## Repetir

Desde la raíz del repositorio:

```sh
bun run workflow start --spec docs/workflows/tasks/escape-search-acceptance-url/spec.json --agents docs/workflows/tasks/escape-search-luna-high/agents.json --mode normal
```

El cronómetro incluye el comando completo, desde la creación del snapshot hasta el cierre. Excluye preparación de estos archivos y comprobaciones del arnés anteriores al lanzamiento. La app usa datos sintéticos, sin PostgreSQL.
