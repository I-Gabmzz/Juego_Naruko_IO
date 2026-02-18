# Naruko Survivors: Hokage Rush

Prototipo tipo **Vampire Survivors** inspirado en Naruto, con UI mejorada, sistema de oleadas y soporte para sprites.

## Novedades principales

- HUD completo + pantallas de inicio y selección de mejoras.
- Soporte para sprites del jugador y enemigo.
- Sistema de progresión actualizado:
  - **Cada nivel múltiplo de 5** abre mejoras normales.
  - **Cada nivel múltiplo de 6** abre mejoras especiales.
- Habilidades: kunai automático, shuriken triple, rasengan de área y dash.

## Sprites

Coloca tus imágenes en `assets/`:

- `assets/naruto.png`
- `assets/enemy_ninja.png`

> Si no están, el juego sigue funcionando con gráficos fallback.

## Controles

- `WASD` o `Flechas`: mover
- `Shift`: dash
- `P`: pausa/reanudar

## Ejecutar

```bash
npm start
```

Abre:

```text
http://localhost:8000
```

## Validación

```bash
npm run check
```
