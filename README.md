# 🎭 Anime Impostor - Stream Edition (OBS & Mobile)

Juego del impostor con temática de anime creado especialmente para streams de Twitch / YouTube / Kick y reuniones con amigos.

Diseñado con:
- **Overlay para OBS Studio (`/overlay`)**: Fondo transparente con interfaz minimalista en los bordes que no estorba en la pantalla y widget en el centro abajo que muestra al personaje de anime y su imagen en alta definición para los viewers.
- **Modo Pasa el Teléfono (`/play`)**: Pantalla móvil vertical donde cada jugador ve en secreto si es Inocente o Impostor (¡a los impostores les da pistas astutas para no quedar descubiertos!).
- **Panel de Control del Streamer (`/admin`)**: Configura hasta 8 jugadores, 1 o 2 impostores, categorías (Shonen, Seinen, Clásicos, Villanos), cronómetro y fases en vivo.
- **Preparado para GitHub y Railway**: Con soporte de dominio personalizado y WebSockets sin complicaciones.

---

## 🚀 Probar Localmente

1. Abre tu terminal en esta carpeta:
```bash
npm install
npm start
```
2. Entra en tu navegador:
- **Página principal / Hub:** [http://localhost:3000](http://localhost:3000)
- **Overlay para OBS:** [http://localhost:3000/overlay](http://localhost:3000/overlay)
- **Juego en el Teléfono:** [http://localhost:3000/play](http://localhost:3000/play)
- **Panel de Control:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 📦 Subir a GitHub

1. En tu consola ejecuta:
```bash
git init
git add .
git commit -m "Initial commit - Anime Impostor Game"
```
2. En [GitHub.com](https://github.com), crea un nuevo repositorio (por ejemplo `anime-impostor`).
3. Vincula y sube tu código:
```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

---

## ☁️ Montar en Railway con Dominio Personalizado

1. Entra a [Railway.app](https://railway.app) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **+ New Project** -> **Deploy from GitHub repo**.
3. Selecciona tu repositorio recién creado (`anime-impostor`).
4. Railway detectará automáticamente Node.js y desplegará la app con `npm start`.

### 🌐 Vincular tu Dominio Personalizado:
1. En Railway, haz clic sobre el servicio desplegado.
2. Ve a la pestaña **Settings** -> sección **Networking**.
3. Haz clic en **Custom Domain**.
4. Escribe tu dominio (ej. `impostor.tudominio.com` o `tudominio.com`).
5. En tu proveedor de dominio (Cloudflare, Namecheap, GoDaddy, etc.), agrega el registro **CNAME** o **A** que Railway te indique.
6. ¡Listo! En pocos minutos tendrás certificado SSL HTTPS automático y tu juego funcionando en tu propio dominio.

---

## 🎥 Configurar en OBS Studio

1. En OBS, ve a tu escena de stream.
2. En la lista de **Fuentes (Sources)**, haz clic en el botón **+** y elige **Navegador (Browser)**.
3. Ponle de nombre `Anime Impostor Overlay`.
4. En **URL**, pon: `https://tu-dominio.com/overlay`
5. Ajusta la resolución:
   - **Ancho (Width):** `1920`
   - **Alto (Height):** `1080`
6. Asegúrate de que la casilla *"Apagar la fuente cuando no esté visible"* esté desmarcada si no quieres que se reinicie al cambiar de escena.
7. ¡Ya está! El fondo es completamente transparente y los jugadores y la carta secreta aparecerán en las esquinas y centro inferior.

---

## 🎮 ¿Cómo se Juega? (Dinámica de la Partida)

1. **Configuración (Streamer):**
   - En `/admin`, el streamer agrega los nombres de los jugadores (máx. 8) y elige la categoría y el tiempo de debate.
   - Da clic en **"Iniciar Partida"**.
2. **Pasa el Teléfono (Jugadores):**
   - Abren `/play` en un solo teléfono (o escanean el QR).
   - El teléfono indica: *"Pasa el teléfono a Jugador 1"*.
   - El jugador presiona *"¡Soy yo! Ver mi carta"*:
     - **Inocente:** Ve la imagen del personaje de anime, su nombre y anime de origen.
     - **Impostor:** Ve la alerta roja y una **pista confidencial** (ej. rasgo, poder o categoría) para que pueda inventar algo coherente sin saber exactamente quién es.
   - Presiona *"Ocultar y pasar teléfono"* al siguiente jugador.
3. **Debate:**
   - Cuando todos han visto su carta, el teléfono avisa: *"¡Dejen el teléfono en la mesa!"* y se activa el cronómetro sincronizado con el stream.
   - Todos hacen una pregunta o dicen una frase sobre el personaje por turnos.
4. **Votación & Revelación:**
   - El streamer pasa a la fase de votación.
   - Al finalizar, presiona **"Revelar Resultados"**:
   - En el stream se muestra una animación con sirenas/fanfarria revelando quién era el impostor y si los inocentes ganaron o no.
