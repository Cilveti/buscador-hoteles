# Mutation testing

Úsalo para evaluar si las pruebas detectan cambios incorrectos en reglas relevantes, especialmente cuando tienen cobertura pero podrían afirmar poco. No es una comprobación de cada edición ni un objetivo de alcanzar 100%: ejecutar y mantener tests también cuesta.

## Alcance y ejecución

1. Inspecciona la configuración existente, el código que muta y los tests que ejecuta. Comprueba primero que esos tests pasan sin mutación; si no, resuelve o informa del fallo base antes de interpretar mutantes.
2. Elige una regla o cambio acotado de valor. Conserva el alcance explícito en el informe. No añadas una campaña global, scripts nuevos o umbrales de bloqueo sin necesidad y una medida inicial.
3. Ejecuta Stryker y revisa su informe guardado. Mejora pruebas para los supervivientes relevantes y repite sobre el alcance afectado; no ejecutes otra campaña solo para releer su salida.

## Configuración propia

Ya existe [stryker.config.json](../../../../stryker.config.json), con sus scripts en [package.json](../../../../package.json). Muta reglas de capacidad; no es una campaña del catálogo entero.

Stryker usa `testRunner: "command"` con un comando Bun finito y `coverageAnalysis: "off"`. Este runner ejecuta el conjunto configurado por mutante: no proporciona selección por cobertura de cada test ni permite interpretar ausencia de cobertura igual que un runner integrado. No copies `perTest` de un ejemplo Vitest ni cambies de runner sin motivo. Mantén versiones locales fijadas, sin inicializadores o descargas `@latest` por ejecutar la prueba.

Los sandboxes actuales no mutan en el árbol de trabajo (`inPlace: false`) y excluyen secretos. Al ampliar el alcance, revisa que las exclusiones no omitan código necesario. Si eliges mutar un diff entre commits, comprueba qué trabajo sin versionar queda fuera; no lo presentes como el cambio completo ni hagas commits/stashes implícitos.

## Interpretar, no maquillar

- **Detectado:** la prueba falla con el mutante. Comprueba que el fallo representa la regla esperada si refuerzas un caso concreto.
- **Superviviente relevante:** existe una entrada o efecto observable distinto permitido por el contrato. Añade la menor prueba de comportamiento que lo distinga.
- **Equivalente:** no cambia comportamiento bajo el contrato vigente. Explica el argumento; no fabriques tests de detalles internos para matarlo. Si no puedes justificar equivalencia, registra la duda.
- **Error, timeout o campaña incompleta:** investiga la ejecución y distingue el estado del resultado de las assertions. No los describas como una prueba que detectó el bug.

No reduzcas `mutate`, debilites fixtures, suprimas operadores o alteres umbrales para mejorar el porcentaje aparente. Las exclusiones justificadas deben quedar explícitas, con su efecto en el alcance. Tampoco cambies la regla de producción solo para facilitar matar mutantes.

Para una comprobación manual puntual, aísla el cambio deliberado, observa el rojo y restaura solo esa mutación antes de comprobar el verde. Preserva cambios previos; no uses resets amplios. Informa de alcance, detectados, supervivientes y limitaciones, sin atribuir ese resultado a todo el sistema.
