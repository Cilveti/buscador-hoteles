# Integridad arquitectónica

Un test arquitectónico comprueba una decisión de dependencias; no demuestra que el diseño completo sea bueno ni limita por sí mismo qué archivos puede editar un agente. Para decidir las fronteras consulta [la skill hexagonal](../../hoteles-hexagonal/SKILL.md) y [la arquitectura vigente](../../../../docs/architecture.md).

## Qué automatizar

Añade una regla cuando su incumplimiento importe lo suficiente como para rechazar ese cambio: por ejemplo, que core importe Payload o que la aplicación del frontend dependa de React. No conviertas preferencias de nombres, número de carpetas o cantidad de clases en arquitectura obligatoria.

El repositorio declara las reglas en [dependency-cruiser](../../../../.dependency-cruiser.cjs) y las ejecuta desde un [check con Bun](../../../../tests/architecture/dependencies.test.ts), disponible como `bun run check:architecture` e incluido en `test`/`verify`. Amplía la configuración cuando haya una frontera nueva. Los [fixtures](../../../../tests/architecture/configuration.test.ts) verifican dependencias permitidas y prohibidas. Un guard AST pequeño sigue rechazando rutas calculadas (`import(variable)` y `require(variable)`), que la herramienta no incorpora al grafo. Sigue el grafo real de imports: relativos, aliases, tipos, reexports y cargas dinámicas pueden atravesar una frontera aunque el bundler elimine parte del código.

## Comprobar también el detector

- Conserva ejemplos de dependencias permitidas y prohibidas, incluidos caminos que puedan eludir la nueva regla. Usa pequeños fragmentos como datos de entrada al detector; no introduzcas imports ilegales en producción para dejarlos allí.
- El fallo debe identificar origen, dependencia rechazada y la decisión que protege. Una lista vacía solo sirve si el detector realmente examinó el alcance previsto: detecta un scope inesperadamente vacío en vez de aprobarlo por vacuidad.
- No relajes el patrón, la exclusión o la allowlist solo porque el cambio lo viola. Si la arquitectura necesita una excepción legítima, explicita su motivo y alcance antes de incorporarla.

Una regla de imports puede impedir ciertas dependencias, pero no detectar por sí sola toda lógica de negocio colocada en el sitio equivocado. Complementa con pruebas de comportamiento y revisión del diseño; no declares cubiertas fronteras que todavía no inspecciona el detector.
