# Estado del servidor Project Zomboid (guardado)

Fecha de guardado: 09/08/2026

## Resumen
Servidor dedicado de Project Zomboid B42, modo **no-Steam** (`-Dzomboid.steam=0`), para grupo mixto Steam (con `-nosteam`) y GOG/no-Steam legal, por IP directa.

## Datos del servidor
- Nombre de servidor: `SERVER NOT WEKITO`
- Puerto: `16261` (UDP)
- Config: `Public=false`, `SteamVAC=false`, `Password=` (sin contraseña de servidor)
- Ubicación: `C:\PZServer`
- Script de inicio: `C:\PZServer\StartServer64_nosteam.bat`
  - RAM: `-Xms4g -Xmx4g`
  - `-Dzomboid.steam=0`
  - `-servername "SERVER NOT WEKITO"`
- Archivos de perfil: `C:\Users\rolta\Zomboid\Server\SERVER NOT WEKITO.ini`
- Mundo: `C:\Users\rolta\Zomboid\Saves\Multiplayer\SERVER NOT WEKITO\`

## Conexión
- IP LAN (misma red): `192.168.1.92`
- IP Radmin VPN: `26.179.172.238` (amigos por Internet se conectan a esta)
- Puerto: `16261`
- Clientes Steam deben lanzar con `-nosteam`
- Clientes GOG/no-Steam: directo por Favorites/IP

## Notas operativas
- Reiniciar con doble clic en `StartServer64_nosteam.bat`.
- Si se edita `SERVER NOT WEKITO.ini` con el servidor corriendo, usar `reloadoptions` en la consola; los cambios se revierten al cerrar si no se editan antes de arrancar.
- Actualizar servidor: `C:\SteamCMD\steamcmd.exe +force_install_dir C:\PZServer +login anonymous +app_update 380870 validate +quit`
- Hacer backup del mundo (`Zomboid\Saves\Multiplayer\SERVER NOT WEKITO\`) e `.ini` antes de cambios.
- Admin password configurada manualmente en el primer arranque (no guardada en este archivo).

## Licencia
Servidor libre solo para copias legítimas (Steam/GOG). No se facilitan versiones piratas.
