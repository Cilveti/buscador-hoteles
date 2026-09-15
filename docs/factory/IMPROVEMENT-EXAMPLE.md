# Ejemplo observado: mejorar el proceso con evidencia

Este caso documenta una corrección real de infraestructura durante la instalación. No es una evaluación de modelos ni un resultado del generador automático de propuestas.

## Incidente e hipótesis

La app pasaba localmente, pero [la primera baseline en GitHub](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030226539) falló antes de los tests con `Bun tempdir: EACCES`. La instalación usaba root sin capacidades para escribir en un volumen privado cuyo propietario era el usuario del runner.

Hipótesis: ejecutar la instalación con el UID/GID propietario del checkout y una caché explícita permite usar el mismo aislamiento en Linux. No hace falta conceder capacidades adicionales.

## Cambio y comparación

| Dimensión | Antes | Después |
|---|---|---|
| Infraestructura | `a1280ab` | `8d5ff06` |
| Código de la aplicación | Baseline `67e61d3` | La misma aplicación |
| Instalación en Actions | Falla con EACCES | Pasa, 15 segundos |
| Lint, tipos y unitarios | No llegaron a ejecutarse | Pasan, 64 tests |
| Aplicación y navegador | No llegaron a ejecutarse | Pasan, 10 E2E |
| Build | No llegó a ejecutarse | Pasa |
| Duración del job | 89 segundos, interrumpido | 308 segundos, completo |
| Modelos | Ninguno | Ninguno |

Resultado: [baseline corregida verde](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030817082). Control local adicional con la corrección: instalación y unitarios verdes en Docker Desktop. Los tests, los permisos del candidato y la prohibición de lifecycle scripts se conservaron.

## Qué enseña y qué no demuestra

Se identificó un fallo concreto, se cambió una sola decisión de ejecución y se repitió el caso que fallaba. El mayor tiempo total después es consecuencia de completar la suite, no una regresión demostrada de rendimiento.

Esto acredita la corrección en esos entornos. No estima la tasa de éxito de tareas futuras, no compara modelos y no demuestra una mejora autónoma del arnés. Para modificar prompts, herramientas o routing hay que repetir tareas congeladas, incluir casos de control y revisar también los defectos que el sistema deja pasar. La incorporación de cambios del arnés mantiene revisión humana.
