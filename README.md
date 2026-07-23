# Toolisto

Página estática, original y ligera para **Toolisto**, preparada para publicarse con GitHub Pages.

## Funciones incluidas

- Compresión de imágenes en el navegador.
- Conversión entre JPG, PNG y WebP.
- Redimensionado conservando la proporción.
- Limpieza de firmas con fondo transparente.
- Detección automática y recomendación de la tarea.
- Diseño responsive para móvil, tableta y escritorio.
- Sin registro y sin subida de archivos a servidores.

## Publicar en GitHub Pages

1. Crea un repositorio público llamado `toolisto`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En GitHub, abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/ (root)`.
6. Guarda. GitHub mostrará la dirección pública en unos minutos.

## Probar localmente

Puedes abrir `index.html` directamente. Para evitar restricciones del navegador, también puedes iniciar un servidor local:

```bash
python -m http.server 8080
```

Luego abre `http://localhost:8080`.

## Estructura

```text
index.html
styles.css
app.js
assets/favicon.svg
.nojekyll
README.md
```
