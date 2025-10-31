using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries.Covalence;
using Oxide.Core.Plugins;
using Oxide.Game.Rust.Cui;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("TournamentFClan", "King", "1.0.0")]
    class TournamentFClan : RustPlugin
    {
        [PluginReference] private Plugin FClan = null;

        private const String Layer = "TournamentFClan.Layer";
        public HashSet<String> _playerWhiteList = new();

        // Local sound effect for notifications (same as Kits.cs)
        private const string effectSoundAccess = "assets/bundled/prefabs/fx/notice/item.select.fx.prefab";

        // Discord Webhook Configuration
        private string DiscordWebhookUrl => _config?.DiscordWebhookUrl ?? "https://discord.com/api/webhooks/1426130654810083412/K2_2gVE0FUjr_B7H7XG3nC-xNd2q5jokwc0NYIBxH9qlJ7WppVlVIZqpWtgRY89hluVR";

        private Dictionary<UInt64, ClanData> _clanByCupboard = new Dictionary<UInt64, ClanData>();
        private Dictionary<String, ClanData> _clanByClanTag = new Dictionary<String, ClanData>(StringComparer.OrdinalIgnoreCase);

        private const String VENDING_MAP_MARKER_PREFAB = "assets/prefabs/deployable/vendingmachine/vending_mapmarker.prefab";
        private const String GENERIC_MAP_MARKER_PREFAB = "assets/prefabs/tools/map/genericradiusmarker.prefab";
        private DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0);

        private Double CurrentTime => DateTime.UtcNow.Subtract(Epoch).TotalSeconds;
        private Double LastWipe;
        private Timer _timer;

        private List<ClanData> _clansList = new List<ClanData>();

        private void LoadClans()
        {
            try
            {
                _clansList = Interface.Oxide.DataFileSystem.ReadObject<List<ClanData>>($"{Name}");
            }
            catch (Exception e)
            {
                PrintError(e.ToString());
            }

            if (_clansList == null) _clansList = new List<ClanData>();
        }

        private void SaveClans() => Interface.Oxide.DataFileSystem.WriteObject($"{Name}", _clansList);

        private class ClanData
        {
            public String ClanTag;
            public String ClanGrid;
            public UInt64 netID;
            public Int32 Point;
            public Int32 raidPoint;
            public Int32 warnCount;
            public Vector3 position;

            [JsonIgnore]
            public MapMarkerGenericRadius mapMarkerGenericRadius;

            [JsonIgnore]
            public VendingMachineMapMarker vendingMachineMapMarker;

            public void CreateMarker()
            {
                vendingMachineMapMarker = GameManager.server.CreateEntity(VENDING_MAP_MARKER_PREFAB, position) as VendingMachineMapMarker;
                vendingMachineMapMarker.enableSaving = false;
                vendingMachineMapMarker.markerShopName = ClanTag;
                vendingMachineMapMarker.Spawn();

                if (!ColorUtility.TryParseHtmlString($"#{_config.mapMarkerSettings.MarkerColorHex}", out Color color1) || !ColorUtility.TryParseHtmlString($"#{_config.mapMarkerSettings.OutlineColorHex}", out Color color2)) return;

                mapMarkerGenericRadius = GameManager.server.CreateEntity(GENERIC_MAP_MARKER_PREFAB) as MapMarkerGenericRadius;
                if (mapMarkerGenericRadius == null) return;
                mapMarkerGenericRadius.color1 = color1;
                mapMarkerGenericRadius.color2 = color2;

                mapMarkerGenericRadius.radius = 0.8f;
                mapMarkerGenericRadius.alpha = _config.mapMarkerSettings.MarkerAlpha;
                mapMarkerGenericRadius.enableSaving = false;

                mapMarkerGenericRadius.SetParent(vendingMachineMapMarker);
                mapMarkerGenericRadius.Spawn();
                mapMarkerGenericRadius.SendUpdate();
            }

            public void RemoveMarker()
            {
                if (mapMarkerGenericRadius.IsValid()) mapMarkerGenericRadius.Kill();

                if (vendingMachineMapMarker.IsValid()) vendingMachineMapMarker.Kill();
            }

            public void UpdateMarker()
            {
                if (mapMarkerGenericRadius.IsValid()) mapMarkerGenericRadius.SendUpdate();
            }
        }

        private void OnNewSave(String filename)
        {
            try
            {
                if (_clansList == null || _clansList.Count == 0)
                    LoadClans();

                _clansList.Clear();
                SaveClans();
            }
            catch (Exception e)
            {
                PrintError($"[OnNewSave] : {e.Message}");
            }
        }

        private void ServerOpened() => LastWipe = SaveRestore.SaveCreatedTime.Subtract(Epoch).TotalSeconds;

        private void Init() => LoadClans();

        private void OnServerInitialized()
        {
            LastWipe = SaveRestore.SaveCreatedTime.Subtract(Epoch).TotalSeconds;

            // Регистрируем пермишен для телепортации в турнире
            permission.RegisterPermission("tournamentfclan.teleport", this);

                foreach (ClanData clanData in _clansList)
            {
                if (clanData.netID == 0)
                {
                    _clanByClanTag[clanData.ClanTag] = clanData;

                    continue;
                }

                BaseNetworkable baseNetworkable = BaseNetworkable.serverEntities.Find(new NetworkableId(clanData.netID));
                if (baseNetworkable == null)
                {
                    clanData.netID = 0;

                    continue;
                }

                clanData.CreateMarker();

                _clanByCupboard[clanData.netID] = clanData; _clanByClanTag[clanData.ClanTag] = clanData;
            }

            _timer = timer.Every(5, TimeHandle);
        }

        [ChatCommand("tournament")]
        private void TournamentHelp(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            player.ShowToast(GameTip.Styles.Error, "Админ-команды турнира:", false);
            player.ShowToast(GameTip.Styles.Error, "/reg — зарегистрировать шкаф текущего клана", false);
            player.ShowToast(GameTip.Styles.Error, "/whitelist <steamid> — добавить игрока в белый список", false);
            player.ShowToast(GameTip.Styles.Error, "/whitelist remove <steamid> — убрать игрока из белого списка", false);
            player.ShowToast(GameTip.Styles.Error, "/warn <CLAN_TAG> <кол-во> — выдать предупреждения клану", false);
            player.ShowToast(GameTip.Styles.Error, "/point <CLAN_TAG> <кол-во> — начислить очки клану", false);
            player.ShowToast(GameTip.Styles.Error, "/ttestclans <create|delete> [кол-во] — создать/удалить тестовые кланы", false);
            player.ShowToast(GameTip.Styles.Error, "/ttop — открыть таблицу турнира (квадраты кликабельны для телепортации, требуется пермишен tournamentfclan.teleport)", false);
        }

        private void Unload()
        {
            SaveClans();

            if (_timer != null) _timer.Destroy();

            foreach (BasePlayer player in BasePlayer.activePlayerList) CuiHelper.DestroyUi(player, Layer);

            foreach (ClanData clanData in _clansList)
            {
                if (clanData.netID == 0) continue;

                clanData.RemoveMarker();
            }

            _clanByCupboard.Clear();

            _clanByClanTag.Clear();

            if (_playerWhiteList is not null)
            {
                _playerWhiteList.Clear();

                _playerWhiteList = null;
            }
        }

        private void UnregisterClan(ClanData clanData, string reason = "")
        {
            if (clanData == null) return;

            if (clanData.netID != 0)
            {
                clanData.RemoveMarker();
                _clanByCupboard.Remove(clanData.netID);
                clanData.netID = 0;
            }

            if (!string.IsNullOrEmpty(reason))
            {
                Server.Broadcast($"<color=#FF6B6B>АНРЕГ КЛАНА</color>\n<size=12>Клан <color=#FF6B6B>{clanData.ClanTag}</color> снят с турнира. Причина: {reason}</size>");
            }

            SaveClans();
        }

        private object OnEntityTakeDamage(BuildingPrivlidge buildingPrivlidge, HitInfo hitInfo)
        {
            if (buildingPrivlidge == null || !_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value)) return null;

            BasePlayer player = hitInfo?.InitiatorPlayer;
            if (player == null || !player.userID.IsSteamId()) return null;

            // Админы могут наносить урон любым турнирным шкафам
            if (player.IsAdmin) return null;

            if (_clanByCupboard.TryGetValue(buildingPrivlidge.net.ID.Value, out ClanData clanData))
            {
                String clanTag = GetClanTag(player.userID.Get());

                if (String.IsNullOrEmpty(clanTag) || !_clanByClanTag.ContainsKey(clanTag))
                {
                    if (player.SecondsSinceAttacked > 5)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Вы не имеете право наносить урон турнирному шкафу без участия в тунире!!", false);

                        player.lastAttackedTime = UnityEngine.Time.time;

                        return false;
                    }

                    return false;
                }

                if (clanData.ClanTag == clanTag)
                {
                    if (player.SecondsSinceAttacked > 5)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Вы не имеете право уничтожать турнирный шкаф своего же клана!", false);

                        player.lastAttackedTime = UnityEngine.Time.time;

                        return false;
                    }

                    return false;
                }
            }

            return null;
        }

        private object CanUserLogin(String str1, String str2, String str3)
        {
            if (CurrentTime > LastWipe + (3600 * _config.registerSettings.Hours))
            {
                IPlayer player = covalence.Players.FindPlayerById(str2);
                if (_playerWhiteList.Contains(str2) || player != null && player.IsAdmin) return null;

                String clanTag = GetClanTag(UInt64.Parse(str2));
                if (String.IsNullOrEmpty(clanTag)) return "На сервере начался турнир, вы не можете зайти без клана!";

                if (!_clanByClanTag.ContainsKey(clanTag)) return "На сервере начался турнир, ваш клан не участвует в турнире!";

                if (_clanByClanTag.TryGetValue(clanTag, out ClanData clanData) && clanData.netID == 0) return "На сервере начался турнир, ваш клан выбил с турнире!";
            }

            return null;
        }

        private void OnEntityDeath(BuildingPrivlidge buildingPrivlidge, HitInfo hitInfo)
        {
            if (buildingPrivlidge == null || !_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value)) return;

            if (!_clanByCupboard.TryGetValue(buildingPrivlidge.net.ID.Value, out ClanData clanData)) return;

            // Handle raid points for attacker
            BasePlayer player = hitInfo?.InitiatorPlayer ?? buildingPrivlidge.lastAttacker as BasePlayer;
            if (player != null)
            {
                // Админы могут уничтожать турнирные шкафы без ограничений
                if (player.IsAdmin)
                {
                    HandleCupboardDestruction(buildingPrivlidge, hitInfo);
                    return;
                }
            }
            if (player != null)
            {
                String attackerClanTag = GetClanTag(player.userID.Get());
                if (!String.IsNullOrEmpty(attackerClanTag))
                {
                    if (_clanByClanTag.TryGetValue(attackerClanTag, out ClanData raidClanData))
                    {
                        // Check if attacker is trying to raid their own clan
                        if (attackerClanTag == clanData.ClanTag)
                        {
                            // Send Discord notification for failed raid (same clan)
                            SendDiscordRaidMessage(attackerClanTag, clanData.ClanTag, clanData.ClanGrid, 0, player, false, "Нельзя рейдить свой собственный клан");
                            player.ShowToast(GameTip.Styles.Error, "Вы не можете рейдить свой собственный клан!", false);
                            return;
                        }

                        // Check if attacker's clan is registered in tournament
                        if (raidClanData.netID == 0)
                        {
                            // Send Discord notification for failed raid (clan not registered)
                            SendDiscordRaidMessage(attackerClanTag, clanData.ClanTag, clanData.ClanGrid, 0, player, false, "Ваш клан не зарегистрирован в турнире");
                            player.ShowToast(GameTip.Styles.Error, "Ваш клан не зарегистрирован в турнире!", false);
                            return;
                        }

                        // Award raid points
                        FClan?.CallHook("GetPointRaid", buildingPrivlidge.OwnerID, player.userID.Get());
                        raidClanData.Point += clanData.raidPoint;

                        // Send Discord notification for successful raid with detailed information
                        SendDiscordRaidMessage(attackerClanTag, clanData.ClanTag, clanData.ClanGrid, clanData.raidPoint, player, true, "");

                        // Notify players about successful raid
                        player.ShowToast(GameTip.Styles.Error, $"Вы успешно зарейдили клан {clanData.ClanTag} и получили {clanData.raidPoint} очков!", false);
                        Server.Broadcast($"<color=#FF6B6B>⚔️ РЕЙД!</color>\n<size=12>Клан <color=#FF6B6B>{attackerClanTag}</color> зарейдил клан <color=#FF6B6B>{clanData.ClanTag}</color>!</size>");
                    }
                    else
                    {
                        // Attacker's clan not found in tournament
                        SendDiscordRaidMessage(attackerClanTag, clanData.ClanTag, clanData.ClanGrid, 0, player, false, "Ваш клан не найден в турнире");
                        player.ShowToast(GameTip.Styles.Error, "Ваш клан не участвует в турнире!", false);
                    }
                }
                else
                {
                    // Attacker not in any clan
                    SendDiscordRaidMessage("Без клана", clanData.ClanTag, clanData.ClanGrid, 0, player, false, "Вы не состоите в клане");
                    player.ShowToast(GameTip.Styles.Error, "Вы должны быть в клане для участия в рейдах!", false);
                }
            }

            // Use the unified destruction handler
            HandleCupboardDestruction(buildingPrivlidge, hitInfo);
        }

        private void OnLootEntity(BasePlayer player, BuildingPrivlidge buildingPrivlidge)
        {
            // Админы могут игнорировать все проверки участия
            if (player.IsAdmin) return;

            CuiElementContainer container = new CuiElementContainer();

            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0.5 0", AnchorMax = "0.5 0", OffsetMin = "-50 361", OffsetMax = "190 431" },
                Image = { Color = "0.969 0.922 0.882 0.037", Material = "assets/icons/greyout.mat" }
            }, "Overlay", Layer, Layer);

            String clanTag = GetClanTag(player.userID.Get());
            if (String.IsNullOrEmpty(clanTag))
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = "Участие запрещено\nВы не состоите в клане", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            if (_clanByClanTag.TryGetValue(clanTag, out ClanData clanData))
            {
                if (clanData.netID == 0)
                {
                    container.Add(new CuiLabel()
                    {
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                        Text = { Text = "Участие запрещено\nВаш турнирный шкаф уже был уничтожен", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                    }, Layer);

                    CuiHelper.AddUi(player, container);
                    return;
                }

                // Check if this cupboard belongs to the player's clan
                if (clanData.netID == buildingPrivlidge.net.ID.Value)
                {
                    container.Add(new CuiLabel()
                    {
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                        Text = { Text = "Участие запрещено\nВы уже участвуете", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                    }, Layer);

                    CuiHelper.AddUi(player, container);
                    return;
                }
                else
                {
                    // Player's clan is registered but this is someone else's cupboard
                    // Don't show tournament UI for normal authorization attempts
                    return;
                }
            }

            if (_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value))
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = "Участие запрещено\nДанный шкаф уже участвует в турнире", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            if (CurrentTime > LastWipe + (3600 * _config.registerSettings.Hours))
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = $"Участие запрещено\nПрошло {_config.registerSettings.Hours} часа", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            if (!IsClanOwner(player.userID.Get()))
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = $"Участие запрещено\nВы не являетесь главной своего клана", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            if (buildingPrivlidge.GetBuilding().buildingBlocks.Count < _config.registerSettings.MinObject)
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = $"Участие запрещено\nНедостаточно обьектов", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            if (GetClanPoint(clanTag) < _config.registerSettings.MinPoints)
            {
                container.Add(new CuiLabel()
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                    Text = { Text = $"Участие запрещено\nНедостаточно клановых очков", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
                }, Layer);

                CuiHelper.AddUi(player, container);
                return;
            }

            container.Add(new CuiLabel()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                Text = { Text = $"Участие разрешено\nЗарегистрироваться на турнир", Font = "robotocondensed-bold.ttf", Color = "1 1 1 0.2", FontSize = 16, Align = TextAnchor.MiddleCenter }
            }, Layer);

            container.Add(new CuiButton
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "0 0", OffsetMax = "0 0" },
                Button = { Color = "0 0 0 0", Command = $"UI_TOURNAMENT register {buildingPrivlidge.net.ID.Value}" }
            }, Layer);

            CuiHelper.AddUi(player, container);
        }

        private void OnLootEntityEnd(BasePlayer player, BuildingPrivlidge buildingPrivlidge) => CuiHelper.DestroyUi(player, Layer);
        private object OnEntityGroundMissing(BuildingPrivlidge buildingPrivlidge) => _clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value) ? false : null;

        private void OnEntityKill(BuildingPrivlidge buildingPrivlidge)
        {
            if (buildingPrivlidge == null || !_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value)) return;

            // Handle cupboard destruction due to stability loss
            HandleCupboardDestruction(buildingPrivlidge, null);
        }

        private void HandleCupboardDestruction(BuildingPrivlidge buildingPrivlidge, HitInfo hitInfo)
        {
            if (!_clanByCupboard.TryGetValue(buildingPrivlidge.net.ID.Value, out ClanData clanData)) return;

            // Remove markers and cleanup
            clanData.RemoveMarker();
            clanData.netID = 0;
            _clanByCupboard.Remove(buildingPrivlidge.net.ID.Value);

            // Send Discord notification for destruction
            // SendDiscordDestructionMessage(clanData.ClanTag, clanData.ClanGrid, hitInfo == null);

            // Award points to defenders if this was due to stability loss (no attacker)
            if (hitInfo == null)
            {
                // Find nearby players who might have defended this area
                List<BasePlayer> nearbyPlayers = new List<BasePlayer>();
                var colliders = UnityEngine.Physics.OverlapSphere(buildingPrivlidge.transform.position, 50f);
                List<string> awardedClans = new List<string>();

                foreach (var collider in colliders)
                {
                    BasePlayer player = collider.GetComponentInParent<BasePlayer>();
                    if (player != null && player.IsAlive() && !player.IsSleeping())
                    {
                        String playerClanTag = GetClanTag(player.userID.Get());
                        if (!String.IsNullOrEmpty(playerClanTag) && playerClanTag != clanData.ClanTag)
                        {
                            // Award defensive points to this player and their clan (if not already awarded)
                            if (_clanByClanTag.TryGetValue(playerClanTag, out ClanData defenderClanData) && !awardedClans.Contains(playerClanTag))
                            {
                                defenderClanData.Point += clanData.raidPoint / 2; // Half points for defense
                                awardedClans.Add(playerClanTag);

                                // Send individual notification to clan members
                                List<String> defenderMembers = FClan?.Call<List<String>>("GetMembersClan", playerClanTag) ?? new List<String>();
                                foreach (String memberID in defenderMembers)
                                {
                                    BasePlayer member = BasePlayer.FindByID(UInt64.Parse(memberID));
                                    if (member != null)
                                    {
                                        member.ChatMessage($"<color=#9ACD32>ЗАЩИТА ТЕРРИТОРИИ!</color> Ваш клан получил <color=#9ACD32>{clanData.raidPoint / 2}</color> очков за защиту территории от клана <color=#9ACD32>{clanData.ClanTag}</color>!");
                                    }
                                }
                            }
                        }
                    }
                }

                // Broadcast defensive points award if any clans were awarded
                if (awardedClans.Count > 0)
                {
                    Server.Broadcast($"<color=#9ACD32>ТЕРРИТОРИЯ ЗАЩИЩЕНА!</color>\n<size=12>Кланы: <color=#9ACD32>{string.Join(", ", awardedClans)}</color> получили очки за защиту территории!</size>");
                }
            }

            // Kick clan members
            List<String> memberClan = FClan?.Call<List<String>>("GetMembersClan", clanData.ClanTag) ?? new List<String>();
            foreach (String memberID in memberClan)
            {
                BasePlayer member = BasePlayer.FindByID(UInt64.Parse(memberID));
                if (member == null) continue;

                member.Kick("Ваш клан был зарейжен на турнире.");
            }

            // Broadcast destruction message
            // if (hitInfo == null)
            // {
            //     Server.Broadcast($"<color=#9ACD32>ВНИМАНИЕ!</color>\n<size=12>Клан <color=#9ACD32>{clanData.ClanTag}</color> был уничтожен в квадрате <color=#9ACD32>{clanData.ClanGrid}</color> из-за потери опоры</size>");
            // }
        }

        private String CanRemove(BasePlayer player, BuildingPrivlidge buildingPrivlidge) => canRemove(player, buildingPrivlidge);
        private String canRemove(BasePlayer player, BuildingPrivlidge buildingPrivlidge)
        {
            // Админы могут использовать ремув на любых шкафах
            if (player.IsAdmin) return null;

            if (_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value))
                return "Запрещено использовать ремув для турнирного шкафа.";

            return null;
        }

        [ChatCommand("ttop")]
        private void MainUi(BasePlayer player)
        {
            CuiElementContainer container = new CuiElementContainer();

            container.Add(new CuiPanel
            {
                CursorEnabled = true,
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                Image = { Color = "0 0 0 0.8", Material = "assets/content/ui/uibackgroundblur-ingamemenu.mat" }
            }, "Overlay", Layer, Layer);

            container.Add(new CuiButton()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                Button = { Color = HexToRustFormat("#343434"), Sprite = "assets/content/ui/ui.background.transparent.radial.psd", Close = Layer },
                Text = { Text = "" }
            }, Layer);

            TournamentTop(ref container, player);

            TournamentClanList(ref container, player);

            CuiHelper.AddUi(player, container);
        }

        [ChatCommand("whitelist")]
        private void WhitelistCommand(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            if (args.Length == 0)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /whitelist <steamid> | /whitelist remove <steamid>", false);
                return;
            }

            if (args.Length == 1)
            {
                if (!UInt64.TryParse(args[0], out UInt64 steamID) || !steamID.IsSteamId())
                {
                    player.ShowToast(GameTip.Styles.Error, "Неверный SteamID. Пример: /whitelist 76561198000000000", false);
                    return;
                }

                _playerWhiteList.Add(steamID.ToString());
                player.ShowToast(GameTip.Styles.Error, $"✓ Игрок {steamID} добавлен в белый список", false);
                return;
            }

            if (args.Length >= 2 && args[0].Equals("remove", StringComparison.OrdinalIgnoreCase))
            {
                if (!UInt64.TryParse(args[1], out UInt64 steamID) || !steamID.IsSteamId())
                {
                    player.ShowToast(GameTip.Styles.Error, "Неверный SteamID. Пример: /whitelist remove 76561198000000000", false);
                    return;
                }

                _playerWhiteList.Remove(steamID.ToString());
                player.ShowToast(GameTip.Styles.Error, $"✓ Игрок {steamID} удалён из белого списка", false);
                return;
            }

            player.ShowToast(GameTip.Styles.Error, "Использование: /whitelist <steamid> | /whitelist remove <steamid>", false);
        }

        [ChatCommand("reg")]
        private void ForceRegisterCupboard(BasePlayer player)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            // Find the cupboard the player is looking at
            RaycastHit hit;
            if (!Physics.Raycast(player.eyes.HeadRay(), out hit, 5f))
            {
                player.ShowToast(GameTip.Styles.Error, "Вы должны смотреть на шкаф!", false);
                return;
            }

            BuildingPrivlidge buildingPrivlidge = hit.GetEntity() as BuildingPrivlidge;
            if (buildingPrivlidge == null)
            {
                player.ShowToast(GameTip.Styles.Error, "Вы должны смотреть на шкаф!", false);
                return;
            }

            // Берём тег клана по владельцу шкафа, а не по администратору
            UInt64 ownerId = buildingPrivlidge.OwnerID;
            String ownerClanTag = GetClanTag(ownerId);
            if (String.IsNullOrEmpty(ownerClanTag))
            {
                player.ShowToast(GameTip.Styles.Error, "Владелец этого шкафа должен состоять в клане!", false);
                return;
            }

            // Check if cupboard is already registered
            if (_clanByCupboard.ContainsKey(buildingPrivlidge.net.ID.Value))
            {
                player.ShowToast(GameTip.Styles.Error, "Этот шкаф уже зарегистрирован в турнире!", false);
                return;
            }

            // Check if owner's clan is already registered and active
            if (_clanByClanTag.ContainsKey(ownerClanTag) && _clanByClanTag[ownerClanTag].netID != 0)
            {
                player.ShowToast(GameTip.Styles.Error, "Клан владельца шкафа уже участвует в турнире!", false);
                return;
            }

            // Force register the cupboard
            Vector3 buildingPrivlidgePosition = buildingPrivlidge.transform.position;
            buildingPrivlidgePosition.x += UnityEngine.Random.Range(-30f, 30f);
            buildingPrivlidgePosition.z += UnityEngine.Random.Range(-30f, 30f);

            ClanData clanData = new ClanData()
            {
                ClanTag = ownerClanTag,
                ClanGrid = MapHelper.PositionToString(buildingPrivlidge.transform.position),
                netID = buildingPrivlidge.net.ID.Value,
                Point = 0,
                raidPoint = GetRaidPoint(ownerClanTag, buildingPrivlidge),
                position = buildingPrivlidgePosition
            };

            clanData.CreateMarker();
            _clansList.Add(clanData);
            _clanByCupboard[buildingPrivlidge.net.ID.Value] = clanData;
            _clanByClanTag[ownerClanTag] = clanData;

            player.ShowToast(GameTip.Styles.Error, $"Шкаф успешно зарегистрирован для клана {ownerClanTag}!", false);
            Server.Broadcast($"<color=#9ACD32>ВНИМАНИЕ!</color>\n<size=12>Клан <color=#9ACD32>{ownerClanTag}</color> зарегистрировался в турнире!</size>");

            // Discord: указываем владельца шкафа как регистратора
            BasePlayer ownerPlayer = BasePlayer.FindByID(ownerId);
            SendDiscordRegistrationMessage(
                ownerClanTag,
                clanData.ClanGrid,
                ownerPlayer?.displayName ?? ownerId.ToString(),
                ownerPlayer?.UserIDString ?? ownerId.ToString()
            );
        }


        [ChatCommand("reset")]
        private void ResetCommand(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            if (args.Length < 1)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /reset warn <CLAN_TAG> <кол-во>", false);
                return;
            }

            string sub = args[0].ToLowerInvariant();
            if (sub != "warn")
            {
                player.ShowToast(GameTip.Styles.Error, "Неизвестная подкоманда. Доступно: warn", false);
                return;
            }

            if (args.Length < 3)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /reset warn <CLAN_TAG> <кол-во>", false);
                return;
            }

            string inputTag2 = args[1];
            if (!_clanByClanTag.TryGetValue(inputTag2, out ClanData clanData))
            {
                player.ShowToast(GameTip.Styles.Error, $"Клан {inputTag2} не найден в турнире!", false);
                return;
            }

            if (!Int32.TryParse(args[2], out int amount) || amount <= 0)
            {
                player.ShowToast(GameTip.Styles.Error, "Количество должно быть положительным целым числом", false);
                return;
            }

            int before = clanData.warnCount;
            clanData.warnCount = Math.Max(0, clanData.warnCount - amount);
            SaveClans();

            int delta = before - clanData.warnCount;
            player.ShowToast(GameTip.Styles.Error, $"✓ У клана {clanData.ClanTag} снято предупреждений: -{delta} (итого {clanData.warnCount}/3)", false);

            // Notify entire clan with toast + sound about warn removal
            List<string> members = FClan?.Call<List<string>>("GetMembersClan", clanData.ClanTag) ?? new List<string>();
            foreach (string memberID in members)
            {
                if (!UInt64.TryParse(memberID, out var mid)) continue;
                BasePlayer member = BasePlayer.FindByID(mid);
                if (member == null || !member.IsConnected) continue;
                try
                {
                    member.ShowToast(GameTip.Styles.Server_Event, $"Админ снял предупреждение вашему клану: {clanData.warnCount}/3", false);
                }
                catch { }
                RunEffect(member, effectSoundAccess);
            }
        }

        // Общая логика выдачи предупреждений
        private void AddClanWarnings(BasePlayer admin, ClanData clanData, int amount)
        {
            clanData.warnCount += amount;
            SaveClans();

            admin.ShowToast(GameTip.Styles.Error, $"✓ Клану {clanData.ClanTag} выдано предупреждений: +{amount} (итого {clanData.warnCount}/3)", false);

            // Уведомим участников клана
            List<string> members = FClan?.Call<List<string>>("GetMembersClan", clanData.ClanTag) ?? new List<string>();
            foreach (string memberID in members)
            {
                if (!UInt64.TryParse(memberID, out var mid)) continue;
                BasePlayer member = BasePlayer.FindByID(mid);
                if (member == null || !member.IsConnected) continue;
                try
                {
                    member.ShowToast(GameTip.Styles.Server_Event, $"Админ выдал предупреждение вашему клану: {clanData.warnCount}/3", false);
                }
                catch { }
                RunEffect(member, effectSoundAccess);
            }

            if (clanData.warnCount >= 3)
            {
                UnregisterClan(clanData, "Достигнут лимит предупреждений 3/3");
                Server.Broadcast($"<color=#FF6B6B>⚠️ Предупреждения</color>\n<size=12>Клан <color=#FF6B6B>{clanData.ClanTag}</color> получил 3/3 предупреждений и снят с участия.</size>");
            }
        }

        [ChatCommand("warn")]
        private void WarnCommand(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            if (args.Length < 2)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /warn <CLAN_TAG> <кол-во>", false);
                return;
            }

            string inputTag = args[0];
            if (!_clanByClanTag.TryGetValue(inputTag, out ClanData clanData))
            {
                player.ShowToast(GameTip.Styles.Error, $"Клан {inputTag} не найден в турнире!", false);
                return;
            }

            if (!Int32.TryParse(args[1], out int amount) || amount <= 0)
            {
                player.ShowToast(GameTip.Styles.Error, "Количество должно быть положительным целым числом", false);
                return;
            }

            AddClanWarnings(player, clanData, amount);
        }

        [ChatCommand("point")]
        private void PointCommand(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            if (args.Length < 2)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /point <CLAN_TAG> <кол-во>", false);
                return;
            }

            string inputTag = args[0];
            if (!_clanByClanTag.TryGetValue(inputTag, out ClanData clanData))
            {
                player.ShowToast(GameTip.Styles.Error, $"Клан {inputTag} не найден в турнире!", false);
                return;
            }

            if (!Int32.TryParse(args[1], out int amount) || amount == 0)
            {
                player.ShowToast(GameTip.Styles.Error, "Количество должно быть ненулевым целым числом", false);
                return;
            }

            clanData.Point += amount;
            SaveClans();

            string sign = amount > 0 ? "+" : string.Empty;
            player.ShowToast(GameTip.Styles.Error, $"✓ Клану {clanData.ClanTag} {(amount > 0 ? "начислено" : "списано")} очков: {sign}{amount} (итого {clanData.Point})", false);

            // Уведомим всех участников клана тостом и звуком
            List<string> members = FClan?.Call<List<string>>("GetMembersClan", clanData.ClanTag) ?? new List<string>();
            foreach (string memberID in members)
            {
                if (!UInt64.TryParse(memberID, out var mid)) continue;
                BasePlayer member = BasePlayer.FindByID(mid);
                if (member == null || !member.IsConnected) continue;
                try
                {
                    member.ShowToast(GameTip.Styles.Server_Event, $"Админ {(amount > 0 ? "начислил" : "списал")} очки вашему клану: {sign}{amount} (итого {clanData.Point})", false);
                }
                catch { }
                RunEffect(member, effectSoundAccess);
            }
        }

        [ChatCommand("ttestclans")]
        private void TestClansCommand(BasePlayer player, string command, string[] args)
        {
            if (!player.IsAdmin)
            {
                player.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                return;
            }

            if (args.Length < 1)
            {
                player.ShowToast(GameTip.Styles.Error, "Использование: /ttestclans <create|delete> [количество]", false);
                return;
            }

            string action = args[0].ToLower();
            int count = 100;
            if (args.Length >= 2) int.TryParse(args[1], out count);

            if (action == "create")
            {
                int created = 0;
                for (int i = 1; i <= Math.Max(1, count); i++)
                {
                    string tag = $"TT{i:D4}"; // TT0001, TT0002, etc.
                    if (_clanByClanTag.ContainsKey(tag)) continue;

                    // Генерируем фейковый netID для тестовых кланов (большие числа, чтобы не конфликтовать с реальными)
                    UInt64 fakeNetID = (UInt64)(999999000000 + i);

                    var newClan = new ClanData
                    {
                        ClanTag = tag,
                        ClanGrid = $"TEST{i % 26 + 1:D2}", // TEST01, TEST02, ... TEST26
                        netID = fakeNetID,
                        Point = UnityEngine.Random.Range(0, 10000),
                        raidPoint = UnityEngine.Random.Range(0, 5000),
                        warnCount = 0,
                        position = Vector3.zero
                    };
                    
                    _clansList.Add(newClan);
                    _clanByClanTag[tag] = newClan;
                    _clanByCupboard[fakeNetID] = newClan;
                    created++;
                }
                SaveClans();
                player.ShowToast(GameTip.Styles.Error, $"✓ Создано тестовых кланов: {created}", false);
            }
            else if (action == "delete")
            {
                int before = _clansList.Count;
                var toRemove = _clansList.Where(c =>
                {
                    if (c.ClanTag.Length != 6) return false;
                    if (!c.ClanTag.StartsWith("TT")) return false;
                    if (!int.TryParse(c.ClanTag.Substring(2), out _)) return false;
                    return true;
                }).ToList();

                foreach (var clan in toRemove)
                {
                    _clansList.Remove(clan);
                    _clanByClanTag.Remove(clan.ClanTag);
                    if (clan.netID != 0 && _clanByCupboard.ContainsKey(clan.netID))
                    {
                        _clanByCupboard.Remove(clan.netID);
                    }
                }

                int removed = before - _clansList.Count;
                SaveClans();
                player.ShowToast(GameTip.Styles.Error, $"✓ Удалено тестовых кланов: {removed}", false);
            }
            else
            {
                player.ShowToast(GameTip.Styles.Error, "Неизвестное действие. Используйте: create или delete", false);
            }
        }

        private void TournamentTop(ref CuiElementContainer container, BasePlayer player)
        {
            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-368 -180", OffsetMax = "368 142" },
                Image = { Color = "0 0 0 0" }
            }, Layer, Layer + ".C", Layer + ".C");

            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0 1", AnchorMax = "1 1", OffsetMin = "0 7", OffsetMax = "0 47" },
                Image = { Color = HexToRustFormat("#D0C6BD33") }
            }, Layer + ".C", Layer + ".LT");

            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "1 0", AnchorMax = "1 1", OffsetMin = "-36 0", OffsetMax = "0 0" },
                Image = { Color = "0 0 0 0" }
            }, Layer + ".C", Layer + ".R");

            container.Add(new CuiLabel()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "10 0", OffsetMax = "0 0" },
                Text = { Text = "Название клана", Font = "robotocondensed-bold.ttf", Color = HexToRustFormat("#D0C6BD"), FontSize = 18, Align = TextAnchor.MiddleLeft }
            }, Layer + ".LT");

            container.Add(new CuiLabel()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "310 0", OffsetMax = "0 0" },
                Text = { Text = "Квадрат", Font = "robotocondensed-bold.ttf", Color = HexToRustFormat("#D0C6BD"), FontSize = 18, Align = TextAnchor.MiddleLeft }
            }, Layer + ".LT");

            container.Add(new CuiLabel()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "400 0", OffsetMax = "0 0" },
                Text = { Text = "Общее кол-во очков", Font = "robotocondensed-bold.ttf", Color = HexToRustFormat("#D0C6BD"), FontSize = 18, Align = TextAnchor.MiddleLeft }
            }, Layer + ".LT");

            container.Add(new CuiLabel()
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "580 0", OffsetMax = "0 0" },
                Text = { Text = "Очки за рейд", Font = "robotocondensed-bold.ttf", Color = HexToRustFormat("#D0C6BD"), FontSize = 18, Align = TextAnchor.MiddleLeft }
            }, Layer + ".LT");
        }

        private void TournamentClanList(ref CuiElementContainer container, BasePlayer player)
        {
            IEnumerable<ClanData> clansList = _clansList.FindAll(p => p.netID != 0).OrderByDescending(p => p.Point);
            Int32 rowHeight = 47;
            Int32 total = clansList.Count();
            Int32 contentHeight = Math.Max(total * rowHeight, 10 * rowHeight);

            // Create vertical scroll view for clans list
            container.Add(new CuiElement
            {
                Name = Layer + ".C" + ".ScrollView",
                Parent = Layer + ".C",
                Components =
                {
                    new CuiImageComponent { Color = "0 0 0 0" },
                    new CuiScrollViewComponent
                    {
                        Horizontal = false,
                        Vertical = true,
                        MovementType = UnityEngine.UI.ScrollRect.MovementType.Elastic,
                        Elasticity = 0.25f,
                        Inertia = true,
                        DecelerationRate = 0.3f,
                        ContentTransform = new CuiRectTransform()
                        {
                            AnchorMin = "0 1",
                            AnchorMax = "1 1",
                            OffsetMin = $"0 -{contentHeight}",
                            OffsetMax = "0 0"
                        },
                        ScrollSensitivity = 14.0f,
                        VerticalScrollbar = new CuiScrollbar
                        {
                            Invert = false,
                            AutoHide = false,
                            HandleColor = "0.82 0.78 0.74 0.3",
                            HighlightColor = "0.82 0.78 0.74 0.1",
                            TrackColor = "0.82 0.78 0.74 0.05",
                            Size = 6,
                            PressedColor = "0.82 0.78 0.74 0.2"
                        }
                    },
                    new CuiRectTransformComponent { AnchorMin = "0.0055 0", AnchorMax = "0.989 1", OffsetMin = "0 0", OffsetMax = "0 0" }
                }
            });

            Int32 i = 0;
            foreach (ClanData clan in clansList)
            {
                // Row background
                container.Add(new CuiPanel
                {
                    RectTransform = { AnchorMin = "0 1", AnchorMax = "1 1", OffsetMin = $"0 -{(i + 1) * rowHeight}", OffsetMax = $"0 -{i * rowHeight}" },
                    Image = { Color = HexToRustFormat("#D0C6BD33") }
                }, Layer + ".C" + ".ScrollView", Layer + ".C" + ".ScrollView" + $".Row{i}");

                // Index and clan tag
                container.Add(new CuiLabel
                {
                    Text = { Text = $"{i + 1}. {clan.ClanTag}", Color = HexToRustFormat("#D0C6BD4D"), FontSize = 14, Font = "robotocondensed-regular.ttf", Align = TextAnchor.MiddleLeft },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "10 0", OffsetMax = "0 0" },
                }, Layer + ".C" + ".ScrollView" + $".Row{i}");

                // Grid button (clickable for teleport if user has permission)
                container.Add(new CuiButton
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "0 1", OffsetMin = "310 0", OffsetMax = "370 0" },
                    Button = { Color = "0 0 0 0", Command = permission.UserHasPermission(player.UserIDString, "tournamentfclan.teleport") ? $"UI_TOURNAMENT teleport {clan.ClanTag}" : "" },
                    Text = { Text = $"{clan.ClanGrid}", Color = HexToRustFormat("#D0C6BD4D"), FontSize = 14, Font = "robotocondensed-regular.ttf", Align = TextAnchor.MiddleCenter }
                }, Layer + ".C" + ".ScrollView" + $".Row{i}");

                // Points
                container.Add(new CuiLabel
                {
                    Text = { Text = $"{clan.Point}", Color = HexToRustFormat("#D0C6BD4D"), FontSize = 14, Font = "robotocondensed-regular.ttf", Align = TextAnchor.MiddleCenter },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "0 1", OffsetMin = "440 0", OffsetMax = "510 0" },
                }, Layer + ".C" + ".ScrollView" + $".Row{i}");

                // Raid points
                container.Add(new CuiLabel
                {
                    Text = { Text = $"{clan.raidPoint}", Color = HexToRustFormat("#D0C6BD4D"), FontSize = 14, Font = "robotocondensed-regular.ttf", Align = TextAnchor.MiddleCenter },
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "0 1", OffsetMin = "580 0", OffsetMax = "650 0" },
                }, Layer + ".C" + ".ScrollView" + $".Row{i}");

                i++;
            }
        }

        [ConsoleCommand("UI_TOURNAMENT")]
        private void TournamentUIHandler(ConsoleSystem.Arg args)
        {
            BasePlayer player = args?.Player();
            if (player == null || !args.HasArgs()) return;

            switch (args.Args[0])
            {
                case "register":
                    {
                        if (!UInt64.TryParse(args.Args[1], out UInt64 buildingID)) return;

                        String clanTag = GetClanTag(player.userID.Get());
                        if (String.IsNullOrEmpty(clanTag)) return;

                        BuildingPrivlidge buildingPrivlidge = BaseNetworkable.serverEntities.Find(new NetworkableId(buildingID)) as BuildingPrivlidge;
                        if (buildingPrivlidge == null) return;

                        Vector3 buildingPrivlidgePosition = buildingPrivlidge.transform.position;
                        buildingPrivlidgePosition.x += UnityEngine.Random.Range(-30f, 30f);
                        buildingPrivlidgePosition.z += UnityEngine.Random.Range(-30f, 30f);

                        ClanData clanData = new ClanData()
                        {
                            ClanTag = clanTag,
                            ClanGrid = MapHelper.PositionToString(buildingPrivlidge.transform.position),
                            netID = buildingID,
                            Point = 0,
                            raidPoint = GetRaidPoint(clanTag, buildingPrivlidge),
                            position = buildingPrivlidgePosition
                        };

                        clanData.CreateMarker();

                        _clansList.Add(clanData);

                        _clanByCupboard[buildingID] = clanData;

                        _clanByClanTag[clanTag] = clanData;

                        player.ShowToast(GameTip.Styles.Error, "Вы успешно зарегистрировали свой клан в турнире!", false);

                        // Send Discord notification for registration (регистратор — сам игрок)
                        SendDiscordRegistrationMessage(clanTag, clanData.ClanGrid, player.displayName, player.UserIDString);

                        player.EndLooting();
                        break;
                    }
                case "disband":
                    {
                        if (!player.IsAdmin || !UInt64.TryParse(args.Args[1], out UInt64 playerID)) return;

                        String clanTag = GetClanTag(playerID);
                        if (String.IsNullOrEmpty(clanTag)) return;

                        if (!_clanByClanTag.TryGetValue(clanTag, out ClanData clanData)) return;

                        clanData.RemoveMarker();

                        _clanByCupboard.Remove(clanData.netID);

                        clanData.netID = 0;
                        break;
                    }
                case "whitelist":
                    {
                        switch (args.Args[1])
                        {
                            case "add":
                                {
                                    if (args.Args.Length < 3 || !UInt64.TryParse(args.Args[2], out UInt64 steamID) || !steamID.IsSteamId())
                                    {
                                        player.ShowToast(GameTip.Styles.Error, "UI_TOURNAMENT whitelist add STEAMID", false);
                                        return;
                                    }

                                    _playerWhiteList.Add(steamID.ToString());
                                    player.ShowToast(GameTip.Styles.Error, $"Вы успешно добавили игрока {steamID} в белый список!", false);
                                    break;
                                }
                            case "remove":
                                {
                                    if (args.Args.Length < 3 || !UInt64.TryParse(args.Args[2], out UInt64 steamID) || !steamID.IsSteamId())
                                    {
                                        player.ShowToast(GameTip.Styles.Error, "UI_TOURNAMENT whitelist remove STEAMID", false);
                                        return;
                                    }

                                    _playerWhiteList.Remove(steamID.ToString());
                                    player.ShowToast(GameTip.Styles.Error, $"Вы успешно удалили игрока {steamID} из белого списка!", false);
                                    break;
                                }
                        }
                        break;
                    }
                case "teleport":
                    {
                        // Проверяем права на телепортацию
                        if (player == null || !permission.UserHasPermission(player.UserIDString, "tournamentfclan.teleport"))
                        {
                            player?.ShowToast(GameTip.Styles.Error, "У вас нет прав использовать эту команду!", false);
                            return;
                        }

                        if (args.Args.Length < 2)
                        {
                            player.ShowToast(GameTip.Styles.Error, "Ошибка: не указан тег клана", false);
                            return;
                        }

                        string clanTag = args.Args[1];
                        if (!_clanByClanTag.TryGetValue(clanTag, out ClanData clanData))
                        {
                            player.ShowToast(GameTip.Styles.Error, $"Клан {clanTag} не найден в турнире!", false);
                            return;
                        }

                        // Телепортируем админа к позиции клана
                        Vector3 teleportPosition = clanData.position;
                        player.Teleport(teleportPosition);
                        
                        player.ShowToast(GameTip.Styles.Error, $"Вы телепортированы к клану {clanTag} в квадрате {clanData.ClanGrid}", false);
                        
                        // Закрываем UI после телепортации
                        CuiHelper.DestroyUi(player, Layer);
                        break;
                    }
            }
        }

        private String GetClanTag(UInt64 playerID) => FClan?.Call<String>("GetClanTag", playerID) ?? String.Empty;

        private Int32 GetClanPoint(String nameClan) => FClan?.Call<Int32>("GetClanPoint", nameClan) ?? 0;

        private Boolean IsClanOwner(UInt64 playerID) => FClan?.Call<Boolean>("IsModerator", playerID) ?? false;

        private void TimeHandle()
        {
            if (_clansList.Count == 0) return;

            foreach (ClanData clanData in _clansList)
            {
                if (clanData.netID == 0) continue;

                clanData.UpdateMarker();
            }
        }

        private Int32 GetRaidPoint(String ClanTag, BuildingPrivlidge buildingPrivlidge)
        {
            if (_config.raidPointSettings.useQualityCeiling) return (Int32)Math.Ceiling(buildingPrivlidge.GetBuilding().buildingBlocks.Count / _config.raidPointSettings.CeilingObject);

            return (Int32)Math.Ceiling(GetClanPoint(ClanTag) / _config.raidPointSettings.CeilingPoint);
        }

        private String HexToRustFormat(String hex)
        {
            if (String.IsNullOrEmpty(hex)) hex = "#FFFFFFFF";

            String str = hex.Trim('#');

            if (str.Length == 6) str += "FF";

            if (str.Length != 8)
            {
                throw new Exception(hex);
                throw new InvalidOperationException("Cannot convert a wrong format.");
            }

            Byte r = Byte.Parse(str.Substring(0, 2), NumberStyles.HexNumber);
            Byte g = Byte.Parse(str.Substring(2, 2), NumberStyles.HexNumber);
            Byte b = Byte.Parse(str.Substring(4, 2), NumberStyles.HexNumber);
            Byte a = Byte.Parse(str.Substring(6, 2), NumberStyles.HexNumber);

            UnityEngine.Color color = new Color32(r, g, b, a);

            return String.Format("{0:F2} {1:F2} {2:F2} {3:F2}", color.r, color.g, color.b, color.a);
        }

        #region Discord Integration
        private void SendDiscordRaidMessage(string attackerClan, string defenderClan, string grid, int raidPoints, BasePlayer attacker = null, bool success = true, string errorMessage = "")
        {
            if (string.IsNullOrEmpty(DiscordWebhookUrl)) return;

            string title = success ? "⚔️ Успешный Рейд" : "❌ Неудачный Рейд";
            string description = success
                ? $"Клан **{attackerClan}** успешно зарейдил клан **{defenderClan}**!"
                : $"Клан **{attackerClan}** попытался зарейдить клан **{defenderClan}**, но не смог!";

            var fields = new List<object>
            {
                new
                {
                    name = "🗺️ Локация",
                    value = $"**Квадрат:** {grid}",
                    inline = true,
                },
                new
                {
                    name = "💰 Очки рейда",
                    value = success ? $"**Получено очков:** {raidPoints}" : "**Получено очков:** 0",
                    inline = true,
                }
            };

            if (!string.IsNullOrEmpty(errorMessage))
            {
                fields.Add(new
                {
                    name = "❌ Ошибка",
                    value = $"**{errorMessage}**",
                    inline = false,
                });
            }

            fields.Add(new
            {
                name = "⏰ Время",
                value = $"**Дата:** {DateTime.Now:dd.MM.yyyy HH:mm:ss}",
                inline = false,
            });

            object embed = new
            {
                title = title,
                description = description,
                color = success ? 15158332 : 16711680, // Красный для успеха, темно-красный для ошибки
                fields = fields.ToArray(),
                thumbnail = attacker != null ? new
                {
                    url = $"https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars//{attacker.UserIDString}",
                } : null,
                timestamp = DateTime.UtcNow.ToString("o"),
            };

            SendDiscordEmbed(embed);
        }

        private void SendDiscordRegistrationMessage(string clanTag, string grid, string registrarName, string registrarId = null)
        {
            if (string.IsNullOrEmpty(DiscordWebhookUrl))
            {
                PrintWarning("Discord webhook URL is empty or null, cannot send registration notification");
                return;
            }

            try
            {
                object embed = new
                {
                    title = "🏆 Регистрация в Турнире",
                    description = $"Клан **{clanTag}** успешно зарегистрировался в турнире!",
                    color = 3066993, // Зеленый цвет
                    fields = new[]
                    {
                        new
                        {
                            name = "🗺️ Локация",
                            value = $"**Квадрат:** {grid}",
                            inline = true,
                        },
                        new
                        {
                            name = "👤 Регистратор",
                            value = $"**Игрок:** {registrarName}",
                            inline = true,
                        },
                        new
                        {
                            name = "⏰ Время регистрации",
                            value = $"**Дата:** {DateTime.Now:dd.MM.yyyy HH:mm:ss}",
                            inline = false,
                        }
                    },
                    thumbnail = registrarId != null ? new { url = $"https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars//{registrarId}" } : null,
                    timestamp = DateTime.UtcNow.ToString("o"),
                };

                PrintWarning($"Sending Discord registration notification for clan {clanTag} to webhook: {DiscordWebhookUrl}");
                SendDiscordEmbed(embed);
            }
            catch (Exception ex)
            {
                PrintError($"Error sending Discord registration notification: {ex.Message}");
            }
        }

        private void SendDiscordDestructionMessage(string clanTag, string grid, bool dueToStability)
        {
            if (string.IsNullOrEmpty(DiscordWebhookUrl)) return;

            string title = dueToStability ? "💥 Клан Уничтожен (Потеря Опоры)" : "⚔️ Клан Уничтожен (Рейд)";
            string description = $"Клан **{clanTag}** был уничтожен в квадрате **{grid}**!";
            string reason = dueToStability ? "Потеря опоры (стабильности)" : "Рейд противника";

            object embed = new
            {
                title = title,
                description = description,
                color = dueToStability ? 16776960 : 15158332, // Желтый для потери опоры, красный для рейда
                fields = new[]
                {
                    new
                    {
                        name = "🗺️ Локация",
                        value = $"Квадрат: {grid}",
                        inline = true,
                    },
                    new
                    {
                        name = "💔 Причина",
                        value = reason,
                        inline = true,
                    },
                    new
                    {
                        name = "⏰ Время уничтожения",
                        value = $"Дата: {DateTime.Now:dd.MM.yyyy HH:mm:ss}\nСегодня, в {DateTime.Now:HH:mm}",
                        inline = false,
                    }
                },
                timestamp = DateTime.UtcNow.ToString("o"),
            };

            SendDiscordEmbed(embed);
        }

        private void SendDiscordWarningMessage(string clanTag, string reason, BasePlayer admin)
        {
            if (string.IsNullOrEmpty(DiscordWebhookUrl)) return;

            object embed = new
            {
                title = "⚠️ Административное Предупреждение",
                description = $"Клану **{clanTag}** выдано предупреждение администрацией",
                color = 16776960, // Yellow color
                fields = new[]
                {
                    new
                    {
                        name = "📝 Причина",
                        value = $"**{reason}**",
                        inline = false,
                    },
                    new
                    {
                        name = "👨‍💼 Администратор",
                        value = $"**{admin.displayName}**",
                        inline = true,
                    },
                    new
                    {
                        name = "⏰ Время",
                        value = $"**Дата:** {DateTime.Now:dd.MM.yyyy HH:mm:ss}",
                        inline = false,
                    }
                },
                thumbnail = new
                {
                    url = $"https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars//{admin.UserIDString}",
                },
                timestamp = DateTime.UtcNow.ToString("o"),
            };

            SendDiscordEmbed(embed);
        }

        private void SendDiscordEmbed(object embed)
        {
            try
            {
                string jsonPayload = JsonConvert.SerializeObject(new { embeds = new[] { embed } });
                PrintWarning($"Sending Discord embed with payload: {jsonPayload}");

                webrequest.Enqueue(
                    DiscordWebhookUrl,
                    jsonPayload,
                    (code, response) =>
                    {
                        if (code == 204 || code == 200)
                        {
                            PrintWarning($"Discord message sent successfully. Code: {code}");
                        }
                        else
                        {
                            PrintError($"Failed to send Discord message. Code: {code}, Response: {response}");
                            PrintError($"Webhook URL: {DiscordWebhookUrl}");
                            PrintError($"Payload: {jsonPayload}");
                        }
                    },
                    this,
                    Core.Libraries.RequestMethod.POST,
                    new Dictionary<string, string> { ["Content-Type"] = "application/json" }
                );
            }
            catch (Exception ex)
            {
                PrintError($"Error in SendDiscordEmbed: {ex.Message}");
                PrintError($"Stack trace: {ex.StackTrace}");
            }
        }
        #endregion Discord Integration

        private Boolean CheckRegistration(String clanTag) => _clanByClanTag.ContainsKey(clanTag);

        private static Configuration _config;

        private class Configuration
        {
            [JsonProperty(PropertyName = "Настройки регистрации")]
            public RegisterSettings registerSettings = new();

            [JsonProperty(PropertyName = "Настройки выдачи рейд очков")]
            public RaidPointSettings raidPointSettings = new();

            [JsonProperty(PropertyName = "Настройки маркера на карте")]
            public MapMarkerSettings mapMarkerSettings = new();

            [JsonProperty(PropertyName = "Discord Webhook URL для уведомлений")]
            public string DiscordWebhookUrl = "https://discord.com/api/webhooks/1426130654810083412/K2_2gVE0FUjr_B7H7XG3nC-xNd2q5jokwc0NYIBxH9qlJ7WppVlVIZqpWtgRY89hluVR";

            public VersionNumber Version = new VersionNumber();
        }

        private class RegisterSettings
        {
            [JsonProperty("Минимальное количество очков для регистрации")]
            public Int32 MinPoints = 500;

            [JsonProperty("Минимальное количество обьектов для регистрации")]
            public Int32 MinObject = 500;

            [JsonProperty("Сколько часов после дается на регистрации после вайпа ?")]
            public Int32 Hours = 24;
        }

        private class RaidPointSettings
        {
            [JsonProperty(PropertyName = "Использовать в качестве делителя обьекты ? ( true - обьекты, false - очки )")]
            public Boolean useQualityCeiling = true;

            [JsonProperty(PropertyName = "На сколько делить клановые очки для получения рейд-очков ?")]
            public Single CeilingPoint = 1000;

            [JsonProperty(PropertyName = "На сколько делить обьекты для получения рейд-очков ?")]
            public Single CeilingObject = 500;
        }

        public class MapMarkerSettings
        {
            [JsonProperty(PropertyName = "Цвет маркера (без #)")]
            public String MarkerColorHex = "f3ecad";

            [JsonProperty(PropertyName = "Цвет обводки (без #)")]
            public String OutlineColorHex = "ff3535";

            [JsonProperty(PropertyName = "Прозрачность маркера")]
            public Single MarkerAlpha = 0.5f;
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                _config = Config.ReadObject<Configuration>();
                if (_config == null) throw new Exception();

                if (_config.Version < Version)
                    UpdateConfigValues();

                SaveConfig();
            }
            catch (Exception ex)
            {
                PrintError($"Ваш файл конфигурации содержит ошибку. Использование значений конфигурации по умолчанию.\n{ex}");

                LoadDefaultConfig();
            }
        }

        private void UpdateConfigValues()
        {
            PrintWarning("Обнаружено обновление конфигурации! Обновление значений конфигурации...");

            Configuration baseConfig = new Configuration();

            if (_config.Version != default(VersionNumber))
            {
                //
            }

            _config.Version = Version;
            PrintWarning("Обновление конфигурации завершено!");
        }

        protected override void SaveConfig() => Config.WriteObject(_config);

        protected override void LoadDefaultConfig() => _config = new Configuration();

        #region Popup Notifications
        // Play local success sound for player
        private void RunEffect(BasePlayer player, string effectPath)
        {
            if (player == null || player.Connection == null) return;
            Effect effect = new Effect(effectPath, player, 0, Vector3.zero, Vector3.zero);
            EffectNetwork.Send(effect, player.Connection);
        }

        private void ShowPopupNotification(BasePlayer player, string message, string color = "#FFFFFF")
        {
            if (player == null) return;

            CuiElementContainer container = new CuiElementContainer();

            // Create popup panel
            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0.5 0.8", AnchorMax = "0.5 0.8", OffsetMin = "-300 0", OffsetMax = "300 80" },
                Image = { Color = "0 0 0 0.8", Material = "assets/icons/greyout.mat" }
            }, "Overlay", "WarningPopup");

            // Add message text
            container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "20 10", OffsetMax = "-20 -10" },
                Text = { Text = message, Font = "robotocondensed-bold.ttf", FontSize = 18, Color = HexToRustFormat(color), Align = TextAnchor.MiddleCenter }
            }, "WarningPopup");

            CuiHelper.AddUi(player, container);

            // Auto-remove after 4 seconds
            timer.In(4f, () =>
            {
                if (player != null && player.IsConnected)
                {
                    CuiHelper.DestroyUi(player, "WarningPopup");
                }
            });
        }

        private void ShowWarningPopup(BasePlayer player, string reason, string adminName)
        {
            if (player == null) return;

            CuiElementContainer container = new CuiElementContainer();

            // Create main popup panel
            container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0.5 0.8", AnchorMax = "0.5 0.8", OffsetMin = "-350 0", OffsetMax = "350 150" },
                Image = { Color = "0.8 0.2 0.2 0.9", Material = "assets/icons/greyout.mat" }
            }, "Overlay", "AdminWarningPopup");

            // Add warning icon/title
            container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0.7", AnchorMax = "1 1", OffsetMin = "20 0", OffsetMax = "-20 0" },
                Text = { Text = "⚠️ АДМИНИСТРАТИВНОЕ ПРЕДУПРЕЖДЕНИЕ ⚠️", Font = "robotocondensed-bold.ttf", FontSize = 24, Color = "1 1 1 1", Align = TextAnchor.MiddleCenter }
            }, "AdminWarningPopup");

            // Add reason
            container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0.4", AnchorMax = "1 0.7", OffsetMin = "20 0", OffsetMax = "-20 0" },
                Text = { Text = $"Причина: {reason}", Font = "robotocondensed-regular.ttf", FontSize = 18, Color = "1 1 1 1", Align = TextAnchor.MiddleCenter }
            }, "AdminWarningPopup");

            // Add admin name
            container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0.1", AnchorMax = "1 0.4", OffsetMin = "20 0", OffsetMax = "-20 0" },
                Text = { Text = $"Администратор: {adminName}", Font = "robotocondensed-regular.ttf", FontSize = 16, Color = "0.8 0.8 0.8 1", Align = TextAnchor.MiddleCenter }
            }, "AdminWarningPopup");

            // Add timestamp
            container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0.1", OffsetMin = "20 0", OffsetMax = "-20 0" },
                Text = { Text = $"Время: {DateTime.Now:dd.MM.yyyy HH:mm:ss}", Font = "robotocondensed-regular.ttf", FontSize = 12, Color = "0.6 0.6 0.6 1", Align = TextAnchor.MiddleCenter }
            }, "AdminWarningPopup");

            CuiHelper.AddUi(player, container);

            // Auto-remove after 6 seconds
            timer.In(6f, () =>
            {
                if (player != null && player.IsConnected)
                {
                    CuiHelper.DestroyUi(player, "AdminWarningPopup");
                }
            });
        }
        #endregion
    }
}