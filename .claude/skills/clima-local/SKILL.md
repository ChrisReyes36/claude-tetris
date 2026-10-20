---
name: clima-local
description: Obtiene el clima actual y el pronóstico de los próximos días de la ubicación local del usuario (o de una ciudad indicada) sin necesidad de API key. Úsala cuando el usuario pregunte por el clima, la temperatura, la lluvia, el pronóstico o si debe llevar paraguas/abrigo.
argument-hint: "[ciudad opcional]"
allowed-tools: Bash(curl *), WebFetch
---

# Clima local

Consulta el clima con el servicio gratuito [wttr.in](https://wttr.in) (no requiere API key ni registro).

## Ubicación

- Si el usuario pasó una ciudad en `$ARGUMENTS`, úsala (sustituye espacios por `+`, p. ej. `San+Salvador`).
- Si no, deja la ubicación vacía: wttr.in la detecta por la IP. Si el resultado parece incorrecto, pregunta al usuario su ciudad y úsala en las siguientes consultas.

## Pasos

1. Obtén los datos en JSON (reemplaza `<CIUDAD>` o déjalo vacío):

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=j1&lang=es"
   ```

2. Del JSON usa:
   - `nearest_area[0]`: `areaName`, `country` → ubicación detectada.
   - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `winddir16Point`, `precipMM`, `uvIndex`, `lang_es[0].value` (descripción).
   - `weather[0..2]`: `date`, `mintempC`, `maxtempC`, y `hourly[*].chanceofrain` (toma el máximo del día) para el pronóstico de 3 días.

3. Si `curl` falla o devuelve algo que no es JSON, reintenta una vez con el formato corto:

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=3&lang=es"
   ```

   Si tampoco funciona, informa que no hay conexión o que el servicio no responde. No inventes datos.

## Formato de respuesta

Responde en español, breve, con unidades métricas:

```
📍 <Ciudad, País>
Ahora: <descripción>, <temp>°C (sensación <feels>°C)
Humedad <h>% · Viento <v> km/h <dir> · Lluvia <mm> mm · UV <uv>

Próximos días
- <fecha>: <min>°C – <max>°C, prob. de lluvia <p>%
- ...

Recomendación: <una línea práctica: paraguas, protector solar, abrigo, etc.>
```

## Notas

- Solo lectura: esta skill no modifica archivos del proyecto.
- Menciona que los datos vienen de wttr.in y que la ubicación por IP es aproximada.
