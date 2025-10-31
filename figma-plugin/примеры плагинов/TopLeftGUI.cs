using Oxide.Core;
using Oxide.Game.Rust.Cui;
using System.Collections.Generic;
using System;
using System.Linq;
using UnityEngine;
using Newtonsoft.Json;
using Rust;

namespace Oxide.Plugins
{
    [Info("TopLeftGUI", "YourName", "1.0.0")]
    class TopLeftGUI : RustPlugin
    {
        private const string Layer = "ui.topleftgui";
        private const string ORANGE_COLOR = "0.9490196 0.5019608 0.05490196 0.9";
        private const string RED_COLOR = "0.8 0.2 0.2 0.9";
        private const string GREEN_COLOR = "0.2 0.8 0.3 0.9";
        private const string BLUE_COLOR = "0.2 0.5 0.9 0.9";
        private const string EFFECT_ERROR = "assets/prefabs/weapons/toolgun/effects/repairerror.prefab";
        private const string EFFECT_STAGE_CHANGE = "assets/prefabs/misc/xmas/advent_calendar/effects/open_advent.prefab";
        
        private enum Stage { Preparation, Building, Helicopter, Raid, Finished }
        
        private readonly HashSet<ulong> _activeUsers = new HashSet<ulong>();
        private readonly List<BuildingPrivlidge> _cupboards = new List<BuildingPrivlidge>();
        private readonly Dictionary<BuildingPrivlidge, BaseEntity> _cupboardSpheres = new Dictionary<BuildingPrivlidge, BaseEntity>();
        private readonly Dictionary<ulong, float> _lastWarning = new Dictionary<ulong, float>();
        private readonly HashSet<ulong> _prepPlayersInZone = new HashSet<ulong>();
        private bool _prepZoneActive;
        private BaseEntity _prepSphere;
        private Timer _globalTimer;
        private ConfigData cfg;
        private GlobalTimerData _timerData;
        private DateTime _wipeTime;

        void Init()
        {
            _wipeTime = SaveRestore.SaveCreatedTime;
            _timerData = Interface.Oxide.DataFileSystem.ReadObject<GlobalTimerData>("TopLeftGUI_Timer");
            
            var timeSinceWipe = (DateTime.UtcNow - _wipeTime).TotalSeconds;
            
            if (_timerData == null || _timerData.CurrentStage == Stage.Finished || _timerData.WipeTime < _wipeTime)
            {
                _timerData = new GlobalTimerData
                {
                    WipeTime = _wipeTime
                };

                // Начальная стадия: до 5 минут от вайпа (оставшееся время из окна подготовки)
                var prepWindow = (cfg != null && cfg.PreparationTime > 0) ? cfg.PreparationTime : 300;
                var remainingPrep = Mathf.Max(0, prepWindow - Mathf.CeilToInt((float)timeSinceWipe));

                if (remainingPrep > 0)
                {
                    _timerData.CurrentStage = Stage.Preparation;
                    _timerData.RemainingSeconds = remainingPrep;
                }
                else
                {
                    _timerData.CurrentStage = Stage.Building;
                    _timerData.RemainingSeconds = cfg.BuildingTime;
                }
                
                SaveTimerData();
            }
        }

        void OnServerInitialized()
        {
            _globalTimer = timer.Every(1f, GlobalTimerTick);
            
            foreach (var player in BasePlayer.activePlayerList)
            {
                UpdateSafeZone(player);
                _activeUsers.Add(player.userID);
                DrawUI(player);
            }
            // Повторная отрисовка на следующий тик для надежности (иногда Hud еще не готов)
            NextTick(() =>
            {
                foreach (var p in BasePlayer.activePlayerList)
                {
                    if (_activeUsers.Contains(p.userID))
                        DrawUI(p);
                }
            });
            
            if (_timerData.CurrentStage == Stage.Preparation)
            {
                ActivatePreparationZone();
                foreach (var p in BasePlayer.activePlayerList)
                {
                    TeleportToPreparationSpawn(p);
                }
            }

            if (_timerData.CurrentStage == Stage.Building)
                FindAllCupboards();
        }

        void OnPlayerConnected(BasePlayer player)
        {
            if (player != null)
            {
                NextTick(() =>
                {
                    if (player != null && player.IsConnected)
                    {
                        UpdateSafeZone(player);
                        _activeUsers.Add(player.userID);
                        DrawUI(player);
                        ShowCurrentStageNotification(player);
                        if (_timerData.CurrentStage == Stage.Preparation)
                        {
                            TeleportToPreparationSpawn(player);
                        }
                    }
                });
            }
        }

        void OnPlayerDisconnected(BasePlayer player)
        {
            if (player != null)
            {
                _activeUsers.Remove(player.userID);
                _lastWarning.Remove(player.userID);
                CuiHelper.DestroyUi(player, Layer);
            }
        }

        void OnPlayerInput(BasePlayer player, InputState input)
        {
            if (player != null && player.IsConnected)
            {
                UpdateSafeZone(player);
                
                if (_timerData.CurrentStage == Stage.Building)
                    CheckCupboardZones(player);

                if (_timerData.CurrentStage == Stage.Preparation && _prepZoneActive)
                    CheckPreparationZoneBounds(player);
            }
        }

        void OnPlayerRespawned(BasePlayer player)
        {
            if (player == null) return;
            if (_timerData.CurrentStage == Stage.Preparation)
            {
                NextTick(() =>
                {
                    TeleportToPreparationSpawn(player);
                    if (_activeUsers.Contains(player.userID))
                        DrawUI(player);
                });
            }
        }

        void OnEntityBuilt(Planner plan, GameObject go)
        {
            // Во время ожидания запрещаем любое строительство в зоне ожидания (фоллбэк)
            if (_timerData.CurrentStage == Stage.Preparation && _prepZoneActive)
            {
                var owner = plan?.GetOwnerPlayer();
                if (owner != null)
                {
                    var pos = owner.transform.position;
                    var distance = new Vector3(pos.x, 0f, pos.z).magnitude;
                    var radius = (cfg != null && cfg.PreparationZoneRadius > 0f) ? cfg.PreparationZoneRadius : 20f;
                    if (distance <= radius)
                    {
                        var ent = go.ToBaseEntity();
                        if (ent != null && !ent.IsDestroyed)
                        {
                            NextTick(() =>
                            {
                                if (ent != null && !ent.IsDestroyed) ent.Kill();
                            });
                        }
                        owner.ShowToast(GameTip.Styles.Error, "Строительство запрещено в зоне ожидания!", false, System.Array.Empty<string>());
                        return;
                    }
                }
            }

            if (_timerData.CurrentStage != Stage.Building)
            {
                Puts($"[OnEntityBuilt] Пропущено: текущая стадия {_timerData.CurrentStage}, не Building");
                return;
            }
            
            var entity = go.ToBaseEntity();
            if (entity != null && entity is BuildingPrivlidge)
            {
                var cupboard = entity as BuildingPrivlidge;
                if (cupboard != null && !_cupboards.Contains(cupboard))
                {
                    Puts($"[OnEntityBuilt] Шкаф найден! Позиция: {cupboard.transform.position}, ID: {cupboard.net.ID}");
                    _cupboards.Add(cupboard);
                    NextTick(() => CreateCupboardSphere(cupboard));
                }
                else if (cupboard != null)
                {
                    Puts($"[OnEntityBuilt] Шкаф уже в списке: {cupboard.net.ID}");
                }
            }
            else
            {
                Puts($"[OnEntityBuilt] Не шкаф: {entity?.ShortPrefabName ?? "null"}");
            }
        }

        void OnEntityKill(BuildingPrivlidge cupboard)
        {
            if (cupboard != null && _cupboards.Contains(cupboard))
            {
                _cupboards.Remove(cupboard);
                RemoveCupboardSphere(cupboard);
            }
        }

        object OnEntityTakeDamage(BaseCombatEntity entity, HitInfo info)
        {
            if (_timerData.CurrentStage == Stage.Preparation || _timerData.CurrentStage == Stage.Building)
            {
                var player = entity as BasePlayer;
                if (player != null)
                {
                    info.damageTypes.ScaleAll(0f);
                    return true;
                }
            }
            
            return null;
        }

        [ChatCommand("tlgui")]
        private void cmdToggle(BasePlayer player) => player.SendConsoleCommand($"tlgui.toggle");

        [ConsoleCommand("tlgui.toggle")]
        private void cmdToggleConsole(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            
            if (_activeUsers.Contains(player.userID))
            {
                CuiHelper.DestroyUi(player, Layer);
                _activeUsers.Remove(player.userID);
            }
            else
            {
                _activeUsers.Add(player.userID);
                DrawUI(player);
            }
        }

        [ConsoleCommand("tlgui.reset")]
        private void cmdReset(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null || !player.IsAdmin) return;
            
            _timerData = new GlobalTimerData
            {
                CurrentStage = Stage.Preparation,
                RemainingSeconds = 300,
                WipeTime = _wipeTime
            };
            SaveTimerData();
            
            ClearAllSpheres();
            _cupboards.Clear();
            
            foreach (var p in BasePlayer.activePlayerList)
            {
                UpdateSafeZone(p);
                if (_activeUsers.Contains(p.userID))
                    DrawUI(p);
            }
        }

        private void GlobalTimerTick()
        {
            if (_timerData.CurrentStage == Stage.Finished)
                return;
            
            foreach (var player in BasePlayer.activePlayerList)
                if (_activeUsers.Contains(player.userID))
                    DrawUI(player);
            
            if (_timerData.RemainingSeconds > 0)
            {
                _timerData.RemainingSeconds--;
                
                if (_timerData.RemainingSeconds % 10 == 0)
                    SaveTimerData();
            }
            else
            {
                var previousStage = _timerData.CurrentStage;
                
                if (_timerData.CurrentStage == Stage.Preparation)
                {
                    _timerData.CurrentStage = Stage.Building;
                    _timerData.RemainingSeconds = cfg.BuildingTime;
                    FindAllCupboards();
                    DeactivatePreparationZone();
                }
                else if (_timerData.CurrentStage == Stage.Building)
                {
                    _timerData.CurrentStage = Stage.Helicopter;
                    _timerData.RemainingSeconds = cfg.HeliTime;
                    ClearAllSpheres();
                    _cupboards.Clear();
                    
                    // Спавн вертолета
                    Puts("[TopLeftGUI] Спавн вертолета: spawn heli.call");
                    Server.Command("spawn heli.call");
                }
                else if (_timerData.CurrentStage == Stage.Helicopter)
                {
                    _timerData.CurrentStage = Stage.Raid;
                    _timerData.RemainingSeconds = cfg.RaidTime;
                }
                else
                {
                    _timerData.CurrentStage = Stage.Finished;
                }
                
                SaveTimerData();
                
                foreach (var player in BasePlayer.activePlayerList)
                {
                    UpdateSafeZone(player);
                    ShowStageChangeNotification(player);
                    if (_activeUsers.Contains(player.userID))
                        DrawUI(player);
                }
            }
        }

        private void CreateCupboardSphere(BuildingPrivlidge cupboard)
        {
            if (cupboard == null || cupboard.IsDestroyed)
            {
                Puts($"[CreateCupboardSphere] Шкаф null или уничтожен!");
                return;
            }
            
            // Безопасная подстановка значения радиуса, если в конфиге отсутствует ключ
            var safeRadius = (cfg != null && cfg.CupboardZoneRadius > 0f) ? cfg.CupboardZoneRadius : 50f;
            if (cfg != null && cfg.CupboardZoneRadius <= 0f)
            {
                Puts("[CreateCupboardSphere] Обнаружен нулевой радиус в конфиге, использую значение по умолчанию 50м.");
            }

            Puts($"[CreateCupboardSphere] Создаю сферу для шкафа в позиции: {cupboard.transform.position}, радиус: {safeRadius}");
            
            var sphere = GameManager.server.CreateEntity("assets/bundled/prefabs/modding/events/twitch/br_sphere_green.prefab", cupboard.transform.position) as SphereEntity;
            
            if (sphere == null)
            {
                PrintError($"[CreateCupboardSphere] ОШИБКА: не удалось создать SphereEntity!");
                return;
            }
            
            Puts($"[CreateCupboardSphere] SphereEntity создан: {sphere.ShortPrefabName}");
            
            // Настройка параметров ПЕРЕД спавном, как в RaidBlock
            sphere.currentRadius = safeRadius * 2f;
            sphere.lerpSpeed = 0f;
            sphere.enableSaving = false;
            
            Puts($"[CreateCupboardSphere] Параметры: currentRadius={cfg.CupboardZoneRadius * 2f}, lerpSpeed=0, enableSaving=false");
            
            sphere.Spawn();
            Puts($"[CreateCupboardSphere] Сфера заспавнена! ID: {sphere.net.ID}");
            
            _cupboardSpheres[cupboard] = sphere;
            Puts($"[CreateCupboardSphere] Сфера добавлена в словарь. Всего сфер: {_cupboardSpheres.Count}");
        }

        private void RemoveCupboardSphere(BuildingPrivlidge cupboard)
        {
            if (_cupboardSpheres.TryGetValue(cupboard, out var sphere))
            {
                if (sphere != null && !sphere.IsDestroyed)
                    sphere.Kill();
                _cupboardSpheres.Remove(cupboard);
            }
        }

        private void ClearAllSpheres()
        {
            foreach (var sphere in _cupboardSpheres.Values.ToList())
            {
                if (sphere != null && !sphere.IsDestroyed)
                    sphere.Kill();
            }
            _cupboardSpheres.Clear();
        }

        private void ShowStageChangeNotification(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            
            string stageName = GetStageName(_timerData.CurrentStage);
            GameTip.Styles style = GetStageStyle(_timerData.CurrentStage);
            
            string message;
            if (_timerData.CurrentStage == Stage.Helicopter)
            {
                message = "Вылетел боевой вертолет! Кто собьет - получит приз!";
            }
            else
            {
                message = $"Новая стадия: {stageName}";
            }
            
            player.ShowToast(style, message, false, System.Array.Empty<string>());
            
            Effect effect = new Effect(EFFECT_STAGE_CHANGE, player, 0, Vector3.zero, Vector3.forward);
            EffectNetwork.Send(effect, player.Connection);
        }

        private void ShowCurrentStageNotification(BasePlayer player)
        {
            if (player == null || !player.IsConnected || _timerData.CurrentStage == Stage.Finished) return;
            
            string stageName = GetStageName(_timerData.CurrentStage);
            GameTip.Styles style = GetStageStyle(_timerData.CurrentStage);
            
            player.ShowToast(style, $"Текущая стадия: {stageName}", false, System.Array.Empty<string>());
        }

        private string GetStageName(Stage stage)
        {
            switch (stage)
            {
                case Stage.Preparation:
                    return cfg.PreparationText;
                case Stage.Building:
                    return cfg.BuildingText;
                case Stage.Helicopter:
                    return cfg.HeliText;
                case Stage.Raid:
                    return cfg.RaidText;
                default:
                    return "FINISHED";
            }
        }

        private GameTip.Styles GetStageStyle(Stage stage)
        {
            switch (stage)
            {
                case Stage.Preparation:
                    return GameTip.Styles.Blue_Long;
                case Stage.Building:
                    return GameTip.Styles.Error;
                case Stage.Helicopter:
                    return GameTip.Styles.Blue_Long;
                case Stage.Raid:
                    return GameTip.Styles.Red_Normal;
                default:
                    return GameTip.Styles.Server_Event;
            }
        }   

        private void FindAllCupboards()
        {
            _cupboards.Clear();
            int foundCount = 0;
            foreach (var entity in BaseNetworkable.serverEntities)
            {
                var cupboard = entity as BuildingPrivlidge;
                if (cupboard != null && !cupboard.IsDestroyed)
                {
                    _cupboards.Add(cupboard);
                    foundCount++;
                    CreateCupboardSphere(cupboard);
                }
            }
            Puts($"[FindAllCupboards] Найдено и обработано шкафов: {foundCount}");
        }

        private void CheckCupboardZones(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            
            foreach (var cupboard in _cupboards.ToList())
            {
                if (cupboard == null || cupboard.IsDestroyed)
                {
                    _cupboards.Remove(cupboard);
                    RemoveCupboardSphere(cupboard);
                    continue;
                }
                
                var distance = Vector3.Distance(player.transform.position, cupboard.transform.position);
                
                if (distance <= cfg.CupboardZoneRadius)
                {
                    bool isAuthorized = cupboard.IsAuthed(player);
                    
                    if (!isAuthorized)
                    {
                        TeleportOutOfZone(player, cupboard.transform.position);
                        return;
                    }
                }
            }
            
            var authorizedCupboard = FindAuthorizedCupboard(player);
            if (authorizedCupboard != null)
            {
                var distance = Vector3.Distance(player.transform.position, authorizedCupboard.transform.position);
                
                if (distance > cfg.CupboardZoneRadius)
                {
                    TeleportToZone(player, authorizedCupboard.transform.position);
                }
            }
        }

        private BuildingPrivlidge FindAuthorizedCupboard(BasePlayer player)
        {
            foreach (var cupboard in _cupboards)
            {
                if (cupboard != null && !cupboard.IsDestroyed && cupboard.IsAuthed(player))
                    return cupboard;
            }
            return null;
        }

        private void TeleportOutOfZone(BasePlayer player, Vector3 cupboardPos)
        {
            var direction = (player.transform.position - cupboardPos).normalized;
            var targetPos = cupboardPos + direction * (cfg.CupboardZoneRadius + 2f);
            
            RaycastHit hitInfo;
            if (Physics.Raycast(targetPos + Vector3.up * 300f, Vector3.down, out hitInfo, 400f, LayerMask.GetMask("Terrain", "World", "Construction")))
            {
                targetPos.y = hitInfo.point.y + 0.1f;
                
                player.PauseFlyHackDetection(5f);
                player.PauseSpeedHackDetection(5f);
                player.Teleport(targetPos);
                player.SendNetworkUpdateImmediate();
                
                var currentTime = Time.time;
                if (!_lastWarning.TryGetValue(player.userID, out var lastWarning) || currentTime - lastWarning >= 3f)
                {
                    player.ShowToast(GameTip.Styles.Red_Normal, "Вы не авторизованы в этом шкафу!", false, System.Array.Empty<string>());
                    Effect effect = new Effect(EFFECT_ERROR, player, 0, Vector3.zero, Vector3.zero);
                    EffectNetwork.Send(effect, player.Connection);
                    _lastWarning[player.userID] = currentTime;
                }
            }
        }

        private void TeleportToZone(BasePlayer player, Vector3 cupboardPos)
        {
            var direction = (player.transform.position - cupboardPos).normalized;
            var targetPos = cupboardPos + direction * (cfg.CupboardZoneRadius - 2f);
            
            RaycastHit hitInfo;
            if (Physics.Raycast(targetPos + Vector3.up * 300f, Vector3.down, out hitInfo, 400f, LayerMask.GetMask("Terrain", "World", "Construction")))
            {
                targetPos.y = hitInfo.point.y + 0.1f;
                
                player.PauseFlyHackDetection(5f);
                player.PauseSpeedHackDetection(5f);
                player.Teleport(targetPos);
                player.SendNetworkUpdateImmediate();
                
                var currentTime = Time.time;
                if (!_lastWarning.TryGetValue(player.userID, out var lastWarning) || currentTime - lastWarning >= 3f)
                {
                    player.ShowToast(GameTip.Styles.Red_Normal, "Вы не можете покинуть зону вашего шкафа!", false, System.Array.Empty<string>());
                    Effect effect = new Effect(EFFECT_ERROR, player, 0, Vector3.zero, Vector3.zero);
                    EffectNetwork.Send(effect, player.Connection);
                    _lastWarning[player.userID] = currentTime;
                }
            }
        }

        private void UpdateSafeZone(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            
            if (_timerData.CurrentStage == Stage.Preparation || _timerData.CurrentStage == Stage.Building)
            {
                if (!player.HasPlayerFlag(BasePlayer.PlayerFlags.SafeZone))
                    player.SetPlayerFlag(BasePlayer.PlayerFlags.SafeZone, true);
            }
            else
            {
                if (player.HasPlayerFlag(BasePlayer.PlayerFlags.SafeZone))
                    player.SetPlayerFlag(BasePlayer.PlayerFlags.SafeZone, false);
            }
        }

        private void ActivatePreparationZone()
        {
            if (_prepZoneActive) return;
            _prepZoneActive = true;

            // Create visual dome at map center
            var center = GetGroundPosition(Vector3.zero);
            var sphere = GameManager.server.CreateEntity("assets/bundled/prefabs/modding/events/twitch/br_sphere_green.prefab", center) as SphereEntity;
            if (sphere != null)
            {
                var radius = (cfg != null && cfg.PreparationZoneRadius > 0f) ? cfg.PreparationZoneRadius : 20f;
                sphere.currentRadius = radius * 2f;
                sphere.lerpSpeed = 0f;
                sphere.enableSaving = false;
                sphere.Spawn();
                _prepSphere = sphere;
            }
        }

        private void DeactivatePreparationZone()
        {
            _prepZoneActive = false;
            _prepPlayersInZone.Clear();
            if (_prepSphere != null && !_prepSphere.IsDestroyed)
            {
                _prepSphere.Kill();
                _prepSphere = null;
            }
        }

        private void CheckPreparationZoneBounds(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;

            var playerPos = player.transform.position;
            var horizontalPos = new Vector3(playerPos.x, 0f, playerPos.z);
            var distance = horizontalPos.magnitude;
            var radius = (cfg != null && cfg.PreparationZoneRadius > 0f) ? cfg.PreparationZoneRadius : 20f;

            if (distance <= radius)
            {
                if (!_prepPlayersInZone.Contains(player.userID))
                    _prepPlayersInZone.Add(player.userID);
                return;
            }

            var directionToCenter = (-horizontalPos).normalized;
            var newPos = directionToCenter * (radius - 0.5f);

            RaycastHit hitInfo;
            if (Physics.Raycast(newPos + Vector3.up * 300f, Vector3.down, out hitInfo, 400f, LayerMask.GetMask("Terrain", "World", "Construction")))
            {
                newPos.y = hitInfo.point.y + 0.1f;
                var mountedVehicle = player.GetMountedVehicle();
                if (mountedVehicle != null)
                {
                    if (IsCopter(mountedVehicle))
                    {
                        player.ShowToast(GameTip.Styles.Error, "Покидать зону ожидания на вертолёте запрещено!", false, System.Array.Empty<string>());
                        var killTarget = mountedVehicle;
                        NextTick(() =>
                        {
                            if (killTarget != null && !killTarget.IsDestroyed)
                                killTarget.Kill();
                            player.PauseFlyHackDetection(5f);
                            player.PauseSpeedHackDetection(5f);
                            player.Teleport(newPos);
                            player.SendNetworkUpdateImmediate();
                        });
                    }
                    else
                    {
                        var rb = mountedVehicle.GetComponent<Rigidbody>();
                        if (rb != null)
                        {
                            rb.velocity = Vector3.zero;
                            rb.angularVelocity = Vector3.zero;
                            rb.MovePosition(newPos);
                        }
                        else
                        {
                            mountedVehicle.transform.position = newPos;
                        }
                        mountedVehicle.SendNetworkUpdateImmediate();
                    }
                }
                else
                {
                    player.PauseFlyHackDetection(5f);
                    player.PauseSpeedHackDetection(5f);
                    player.Teleport(newPos);
                    player.SendNetworkUpdateImmediate();
                }

                var currentTime = Time.time;
                if (!_lastWarning.TryGetValue(player.userID, out var lastWarning) || currentTime - lastWarning >= 3f)
                {
                    player.ShowToast(GameTip.Styles.Error, "Вы не можете покинуть зону ожидания!", false, System.Array.Empty<string>());
                    Effect effect = new Effect(EFFECT_ERROR, player, 0, Vector3.zero, Vector3.zero);
                    EffectNetwork.Send(effect, player.Connection);
                    _lastWarning[player.userID] = currentTime;
                }
            }
        }

        private bool IsCopter(BaseEntity entity)
        {
            if (entity == null) return false;
            var name = entity.ShortPrefabName ?? string.Empty;
            // minicopter and scrap transport helicopters
            return name.IndexOf("minicopter", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("scraptransport", StringComparison.OrdinalIgnoreCase) >= 0
                || name.IndexOf("scraptransporthelicopter", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        object CanBuild(Planner planner, Construction prefab, Construction.Target target)
        {
            if (!_prepZoneActive) return null;
            var player = planner?.GetOwnerPlayer();
            if (player == null) return null;

            var pos = player.transform.position;
            var distance = new Vector3(pos.x, 0f, pos.z).magnitude;
            var radius = (cfg != null && cfg.PreparationZoneRadius > 0f) ? cfg.PreparationZoneRadius : 20f;
            if (distance <= radius)
            {
                player.ShowToast(GameTip.Styles.Error, "Строительство запрещено в зоне ожидания!", false, System.Array.Empty<string>());
                return false;
            }
            return null;
        }

        private void TeleportToPreparationSpawn(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            var radius = (cfg != null && cfg.PreparationZoneRadius > 0f) ? cfg.PreparationZoneRadius : 20f;

            var angle = UnityEngine.Random.Range(0f, 360f) * Mathf.Deg2Rad;
            var distance = UnityEngine.Random.Range(1f, Mathf.Max(1f, radius - 1f));
            var pos = new Vector3(Mathf.Cos(angle) * distance, 0f, Mathf.Sin(angle) * distance);

            RaycastHit hitInfo;
            if (!Physics.Raycast(pos + Vector3.up * 300f, Vector3.down, out hitInfo, 400f, LayerMask.GetMask("Terrain", "World", "Construction")))
            {
                // fallback to center ground
                pos = GetGroundPosition(Vector3.zero);
            }
            else
            {
                pos.y = hitInfo.point.y + 0.1f;
            }

            player.PauseFlyHackDetection(5f);
            player.PauseSpeedHackDetection(5f);
            player.Teleport(pos);
            player.SendNetworkUpdateImmediate();
        }

        private Vector3 GetGroundPosition(Vector3 pos)
        {
            RaycastHit hitInfo;
            if (Physics.Raycast(pos + Vector3.up * 300f, Vector3.down, out hitInfo, 400f, LayerMask.GetMask("Terrain", "World", "Construction")))
            {
                pos.y = hitInfo.point.y + 0.1f;
            }
            return pos;
        }

        private void DrawUI(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            
            if (_timerData.CurrentStage == Stage.Finished)
            {
                CuiHelper.DestroyUi(player, Layer);
                return;
            }
            
            int seconds = _timerData.RemainingSeconds;
            string timeText = $"{seconds / 60}M {seconds % 60}S";
            string mainText, barColor, timerOffsetMin, timerOffsetMax;
            
            if (_timerData.CurrentStage == Stage.Preparation)
            {
                mainText = cfg.PreparationText;
                barColor = GREEN_COLOR;
                timerOffsetMin = "125 -28";
                timerOffsetMax = "230 -8";
            }
            else if (_timerData.CurrentStage == Stage.Building)
            {
                mainText = cfg.BuildingText;
                barColor = ORANGE_COLOR;
                timerOffsetMin = "105 -28";
                timerOffsetMax = "210 -8";
            }
            else if (_timerData.CurrentStage == Stage.Helicopter)
            {
                mainText = cfg.HeliText;
                barColor = BLUE_COLOR;
                timerOffsetMin = "135 -28";
                timerOffsetMax = "240 -8";
            }
            else
            {
                mainText = cfg.RaidText;
                barColor = RED_COLOR;
                timerOffsetMin = "60 -28";
                timerOffsetMax = "165 -8";
            }

            var container = new CuiElementContainer
            {
                {
                    new CuiPanel
                    {
                        Image = { Color = barColor, Sprite = "assets/content/ui/ui.background.transparent.linearltr.tga" },
                        RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = "0 -47", OffsetMax = "360 0" }
                    },
                    "Hud", Layer
                },
                {
                    new CuiLabel
                    {
                        Text = { Text = mainText, Font = "robotocondensed-bold.ttf", FontSize = 16, Align = TextAnchor.UpperLeft, Color = "1 1 1 1" },
                        RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = "10 -28", OffsetMax = "180 -8" }
                    },
                    Layer
                },
                {
                    new CuiLabel
                    {
                        Text = { Text = timeText, Font = "robotocondensed-bold.ttf", FontSize = 16, Align = TextAnchor.UpperLeft, Color = "0.85 0.85 0.85 1" },
                        RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = timerOffsetMin, OffsetMax = timerOffsetMax }
                    },
                    Layer
                },
                {
                    new CuiLabel
                    {
                        Text = { Text = cfg.DiscordLink, Font = "robotocondensed-bold.ttf", FontSize = 12, Align = TextAnchor.LowerLeft, Color = "1 1 1 0.8" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0", OffsetMin = "10 5", OffsetMax = "-10 20" }
                    },
                    Layer
                }
            };
            
            CuiHelper.DestroyUi(player, Layer);
            CuiHelper.AddUi(player, container);
        }

        void Unload() 
        { 
            foreach (var player in BasePlayer.activePlayerList)
            {
                CuiHelper.DestroyUi(player, Layer);
                if (player.HasPlayerFlag(BasePlayer.PlayerFlags.SafeZone))
                    player.SetPlayerFlag(BasePlayer.PlayerFlags.SafeZone, false);
            }
            
            _globalTimer?.Destroy();
            ClearAllSpheres();
            _cupboards.Clear();
            _lastWarning.Clear();
            SaveTimerData();
        }

        private void SaveTimerData()
        {
            Interface.Oxide.DataFileSystem.WriteObject("TopLeftGUI_Timer", _timerData);
        }

        #region Config
        
        private class ConfigData
        {
            [JsonProperty("Время подготовки (секунды)")]
            public int PreparationTime { get; set; }
            
            [JsonProperty("Время билдинга (секунды)")]
            public int BuildingTime { get; set; }
            
            [JsonProperty("Время вертолёта (секунды)")]
            public int HeliTime { get; set; }
            
            [JsonProperty("Время рейда (секунды)")]
            public int RaidTime { get; set; }
            
            [JsonProperty("Радиус зоны шкафа (метры)")]
            public float CupboardZoneRadius { get; set; }
            
            [JsonProperty("Текст подготовки")]
            public string PreparationText { get; set; }
            
            [JsonProperty("Текст билдинга")]
            public string BuildingText { get; set; }
            
            [JsonProperty("Текст вертолёта")]
            public string HeliText { get; set; }
            
            [JsonProperty("Текст рейда")]
            public string RaidText { get; set; }
            
            [JsonProperty("Discord ссылка")]
            public string DiscordLink { get; set; }

            [JsonProperty("Радиус зоны ожидания (метры)")]
            public float PreparationZoneRadius { get; set; }
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            cfg = Config.ReadObject<ConfigData>();

            var changed = false;

            if (cfg == null)
            {
                LoadDefaultConfig();
                changed = true;
            }

            // Гарантия значений по умолчанию для отсутствующих/некорректных полей
            if (cfg.CupboardZoneRadius <= 0f)
            {
                cfg.CupboardZoneRadius = 50f;
                changed = true;
            }

            if (cfg.PreparationZoneRadius <= 0f)
            {
                cfg.PreparationZoneRadius = 20f;
                changed = true;
            }

            if (cfg.PreparationTime <= 0)
            {
                cfg.PreparationTime = 300;
                changed = true;
            }
            if (cfg.BuildingTime <= 0)
            {
                cfg.BuildingTime = 10;
                changed = true;
            }
            if (cfg.HeliTime <= 0)
            {
                cfg.HeliTime = 5;
                changed = true;
            }
            if (cfg.RaidTime <= 0)
            {
                cfg.RaidTime = 4;
                changed = true;
            }
            if (string.IsNullOrEmpty(cfg.PreparationText))
            {
                cfg.PreparationText = "P R E P A R A T I O N";
                changed = true;
            }
            if (string.IsNullOrEmpty(cfg.BuildingText))
            {
                cfg.BuildingText = "B U I L D I N G";
                changed = true;
            }
            if (string.IsNullOrEmpty(cfg.HeliText))
            {
                cfg.HeliText = "H E L I C O P T E R";
                changed = true;
            }
            if (string.IsNullOrEmpty(cfg.RaidText))
            {
                cfg.RaidText = "R A I D";
                changed = true;
            }
            if (string.IsNullOrEmpty(cfg.DiscordLink))
            {
                cfg.DiscordLink = "https://discord.gg/ZAMZp7TdtP";
                changed = true;
            }

            if (changed)
            {
                Config.WriteObject(cfg, true);
            }
        }

        protected override void LoadDefaultConfig()
        {
            cfg = new ConfigData
            {
                PreparationTime = 300,
                BuildingTime = 10,
                HeliTime = 5,
                RaidTime = 4,
                CupboardZoneRadius = 50f,
                PreparationZoneRadius = 20f,
                PreparationText = "P R E P A R A T I O N",
                BuildingText = "B U I L D I N G",
                HeliText = "H E L I C O P T E R",
                RaidText = "R A I D",
                DiscordLink = "https://discord.gg/ZAMZp7TdtP"
            };
            // Сохранить конфиг по умолчанию для автогенерации отсутствующих ключей
            SaveConfig();
        }

        #endregion

        #region Data

        private class GlobalTimerData
        {
            public Stage CurrentStage { get; set; }
            public int RemainingSeconds { get; set; }
            public DateTime WipeTime { get; set; }
        }

        #endregion
    }
}
