# Buscador de hoteles

Repositorio vigente: `https://github.com/Cilveti/buscador-hoteles`, cuenta de trabajo `Cilveti` (`inigo.cilveti@biko2.com`).

Proyecto independiente para enseñar desarrollo y verificación determinista. Mantener catálogo, filtros, fichas y administración de hoteles/usuarios. No incorporar modelos, embeddings, búsqueda semántica, herramientas MCP en el producto. El laboratorio local de evaluación de arneses está autorizado y vive en `evals/coding/` y `scripts/coding-eval/`, separado del buscador.

## Trabajo

- TypeScript estricto, Bun, Next/React, Payload/PostgreSQL. Simplicidad y tests sobre comportamiento.
- Preguntas de solo lectura; ejecutar cambios solicitados. No tocar proyectos ajenos.
- Conservar lint, tipos, tests de comportamiento, navegador y dependency-cruiser.
- Usar base de datos, volumen y puertos exclusivos de este proyecto.
- No publicar secretos ni credenciales. Mantener datos locales y pruebas separados de entornos ajenos.
- Si se trabaja en paralelo, acordar propiedad de archivos y verificar la integración antes de entregar.
- Tras cambios funcionales solo en fuentes/tests del catálogo, ejecutar `bun run verify:app` (lint, todos los tipos, tests del producto/arquitectura y navegador). Para scripts, workflows, laboratorio, dependencias o configuración, ejecutar `bun run verify` completo; CI conserva esa suite. El implementador comprueba primero su cambio y el controlador verifica después de forma independiente. Para persistencia o administración, preparar la base exclusiva y ejecutar `bun run test:e2e`.

## Datos

El catálogo, sus cinco marcas, sus valoraciones y sus ilustraciones son ficticios. Mantener esa indicación en la interfaz y no incorporar capturas ni datos de cadenas reales.

## Laboratorio de arneses

Petición de Iñigo del 15 de septiembre: continuar aquí todo el laboratorio, con skills en inglés y castellano y selección de idioma por evaluación. Leer `.agents/skills/evaluar-agentes-codigo/SKILL.md`. Las aceptaciones privadas y el dossier del juez deben permanecer fuera del checkout y del historial visible para el candidato. Conservar la procedencia de resultados anteriores sin importar el producto antiguo.

La skill `.agents/skills/abordar-tarea/SKILL.md` es el proceso base para las tareas de desarrollo evaluadas (decisión explícita del 16 de septiembre). Inyectar su contenido íntegro mediante `processSkill`, con `promptText: null` cuando no haya una edición deliberada; no sustituirla por un resumen o un prompt vagamente inspirado en ella. Verificar la fuente y el texto congelado antes de ejecutar. Cualquier variante sin esta skill debe ser un experimento explícito, identificado como tal, y no el control por defecto.
