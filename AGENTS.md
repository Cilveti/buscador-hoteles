# Buscador de hoteles

Repositorio vigente: `https://github.com/Cilveti/buscador-hoteles`, cuenta de trabajo `Cilveti` (`inigo.cilveti@biko2.com`).

Proyecto independiente para enseñar desarrollo y verificación determinista. Mantener catálogo, filtros, fichas y administración de hoteles/usuarios. No incorporar modelos, embeddings, búsqueda semántica, herramientas MCP ni evaluaciones de agentes.

## Trabajo

- TypeScript estricto, Bun, Next/React, Payload/PostgreSQL. Simplicidad y tests sobre comportamiento.
- Preguntas de solo lectura; ejecutar cambios solicitados. No tocar proyectos ajenos.
- Conservar lint, tipos, tests de comportamiento, navegador y dependency-cruiser.
- Usar base de datos, volumen y puertos exclusivos de este proyecto.
- No publicar secretos ni credenciales. Mantener datos locales y pruebas separados de entornos ajenos.
- Si se trabaja en paralelo, acordar propiedad de archivos y verificar la integración antes de entregar.
- Ejecutar `bun run verify` tras cambios funcionales. Para persistencia o administración, preparar la base exclusiva y ejecutar `bun run test:e2e`.

## Datos

El catálogo, sus cinco marcas, sus valoraciones y sus ilustraciones son ficticios. Mantener esa indicación en la interfaz y no incorporar capturas ni datos de cadenas reales.
