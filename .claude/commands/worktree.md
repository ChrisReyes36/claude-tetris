---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí el requerimiento indicado
argument-hint: <requerimiento a ejecutar en el worktree>
---

Requerimiento: $ARGUMENTS

Sigue estos pasos en orden:

1. Si `$ARGUMENTS` está vacío, pide al usuario el requerimiento y detente.
2. Determina un nombre corto para el worktree a partir del requerimiento: kebab-case, minúsculas, sin acentos ni caracteres especiales, máximo 4 palabras (p. ej. `pieza-fantasma`, `fix-rotacion`).
3. Crea el worktree con una rama nueva del mismo nombre, partiendo de la rama actual:
   `git worktree add .trees/<nombre> -b <nombre>`
   Si la carpeta o la rama ya existen, elige otro nombre (añade sufijo `-2`, etc.). Nunca reutilices ni sobrescribas un worktree existente.
4. Asegúrate de que `.trees/` esté en `.gitignore`; si no, añádelo.
5. Ejecuta TODO el requerimiento dentro de `.trees/<nombre>`: lee, edita y ejecuta comandos solo con rutas dentro de ese directorio. No toques el código del directorio principal.
6. Al terminar, haz commit en la rama del worktree (mensaje convencional en español, p. ej. `feat: ...`). No hagas push ni merge ni elimines el worktree salvo que el usuario lo pida.
7. Informa: nombre del worktree, ruta, rama, resumen de cambios y cómo integrarlo (`git merge <nombre>`) o eliminarlo (`git worktree remove .trees/<nombre>`).
