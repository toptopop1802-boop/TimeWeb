using System.Collections.Generic;
using System;
using System.Linq;
using Oxide.Game.Rust.Cui;
using Oxide.Core;
using UnityEngine;
using Newtonsoft.Json;

namespace Oxide.Plugins
{
    [Info("KitsUI", "CursorAI", "1.0.0")]
    [Description("UI плагин для отображения серверных наборов (китов)")]
    public class KitsUI : RustPlugin
    {
        private const string UI_NAME = "Frame 5";
		private const string KITS_DATA_PATH = "Kits/KitsList"; // oxide/data/Kits/KitsList.json
		private const string EFFECT_TIMER = "assets/prefabs/weapons/mp5/effects/fire_select.prefab";
		private const string EFFECT_FINISH = "assets/prefabs/misc/xmas/advent_calendar/effects/open_advent.prefab";
		private const string EFFECT_ERROR = "assets/prefabs/weapons/toolgun/effects/repairerror.prefab";
		private const string COOLDOWN_DATA_PATH = "Kits/KitsCooldowns"; // oxide/data/Kits/KitsCooldowns.json
        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();
        private Dictionary<string, Kit> kitsStore = new Dictionary<string, Kit>();
        private readonly Dictionary<string, Vector4> kitRects = new Dictionary<string, Vector4>();
        private readonly Dictionary<ulong, DateTime> commandCooldowns = new Dictionary<ulong, DateTime>();

		// userID -> (kitId -> lastClaimUnixSeconds)
		private readonly Dictionary<ulong, Dictionary<string, long>> kitCooldowns = new Dictionary<ulong, Dictionary<string, long>>();

		// UI cooldown live update timers per player
		private readonly Dictionary<ulong, Timer> uiCooldownTimers = new Dictionary<ulong, Timer>();

		// Buyers management: timed permission kits.strelokbuy
		private const string BUYERS_DATA_PATH = "Kits/StrelokBuyers"; // oxide/data/Kits/StrelokBuyers.json
		private readonly Dictionary<ulong, long> strelokBuyers = new Dictionary<ulong, long>(); // userID -> expiresAtUnixSeconds
		private readonly (ulong userId, TimeSpan duration)[] initialBuyers = new (ulong, TimeSpan)[]
		{
			(76561199218404323UL, TimeSpan.FromDays(7)),
			(76561199443655725UL, TimeSpan.FromDays(7)),
			(76561199652931026UL, TimeSpan.FromDays(7)),
			(76561199028613328UL, TimeSpan.FromDays(14)),
			(76561199069670994UL, TimeSpan.FromDays(14)),
		};
		private Timer buyersCleanupTimer;

        private bool HasSpaceForKit(BasePlayer target, Kit kit, out string reason)
        {
            reason = null;
            if (target == null || kit == null) { reason = "target/kit null"; return false; }

            int needTotal = kit.Items.Count;
            var inv = target.inventory;
            int freeTotal = (inv.containerBelt.capacity - inv.containerBelt.itemList.Count)
                          + (inv.containerWear.capacity - inv.containerWear.itemList.Count)
                          + (inv.containerMain.capacity - inv.containerMain.itemList.Count);
            if (freeTotal < needTotal) { reason = $"total {freeTotal} < {needTotal}"; return false; }
            return true;
        }

        

        #region Configuration

        private Configuration config;

        public class Configuration
        {
            [JsonProperty(PropertyName = "Киты")]
            public Dictionary<string, Kit> Kits { get; set; } = new Dictionary<string, Kit>();

            [JsonProperty(PropertyName = "Настройки")]
            public SettingsData Settings { get; set; } = new SettingsData();

            public class SettingsData
            {
                [JsonProperty(PropertyName = "Глобальный кулдаун (секунды)")]
                public int GlobalCooldownSeconds { get; set; } = 0;

                [JsonProperty(PropertyName = "Переопределять индивидуальные кулдауны")]
                public bool OverrideIndividualCooldowns { get; set; } = false;

                [JsonProperty(PropertyName = "Кулдаун по умолчанию (секунды)")]
                public int DefaultCooldownSeconds { get; set; } = 0;
            }

            public static Configuration GetNewConfiguration()
            {
                // Пустая конфигурация: по умолчанию ни одного кита
                return new Configuration
                {
                    Kits = new Dictionary<string, Kit>(),
                    Settings = new SettingsData()
                };
            }
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                config = Config.ReadObject<Configuration>();
                if (config == null) LoadDefaultConfig();
            }
            catch
            {
                
                LoadDefaultConfig();
            }
            NextTick(SaveConfig);
        }

        protected override void LoadDefaultConfig() => config = Configuration.GetNewConfiguration();
        protected override void SaveConfig() => Config.WriteObject(config);

        #endregion

        // Загрузка/сохранение списка китов из data файла
        private void LoadKitsFromData()
        {
            try
            {
                var dataList = Interface.Oxide.DataFileSystem.ReadObject<List<DataKit>>(KITS_DATA_PATH);
                if (dataList == null)
                {
                    kitsStore = new Dictionary<string, Kit>();
                    
                    return;
                }

                kitsStore = new Dictionary<string, Kit>();
                foreach (var dk in dataList)
                {
                    var id = (dk.Name ?? dk.DisplayName ?? Guid.NewGuid().ToString()).ToLower().Replace(" ", "_");
                    var kit = new Kit
                    {
                        Name = string.IsNullOrEmpty(dk.DisplayName) ? dk.Name : dk.DisplayName,
                        Description = "",
                        CooldownSeconds = (int)Math.Max(0, dk.Cooldown),
                        IsAvailable = !dk.Hide,
                        Permission = string.IsNullOrEmpty(dk.Permission) ? "kits.default" : dk.Permission,
                        CreatedBy = "DataFile",
                        CreatedDate = DateTime.Now,
                        Items = new List<KitItem>()
                    };

                    if (dk.Items != null)
                    {
                        foreach (var di in dk.Items)
                        {
                            var itemId = 0;
                            var def = ItemManager.FindItemDefinition(di.ShortName);
                            if (def != null) itemId = def.itemid;

                            var ki = new KitItem
                            {
                                ItemId = itemId,
                                ShortName = di.ShortName,
                                Amount = di.Amount,
                                DisplayName = def != null ? def.displayName.english : di.ShortName,
                                Container = string.IsNullOrEmpty(di.Container) ? "main" : di.Container,
                                Condition = di.Condition,
                                SkinID = di.SkinID,
                                Blueprint = di.Blueprint,
                                Weapon = di.Weapon != null ? new WeaponData { AmmoType = di.Weapon.ammoType, AmmoAmount = di.Weapon.ammoAmount } : null,
                                Content = di.Content?.Select(c => new ItemContent { ShortName = c.ShortName, Amount = c.Amount, Condition = c.Condition }).ToList()
                            };
                            kit.Items.Add(ki);
                        }
                    }

                    kitsStore[id] = kit;
                }

                
            }
            catch (Exception e)
            {
                kitsStore = new Dictionary<string, Kit>();
                
            }
        }

        private void SaveKitsToData()
        {
            // Сохраняем в формат массива как в KitsList.json
            var list = new List<DataKit>();
            foreach (var pair in kitsStore)
            {
                var k = pair.Value;
                var dk = new DataKit
                {
                    Name = k.Name,
                    DisplayName = k.Name,
                    Amount = 0,
                    Cooldown = k.CooldownSeconds,
                    Hide = !k.IsAvailable,
                    Permission = string.IsNullOrEmpty(k.Permission) ? "kits.default" : k.Permission,
                    Color = "0.55 0.68 0.31 0.6",
                    Items = new List<DataKitItem>()
                };

                foreach (var it in k.Items)
                {
                    dk.Items.Add(new DataKitItem
                    {
                        ShortName = it.ShortName,
                        Amount = it.Amount,
                        Blueprint = it.Blueprint,
                        SkinID = it.SkinID,
                        Container = it.Container,
                        Condition = it.Condition,
                        Weapon = it.Weapon != null ? new DataWeapon { ammoType = it.Weapon.AmmoType, ammoAmount = it.Weapon.AmmoAmount } : null,
                        Content = it.Content?.Select(c => new DataItemContent { ShortName = c.ShortName, Amount = c.Amount, Condition = c.Condition }).ToList()
                    });
                }

                list.Add(dk);
            }

            Interface.Oxide.DataFileSystem.WriteObject(KITS_DATA_PATH, list);
        }

		// ==========================
		//     COOLDOWN MANAGEMENT
		// ==========================
        private void RegisterKitPermissions()
        {
            try
            {
                var perms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kv in kitsStore)
                {
                    var perm = kv.Value?.Permission;
                    if (!string.IsNullOrEmpty(perm)) perms.Add(perm);
                }
                foreach (var perm in perms)
                {
                    var fullPerm = $"KitsUI.{perm}";
                    if (!permission.PermissionExists(fullPerm))
                    {
                        permission.RegisterPermission(fullPerm, this);
                    }
                }
            }
            catch { }
        }
		private void LoadCooldownsFromData()
		{
			try
			{
				var raw = Interface.Oxide.DataFileSystem.ReadObject<Dictionary<string, Dictionary<string, long>>>(COOLDOWN_DATA_PATH);
				kitCooldowns.Clear();
				if (raw != null)
				{
					foreach (var kv in raw)
					{
						if (ulong.TryParse(kv.Key, out var uid))
						{
							kitCooldowns[uid] = new Dictionary<string, long>(kv.Value ?? new Dictionary<string, long>());
						}
					}
				}
			}
			catch
			{
				kitCooldowns.Clear();
			}
		}

		private void SaveCooldownsToData()
		{
			var raw = new Dictionary<string, Dictionary<string, long>>();
			foreach (var kv in kitCooldowns)
			{
				raw[kv.Key.ToString()] = new Dictionary<string, long>(kv.Value);
			}
			Interface.Oxide.DataFileSystem.WriteObject(COOLDOWN_DATA_PATH, raw);
		}

		private int GetEffectiveCooldownSeconds(Kit kit)
		{
			if (kit == null) return 0;
			var s = config?.Settings;
			if (s != null)
			{
				if (s.OverrideIndividualCooldowns && s.GlobalCooldownSeconds > 0)
					return s.GlobalCooldownSeconds;
				if (kit.CooldownSeconds > 0)
					return kit.CooldownSeconds;
				return Math.Max(0, s.DefaultCooldownSeconds);
			}
			return Math.Max(0, kit.CooldownSeconds);
		}

		private double GetRemainingCooldown(BasePlayer player, string kitId)
		{
			if (player == null || string.IsNullOrEmpty(kitId)) return 0;
			if (!kitsStore.TryGetValue(kitId, out var kit)) return 0;
			int cooldown = GetEffectiveCooldownSeconds(kit);
			if (cooldown <= 0) return 0;

			if (!kitCooldowns.TryGetValue(player.userID, out var perUser) || perUser == null)
				return 0;
			if (!perUser.TryGetValue(kitId, out var lastUnix))
				return 0;

			long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
			double remaining = cooldown - (now - lastUnix);
			return remaining > 0 ? remaining : 0;
		}

		private void PlayEffect(BasePlayer player, string effectPath)
		{
			if (player == null || string.IsNullOrEmpty(effectPath)) return;
			Effect effect = new Effect(effectPath, player, 0, Vector3.zero, Vector3.zero);
			EffectNetwork.Send(effect, player.Connection);
		}

		private void ShowError(BasePlayer player, string message)
		{
			if (player == null) return;
			player.ShowToast(GameTip.Styles.Error, message, false, Array.Empty<string>());
			PlayEffect(player, EFFECT_ERROR);
		}

		private void MarkKitClaimed(BasePlayer player, string kitId)
		{
			if (player == null || string.IsNullOrEmpty(kitId)) return;
			if (!kitCooldowns.TryGetValue(player.userID, out var perUser) || perUser == null)
			{
				perUser = new Dictionary<string, long>();
				kitCooldowns[player.userID] = perUser;
			}
			perUser[kitId] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
			SaveCooldownsToData();
		}

		private string FormatShortDuration(double seconds)
		{
			if (seconds <= 0) return "0с";
			var ts = TimeSpan.FromSeconds(Math.Ceiling(seconds));
			if (ts.TotalHours >= 1)
				return $"{(int)ts.TotalHours}ч {ts.Minutes}м";
			if (ts.Minutes >= 1)
				return $"{ts.Minutes}м {ts.Seconds}с";
			return $"{ts.Seconds}с";
		}

		private string FormatHms(double seconds)
		{
			if (seconds < 0) seconds = 0;
			var ts = TimeSpan.FromSeconds(Math.Ceiling(seconds));
			int hours = (int)ts.TotalHours;
			return $"{hours:00}:{ts.Minutes:00}:{ts.Seconds:00}";
		}

        private bool HasKitPermission(BasePlayer player, Kit kit)
        {
            if (player == null || kit == null) return false;
            if (player.IsAdmin) return true;
            if (string.IsNullOrEmpty(kit.Permission)) return true;
            var fullPerm = $"KitsUI.{kit.Permission}";
            // Разрешаем как префиксный, так и "голый" пермишен (на случай, если он выдан группе default без префикса)
            return permission.UserHasPermission(player.UserIDString, fullPerm)
                || permission.UserHasPermission(player.UserIDString, kit.Permission);
        }

        private bool ShouldHideKitForPlayer(BasePlayer player, Kit kit)
        {
            if (player == null || kit == null) return false;
            // Специальное правило: если у игрока есть kits.strelokbuy,
            // то кит с пермишеном kits.strelokfree скрывается из списка
            var kitPerm = (kit.Permission ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(kitPerm))
            {
                var hasBuy = permission.UserHasPermission(player.UserIDString, "kits.strelokbuy")
                              || permission.UserHasPermission(player.UserIDString, "KitsUI.kits.strelokbuy");
                if (hasBuy)
                {
                    var kpLower = kitPerm.ToLowerInvariant();
                    if (kpLower == "kits.strelokfree" || kpLower == "kitsui.kits.strelokfree" || kpLower.EndsWith(".strelokfree"))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

		// ==========================
		//  BUYERS GROUP/PERM MANAGEMENT
		// ==========================
		private void EnsureBuyGroupAndPermission()
		{
			try
			{
				if (!permission.GroupExists("strelokbuy"))
				{
					permission.CreateGroup("strelokbuy", "Strelok Buyers", 0);
				}
				permission.GrantGroupPermission("strelokbuy", "kits.strelokbuy", this);
			}
			catch { }
		}

		private void LoadBuyersFromData()
		{
			try
			{
				var raw = Interface.Oxide.DataFileSystem.ReadObject<Dictionary<string, long>>(BUYERS_DATA_PATH) ?? new Dictionary<string, long>();
				strelokBuyers.Clear();
				foreach (var kv in raw)
				{
					if (ulong.TryParse(kv.Key, out var uid)) strelokBuyers[uid] = kv.Value;
				}
			}
			catch { strelokBuyers.Clear(); }
		}

		private void SaveBuyersToData()
		{
			var raw = new Dictionary<string, long>();
			foreach (var kv in strelokBuyers) raw[kv.Key.ToString()] = kv.Value;
			Interface.Oxide.DataFileSystem.WriteObject(BUYERS_DATA_PATH, raw);
		}

		private void ApplyBuyer(ulong userId)
		{
			var uid = userId.ToString();
			permission.AddUserGroup(uid, "strelokbuy");
			permission.GrantUserPermission(uid, "kits.strelokbuy", this);
		}

		private void RevokeBuyer(ulong userId)
		{
			var uid = userId.ToString();
			permission.RevokeUserPermission(uid, "kits.strelokbuy");
			permission.RemoveUserGroup(uid, "strelokbuy");
		}

		private void CleanupExpiredBuyers()
		{
			long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
			var expired = strelokBuyers.Where(kv => kv.Value > 0 && kv.Value <= now).Select(kv => kv.Key).ToList();
			foreach (var uid in expired)
			{
				RevokeBuyer(uid);
				strelokBuyers.Remove(uid);
			}
			if (expired.Count > 0) SaveBuyersToData();
		}

		private void SeedInitialBuyersIfEmpty()
		{
			if (strelokBuyers.Count > 0) return;
			long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
			foreach (var tpl in initialBuyers)
			{
				long expires = now + (long)tpl.duration.TotalSeconds;
				strelokBuyers[tpl.userId] = expires;
				ApplyBuyer(tpl.userId);
			}
			SaveBuyersToData();
		}

		private bool TryParseDurationString(string text, out TimeSpan duration)
		{
			duration = TimeSpan.Zero;
			if (string.IsNullOrWhiteSpace(text)) return false;
			var s = text.Trim().ToLowerInvariant();
			// normalize Russian words
			s = s.Replace("недель", "неделя").Replace("недели", "неделя").Replace("дней", "день").Replace("дня", "день");
			// compact forms
			if (s.EndsWith("w")) { int n; if (int.TryParse(s.Substring(0, s.Length - 1), out n) && n > 0) { duration = TimeSpan.FromDays(7 * n); return true; } }
			if (s.EndsWith("d")) { int n; if (int.TryParse(s.Substring(0, s.Length - 1), out n) && n > 0) { duration = TimeSpan.FromDays(n); return true; } }
			// english words
			var parts = s.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
			int num;
			if (parts.Length >= 2 && int.TryParse(parts[0], out num) && num > 0)
			{
				var unit = parts[1];
				if (unit.StartsWith("нед" ) || unit.StartsWith("week")) { duration = TimeSpan.FromDays(7 * num); return true; }
				if (unit.StartsWith("дн") || unit == "день" || unit.StartsWith("day")) { duration = TimeSpan.FromDays(num); return true; }
			}
			return false;
		}

		private void StartOrRestartCooldownTimer(BasePlayer player)
		{
			if (player == null) return;
			StopCooldownTimer(player.userID);
			uiCooldownTimers[player.userID] = timer.Every(1f, () =>
			{
				if (player == null || !player.IsConnected || !HasUI(player))
				{
					StopCooldownTimer(player?.userID ?? 0);
					return;
				}
				UpdateKitsCooldownUI(player);
			});
		}

		private void StopCooldownTimer(ulong userId)
		{
			if (userId == 0) return;
			Timer t;
			if (uiCooldownTimers.TryGetValue(userId, out t) && t != null)
			{
				t.Destroy();
			}
			uiCooldownTimers.Remove(userId);
		}

		private void UpdateKitsCooldownUI(BasePlayer player)
		{
			// Обновляем только если контейнер имеется
			foreach (var pair in kitsStore.Where(k => k.Key != "autokit"))
			{
				var kitId = pair.Key;
				double remaining = GetRemainingCooldown(player, kitId);
				var kit = pair.Value;
				bool hasPerm = HasKitPermission(player, kit);

				// Обновить только текст статуса
				CuiHelper.DestroyUi(player, $"KitStatusText_{kitId}");
				Vector4 rect;
				if (!kitRects.TryGetValue(kitId, out rect))
					continue;
				int x = (int)rect.x;
				int yBase = (int)rect.y;
				var text = hasPerm ? (remaining > 0 ? FormatHms(remaining) : "ЗАБРАТЬ") : "НЕТ ДОСТУПА";

				var textEl = new CuiElement()
				{
					Parent = "KitsContent",
					Name = $"KitStatusText_{kitId}",
					Components =
					{
						new CuiTextComponent
						{
							Text = text,
							Align = UnityEngine.TextAnchor.MiddleCenter,
							Color = "0.8156863 0.7764706 0.7411765 1",
							FontSize = 12,
							Font = "robotocondensed-regular.ttf",
						},
						new CuiRectTransformComponent
						{
							AnchorMin = "0 0",
							AnchorMax = "0 0",
							OffsetMin = $"{x + 10} {yBase + 5}",
							OffsetMax = $"{x + 170} {yBase + 35}"
						}
					}
				};
				var cont2 = new CuiElementContainer();
				cont2.Add(textEl);
				CuiHelper.AddUi(player, cont2);

				// Если КД закончился и есть доступ — убедиться, что кнопка есть
				if (hasPerm && remaining <= 0)
				{
					CuiHelper.DestroyUi(player, $"KitTake_{kitId}");
					var btn = new CuiButton()
					{
						Button = { Color = "0 0 0 0", Command = $"kitsui.take {kitId}"},
						RectTransform =
						{
							AnchorMin = "0 0",
							AnchorMax = "0 0",
							OffsetMin = $"{x + 10} {yBase + 5}",
							OffsetMax = $"{x + 170} {yBase + 35}"
						},
						Text = { Text = "", Color = "0 0 0 0" }
					};
					var cont = new CuiElementContainer();
					cont.Add(btn, "KitsContent", $"KitTake_{kitId}");
					CuiHelper.AddUi(player, cont);
				}
				else
				{
					// Удалить кнопку, если на КД
					CuiHelper.DestroyUi(player, $"KitTake_{kitId}");
				}
			}
		}

        public class KitItem
        {
            [JsonProperty(PropertyName = "ID предмета")]
            public int ItemId { get; set; }

            [JsonProperty(PropertyName = "Короткое имя")]
            public string ShortName { get; set; }

            [JsonProperty(PropertyName = "Количество")]
            public int Amount { get; set; }

            [JsonProperty(PropertyName = "Отображаемое имя")]
            public string DisplayName { get; set; }

            [JsonProperty(PropertyName = "Контейнер")]
            public string Container { get; set; } = "main";

            [JsonProperty(PropertyName = "Состояние")]
            public float Condition { get; set; } = 1.0f;

            [JsonProperty(PropertyName = "Скин")]
            public ulong SkinID { get; set; } = 0;

            [JsonProperty(PropertyName = "Чертеж")]
            public int Blueprint { get; set; } = 0;

            [JsonProperty(PropertyName = "Оружие")]
            public WeaponData Weapon { get; set; }

            [JsonProperty(PropertyName = "Модули")]
            public List<ItemContent> Content { get; set; }
        }

        public class WeaponData
        {
            [JsonProperty(PropertyName = "Тип патронов")]
            public string AmmoType { get; set; }

            [JsonProperty(PropertyName = "Количество патронов")]
            public int AmmoAmount { get; set; }
        }

        public class ItemContent
        {
            [JsonProperty(PropertyName = "Короткое имя")]
            public string ShortName { get; set; }

            [JsonProperty(PropertyName = "Количество")]
            public int Amount { get; set; }

            [JsonProperty(PropertyName = "Состояние")]
            public float Condition { get; set; }
        }

        public class Kit
        {
            [JsonProperty(PropertyName = "Название")]
            public string Name { get; set; }

            [JsonProperty(PropertyName = "Описание")]
            public string Description { get; set; }

            [JsonProperty(PropertyName = "Предметы")]
            public List<KitItem> Items { get; set; } = new List<KitItem>();

            [JsonProperty(PropertyName = "Кулдаун (секунды)")]
            public int CooldownSeconds { get; set; }

            [JsonProperty(PropertyName = "Доступен")]
            public bool IsAvailable { get; set; }

            [JsonProperty(PropertyName = "Разрешение")]
            public string Permission { get; set; } = "kits.default";

            [JsonProperty(PropertyName = "Создатель")]
            public string CreatedBy { get; set; }

            [JsonProperty(PropertyName = "Дата создания")]
            public DateTime CreatedDate { get; set; } = DateTime.Now;
        }

        // Формат файла данных KitsList.json
        private class DataKit
        {
            public string Name { get; set; }
            public string DisplayName { get; set; }
            public int Amount { get; set; }
            public double Cooldown { get; set; }
            public bool Hide { get; set; }
            public string Permission { get; set; }
            public string Color { get; set; }
            public List<DataKitItem> Items { get; set; } = new List<DataKitItem>();
        }

        private class DataKitItem
        {
            public string ShortName { get; set; }
            public int Amount { get; set; }
            public int Blueprint { get; set; }
            public ulong SkinID { get; set; }
            public string Container { get; set; } = "main";
            public float Condition { get; set; }
            public int Change { get; set; }
            public bool EnableCommand { get; set; }
            public string CustomImage { get; set; }
            public DataWeapon Weapon { get; set; }
            public List<DataItemContent> Content { get; set; }
        }

        private class DataWeapon
        {
            public string ammoType { get; set; }
            public int ammoAmount { get; set; }
        }

        private class DataItemContent
        {
            public string ShortName { get; set; }
            public float Condition { get; set; }
            public int Amount { get; set; }
        }

        void OnServerInitialized()
        {
            LoadConfig();
            LoadKitsFromData();
			LoadCooldownsFromData();
			RegisterKitPermissions();
			EnsureBuyGroupAndPermission();
			LoadBuyersFromData();
			SeedInitialBuyersIfEmpty();
			// Apply non-expired and remove expired
			long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
			foreach (var kv in strelokBuyers.ToList())
			{
				if (kv.Value > 0 && kv.Value <= now)
				{
					RevokeBuyer(kv.Key);
					strelokBuyers.Remove(kv.Key);
				}
				else
				{
					ApplyBuyer(kv.Key);
				}
			}
			SaveBuyersToData();
			buyersCleanupTimer = timer.Every(3600f, CleanupExpiredBuyers);
        }

        

        private string HexToRustFormat(string hex)
        {
            hex = hex.Replace("#", "");
            var r = int.Parse(hex.Substring(0, 2), System.Globalization.NumberStyles.HexNumber) / 255f;
            var g = int.Parse(hex.Substring(2, 2), System.Globalization.NumberStyles.HexNumber) / 255f;
            var b = int.Parse(hex.Substring(4, 2), System.Globalization.NumberStyles.HexNumber) / 255f;
            return $"{r:F3} {g:F3} {b:F3} 1";
        }

        [ChatCommand("kit")]
        private void KitCommand(BasePlayer player, string command, string[] args)
        {
            var now = DateTime.UtcNow;
            if (commandCooldowns.TryGetValue(player.userID, out var last) && (now - last).TotalSeconds < 1)
            {
                ShowError(player, "Подождите 1 секунду");
                return;
            }
            commandCooldowns[player.userID] = now;

            if (args != null && args.Length > 0)
            {
                var sub = args[0].ToLower();
                if (sub == "give")
                {
                    if (!player.IsAdmin)
                    {
                        player.ShowToast(GameTip.Styles.Error, "У вас нет прав для этой команды", false, Array.Empty<string>());
                        return;
                    }

                    if (args.Length < 3)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Использование: /kit give <kitId> <игрок>", false, Array.Empty<string>());
                        return;
                    }

                    var kitId = args[1].ToLower();
                    var targetQuery = string.Join(" ", args.Skip(2));

                    if (!kitsStore.ContainsKey(kitId))
                    {
                        player.ShowToast(GameTip.Styles.Error, $"Набор '{kitId}' не найден", false, Array.Empty<string>());
                        return;
                    }

                    var target = FindPlayerByNameOrId(targetQuery);
                    if (target == null)
                    {
                        player.ShowToast(GameTip.Styles.Error, $"Игрок '{targetQuery}' не найден", false, Array.Empty<string>());
                        return;
                    }

                    AdminGiveKit(target, kitId);
                    player.ShowToast(GameTip.Styles.Error, $"Вы выдали {target.displayName} набор {kitsStore[kitId].Name}", false, Array.Empty<string>());
                    return;
                }

                if (sub == "create")
                {
                    if (!player.IsAdmin)
                    {
                        player.ShowToast(GameTip.Styles.Error, "У вас нет прав для этой команды", false, Array.Empty<string>());
                        return;
                    }
                    if (args.Length < 2)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Использование: /kit create <название>", false, Array.Empty<string>());
                        return;
                    }
                    var name = string.Join(" ", args.Skip(1));
                    CreateNewKit(player, name);
                    return;
                }

                if (sub == "add")
                {
                    if (!player.IsAdmin)
                    {
                        player.ShowToast(GameTip.Styles.Error, "У вас нет прав для этой команды", false, Array.Empty<string>());
                        return;
                    }
                    if (args.Length < 2)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Использование: /kit add <название>", false, Array.Empty<string>());
                        return;
                    }
                    var name = string.Join(" ", args.Skip(1));
                    CreateNewKit(player, name);
                    return;
                }

                if (sub == "remove")
                {
                    if (!player.IsAdmin)
                    {
                        player.ShowToast(GameTip.Styles.Error, "У вас нет прав для этой команды", false, Array.Empty<string>());
                        return;
                    }
                    if (args.Length < 2)
                    {
                        player.ShowToast(GameTip.Styles.Error, "Использование: /kit remove <название>", false, Array.Empty<string>());
                        return;
                    }
                    var name = string.Join(" ", args.Skip(1));
                    RemoveKit(player, name);
                    return;
                }

				if (sub == "buy")
				{
					if (!player.IsAdmin)
					{
						player.ShowToast(GameTip.Styles.Error, "У вас нет прав", false, Array.Empty<string>());
						return;
					}
					if (args.Length < 3)
					{
						player.ShowToast(GameTip.Styles.Error, "Использование: /kit buy <steamid> <срок>", false, Array.Empty<string>());
						player.ChatMessage("Форматы срока: 1w, 7d, '1 неделя', '14 дней'");
						return;
					}
					ulong sid;
					if (!ulong.TryParse(args[1], out sid))
					{
						player.ShowToast(GameTip.Styles.Error, "Некорректный SteamID", false, Array.Empty<string>());
						return;
					}
					TimeSpan dur;
					if (!TryParseDurationString(string.Join(" ", args.Skip(2)), out dur) || dur.TotalSeconds <= 0)
					{
						player.ShowToast(GameTip.Styles.Error, "Некорректный срок", false, Array.Empty<string>());
						return;
					}
					EnsureBuyGroupAndPermission();
					long nowUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
					long expires = nowUnix + (long)dur.TotalSeconds;
					strelokBuyers[sid] = expires;
					ApplyBuyer(sid);
					SaveBuyersToData();
					player.ChatMessage($"Выдал kits.strelokbuy игроку {sid} до {DateTimeOffset.FromUnixTimeSeconds(expires).UtcDateTime:u}");
					return;
				}

				if (sub == "unbuy")
				{
					if (!player.IsAdmin)
					{
						player.ShowToast(GameTip.Styles.Error, "У вас нет прав", false, Array.Empty<string>());
						return;
					}
					if (args.Length < 2)
					{
						player.ShowToast(GameTip.Styles.Error, "Использование: /kit unbuy <steamid>", false, Array.Empty<string>());
						return;
					}
					ulong sid;
					if (!ulong.TryParse(args[1], out sid))
					{
						player.ShowToast(GameTip.Styles.Error, "Некорректный SteamID", false, Array.Empty<string>());
						return;
					}
					RevokeBuyer(sid);
					strelokBuyers.Remove(sid);
					SaveBuyersToData();
					player.ChatMessage($"Снял kits.strelokbuy у {sid}");
					return;
				}

				if (sub == "buyall")
				{
					if (!player.IsAdmin)
					{
						player.ShowToast(GameTip.Styles.Error, "У вас нет прав", false, Array.Empty<string>());
						return;
					}
					// Reload from data and apply for all non-expired entries
					LoadBuyersFromData();
					EnsureBuyGroupAndPermission();
					long nowUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
					int applied = 0, removed = 0;
					foreach (var kv in strelokBuyers.ToList())
					{
						if (kv.Value > 0 && kv.Value <= nowUnix)
						{
							RevokeBuyer(kv.Key);
							strelokBuyers.Remove(kv.Key);
							removed++;
						}
						else
						{
							ApplyBuyer(kv.Key);
							applied++;
						}
					}
					SaveBuyersToData();
					player.ChatMessage($"Применено: {applied}, удалено просроченных: {removed}");
					return;
				}

				if (sub == "reset")
				{
					if (!player.IsAdmin)
					{
						player.ShowToast(GameTip.Styles.Error, "У вас нет прав для этой команды", false, Array.Empty<string>());
						return;
					}

					// Очистить все кулдауны
					kitCooldowns.Clear();
					SaveCooldownsToData();

					// Уведомить всех: эффекты и тост
					foreach (var p in BasePlayer.activePlayerList)
					{
						PlayEffect(p, EFFECT_FINISH);
						PlayEffect(p, EFFECT_TIMER);
						p.ShowToast(GameTip.Styles.Blue_Long, "Кулдауны китов были сброшены администратором", false, Array.Empty<string>());
					}

					player.ShowToast(GameTip.Styles.Server_Event, "Кулдауны для всех игроков сброшены", false, Array.Empty<string>());
					return;
				}
            }

            // Тоггл UI по умолчанию
            if (HasUI(player))
            {
                DestroyUI(player);
            }
            else
            {
                ShowUI(player);
            }
        }

        private BasePlayer FindPlayerByNameOrId(string query)
        {
            if (string.IsNullOrEmpty(query)) return null;

            if (ulong.TryParse(query, out var steamId))
            {
                var byId = BasePlayer.FindByID(steamId) ?? BasePlayer.FindAwakeOrSleeping(steamId.ToString());
                if (byId != null) return byId;
            }

            BasePlayer exact = BasePlayer.activePlayerList.FirstOrDefault(p => string.Equals(p.displayName, query, StringComparison.OrdinalIgnoreCase));
            if (exact != null) return exact;

            return BasePlayer.activePlayerList.FirstOrDefault(p => p.displayName != null && p.displayName.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private void AdminGiveKit(BasePlayer target, string kitId)
        {
            if (target == null || !kitsStore.ContainsKey(kitId)) return;
			var kit = kitsStore[kitId];

			// Эффект и звук перед выдачей
			PlayEffect(target, EFFECT_FINISH);
			PlayEffect(target, EFFECT_TIMER);

            foreach (var kitItem in kit.Items)
            {
                var item = BuildItem(kitItem);
                if (item != null)
                {
                    var targetContainer = kitItem.Container == "belt" ? target.inventory.containerBelt :
                                          kitItem.Container == "wear" ? target.inventory.containerWear :
                                          target.inventory.containerMain;
                    GiveItem(target, item, 100, targetContainer);
                }
                
            }

            // Записываем кулдаун для всех, включая админов
            MarkKitClaimed(target, kitId);

            // Звук и уведомления для получателя
            target.ShowToast(GameTip.Styles.Error, $"Вам выдан набор: {kit.Name}", false, Array.Empty<string>());
        }

        

        private void RemoveKit(BasePlayer player, string kitName)
        {
            var kitId = kitName.ToLower().Replace(" ", "_");
            string foundKitId = null;
            
            // Ищем кит по ID или по названию
            if (kitsStore.ContainsKey(kitId))
            {
                foundKitId = kitId;
            }
            else
            {
                // Поиск по названию (точное совпадение)
                var kitPair = kitsStore.FirstOrDefault(k => k.Value.Name.Equals(kitName, StringComparison.OrdinalIgnoreCase));
                if (kitPair.Key != null)
                {
                    foundKitId = kitPair.Key;
                }
            }
            
            if (foundKitId == null)
            {
                player.ChatMessage($"Кит с названием '{kitName}' не найден!");
                player.ChatMessage("Доступные киты: " + string.Join(", ", kitsStore.Values.Select(k => k.Name)));
                return;
            }

            var kit = kitsStore[foundKitId];
            
            // Проверяем права на удаление (только создатель или админ)
            if (kit.CreatedBy != player.displayName && !player.IsAdmin)
            {
                player.ChatMessage("Вы можете удалять только свои киты!");
                return;
            }

            kitsStore.Remove(foundKitId);
            SaveKitsToData();
            
            player.ChatMessage($"Кит '{kit.Name}' успешно удален!");
            
            // Обновить UI если открыто
            if (HasUI(player))
            {
                DestroyUI(player);
                ShowUI(player);
            }
        }

        [ConsoleCommand("kitsui.close")]
        private void CloseUICommand(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            DestroyUI(player);
            player.EndLooting(); // Дополнительная гарантия отключения курсора
        }

[ConsoleCommand("kitsui.take")]
        private void TakeKitCommand(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            
            var kitId = arg.GetString(0);
            if (string.IsNullOrEmpty(kitId) || !kitsStore.ContainsKey(kitId))
                return;
                
            TakeKit(player, kitId);
        }


		private void ShowUI(BasePlayer player)
        {
            // Проверяем, есть ли хотя бы один доступный кит
            var hasAnyKit = kitsStore.Any(k => k.Key != "autokit" && HasKitPermission(player, k.Value) && !ShouldHideKitForPlayer(player, k.Value));
            if (!hasAnyKit)
            {
                ShowError(player, "У вас нет доступа ни к одному набору!");
                return;
            }

            // Всегда очищаем UI перед показом нового
            DestroyUI(player);

            var elements = CreateKitsUI(player);
            CuiHelper.AddUi(player, elements);
            playersWithUI.Add(player.userID);

			// Start live cooldown updates
			StartOrRestartCooldownTimer(player);
        }

        private void DestroyUI(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UI_NAME);
            CuiHelper.DestroyUi(player, "Kits");
            CuiHelper.DestroyUi(player, "CloseButton");
            CuiHelper.DestroyUi(player, "KitsContent");
            CuiHelper.DestroyUi(player, "KitsScrollView");
            CuiHelper.DestroyUi(player, "KitsBlur");
            CuiHelper.DestroyUi(player, "KitsHint");
            playersWithUI.Remove(player.userID);
            
            // Принудительно отключаем курсор
            player.EndLooting();

			// Stop live updates
			StopCooldownTimer(player.userID);
        }

        private bool HasUI(BasePlayer player)
        {
            return playersWithUI.Contains(player.userID);
        }

        
        
        
        private void TakeKit(BasePlayer player, string kitId)
        {
            if (!kitsStore.ContainsKey(kitId))
            {
                player.ChatMessage("Набор недоступен!");
                return;
            }
            
            var kit = kitsStore[kitId];
            
            // Проверка прав доступа
            if (!HasKitPermission(player, kit))
            {
                ShowError(player, "У вас нет доступа к этому набору!");
                return;
            }
            
            // Проверка кулдауна
            double remaining = GetRemainingCooldown(player, kitId);
            if (remaining > 0)
            {
                ShowError(player, $"Подождите еще {FormatShortDuration(remaining)}");
                return;
            }
            
            if (!HasSpaceForKit(player, kit, out var reason))
            {
                ShowError(player, "Недостаточно места в инвентаре");
                return;
            }

			// Эффект и звук перед выдачей
			PlayEffect(player, EFFECT_FINISH);
			PlayEffect(player, EFFECT_TIMER);
            
            // Выдача предметов как в оригинальном Kits.cs
            foreach (var kitItem in kit.Items)
            {
                var item = BuildItem(kitItem);
                if (item != null)
                {
                    var targetContainer = kitItem.Container == "belt" ? player.inventory.containerBelt : 
                                        kitItem.Container == "wear" ? player.inventory.containerWear : 
                                        player.inventory.containerMain;
                    
                    // Дебаг информация
                    GiveItem(player, item, 100, targetContainer);
                }
                else
                {
                    
                }
            }
            
			// Mark cooldown usage
			MarkKitClaimed(player, kitId);
			
            player.ShowToast(GameTip.Styles.Error, $"Вы получили набор: {kit.Name}", false, Array.Empty<string>());
            
			// Звуковое уведомление воспроизведено ранее эффектом
			
            // Полностью закрываем все UI после взятия кита, чтобы избежать повторных кликов
            if (HasUI(player))
            {
                DestroyUI(player);
            }
            
        }

        private Item BuildItem(KitItem kitItem)
        {
            Item item = ItemManager.CreateByName(kitItem.ShortName, kitItem.Amount > 1 ? kitItem.Amount : 1, kitItem.SkinID);
            if (item == null) return null;
            
            item.condition = kitItem.Condition;
            
            if (kitItem.Blueprint != 0) 
                item.blueprintTarget = kitItem.Blueprint;
            
            // Восстановить патроны в оружии (как в оригинальном Kits.cs)
            if (kitItem.Weapon != null)
            {
                BaseProjectile weapon = item.GetHeldEntity() as BaseProjectile;
                if (weapon != null)
                {
                    weapon.primaryMagazine.contents = kitItem.Weapon.AmmoAmount;
                    weapon.primaryMagazine.ammoType = ItemManager.FindItemDefinition(kitItem.Weapon.AmmoType);
                }
            }
            
            // Восстановить модули (как в оригинальном Kits.cs)
            if (kitItem.Content != null)
            {
                foreach (var content in kitItem.Content)
                {
                    Item contentItem = ItemManager.CreateByName(content.ShortName, content.Amount);
                    if (contentItem != null)
                    {
                        contentItem.condition = content.Condition;
                        contentItem.MoveToContainer(item.contents);
                    }
                    
                }
            }
            
            return item;
        }

        private void GiveItem(BasePlayer player, Item item, int percent, ItemContainer cont = null)
        {
            if (item == null) return;
            var inv = player.inventory;
            if (UnityEngine.Random.Range(1, 101) <= percent) // 1-100 диапазон
            {
                // Try target container first
                if (cont != null && item.MoveToContainer(cont)) return;

                // Build a randomized order of containers to try
                var containers = new List<ItemContainer> { inv.containerMain, inv.containerBelt, inv.containerWear };
                // Simple shuffle
                for (int i = 0; i < containers.Count; i++)
                {
                    int j = UnityEngine.Random.Range(i, containers.Count);
                    var tmp = containers[i]; containers[i] = containers[j]; containers[j] = tmp;
                }

                foreach (var c in containers)
                {
                    if (c == cont) continue;
                    if (item.MoveToContainer(c)) return;
                }

                // As a last resort, drop
                item.Drop(player.GetCenter(), player.GetDropVelocity());
            }
        }

        private void CreateNewKit(BasePlayer player, string kitName)
        {
            if (string.IsNullOrEmpty(kitName))
            {
                player.ChatMessage("Укажите название кита!");
                return;
            }

            var kitId = kitName.ToLower().Replace(" ", "_");
            
            if (kitsStore.ContainsKey(kitId))
            {
                player.ChatMessage($"Кит с названием '{kitName}' уже существует!");
                return;
            }

            // Создать новый кит с предметами из инвентаря игрока
            var newKit = new Kit
            {
                Name = kitName,
                Description = $"Кит создан игроком {player.displayName}",
                CooldownSeconds = 0,
                IsAvailable = true,
                Permission = "kits.default",
                CreatedBy = player.displayName,
                CreatedDate = DateTime.Now,
                Items = new List<KitItem>()
            };

            // Добавить одежду из containerWear
            foreach (var item in player.inventory.containerWear.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                {
                    newKit.Items.Add(ItemToKit(item, "wear"));
                }
            }

            // Добавить предметы из основного инвентаря
            foreach (var item in player.inventory.containerMain.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                {
                    newKit.Items.Add(ItemToKit(item, "main"));
                }
            }

            // Добавить из пояса
            foreach (var item in player.inventory.containerBelt.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                {
                    newKit.Items.Add(ItemToKit(item, "belt"));
                }
            }

            kitsStore[kitId] = newKit;
            SaveKitsToData();
            if (!string.IsNullOrEmpty(newKit.Permission))
            {
                var fullPerm = $"KitsUI.{newKit.Permission}";
                if (!permission.PermissionExists(fullPerm))
                {
                    permission.RegisterPermission(fullPerm, this);
                }
            }
            
            // Статистика созданного кита
            var wearCount = newKit.Items.Count(i => i.Container == "wear");
            var mainCount = newKit.Items.Count(i => i.Container == "main");
            var beltCount = newKit.Items.Count(i => i.Container == "belt");
            var weaponsWithAmmo = newKit.Items.Count(i => i.Weapon != null);
            var itemsWithModules = newKit.Items.Count(i => i.Content != null && i.Content.Count > 0);
            
            player.ChatMessage($"Кит '{kitName}' успешно создан!");
            player.ChatMessage($"Всего предметов: {newKit.Items.Count}");
            player.ChatMessage($"Одежда: {wearCount} | Инвентарь: {mainCount} | Пояс: {beltCount}");
            if (weaponsWithAmmo > 0)
                player.ChatMessage($"Оружие с патронами: {weaponsWithAmmo}");
            if (itemsWithModules > 0)
                player.ChatMessage($"Предметы с модулями: {itemsWithModules}");
            
            // Обновить UI если открыто
            if (HasUI(player))
            {
                DestroyUI(player);
                ShowUI(player);
            }
        }

        private KitItem ItemToKit(Item item, string container)
        {
            var kitItem = new KitItem
            {
                ItemId = item.info.itemid,
                ShortName = item.info.shortname,
                Amount = item.amount,
                DisplayName = item.info.displayName.english,
                Container = container,
                Condition = item.condition,
                SkinID = item.skin,
                Blueprint = item.blueprintTarget,
                Weapon = null,
                Content = null
            };

            // Сохранить данные оружия (патроны)
            if (item.info.category == ItemCategory.Weapon)
            {
                BaseProjectile weapon = item.GetHeldEntity() as BaseProjectile;
                if (weapon != null)
                {
                    kitItem.Weapon = new WeaponData
                    {
                        AmmoType = weapon.primaryMagazine.ammoType.shortname,
                        AmmoAmount = weapon.primaryMagazine.contents
                    };
                }
            }

            // Сохранить модули (attachments)
            if (item.contents != null && item.contents.itemList.Count > 0)
            {
                kitItem.Content = new List<ItemContent>();
                foreach (var contentItem in item.contents.itemList)
                {
                    kitItem.Content.Add(new ItemContent
                    {
                        ShortName = contentItem.info.shortname,
                        Amount = contentItem.amount,
                        Condition = contentItem.condition
                    });
                }
            }

            return kitItem;
        }

        private CuiElementContainer CreateKitsUI(BasePlayer player)
        {
            // Фильтруем autokit из отображения и проверяем права
            var kitList = kitsStore.Where(k => k.Key != "autokit" && HasKitPermission(player, k.Value) && !ShouldHideKitForPlayer(player, k.Value)).ToList();

            var container = new CuiElementContainer() {
// Размытие фона как в WipeBlock.cs
{
    new CuiPanel()
    {
        Image = { Color = "0 0 0 0.8", Material = "assets/content/ui/uibackgroundblur-ingamemenu.mat" },
        RectTransform = {
            AnchorMin = "0 0",
            AnchorMax = "1 1"
        },
        CursorEnabled = true
    },
    "Overlay",
    "KitsBlur"
},
// Основная невидимая панель без затемнения
{
    new CuiPanel()
    {
        Image = { Color = "0 0 0 0" }, // Полностью прозрачная без блура
        RectTransform = {
            AnchorMin = "0 0",
            AnchorMax = "1 1"
        },
        CursorEnabled = true
    },
    "Overlay",
    "Frame 5"
},
// Кнопка закрытия по клику в любом месте
{
    new CuiButton()
    {
        Button = { Color = "0 0 0 0", Command = "kitsui.close"},
        RectTransform = {
            AnchorMin = "0 0",
            AnchorMax = "1 1"
        },
        Text = { Text = "", Color = "0 0 0 0" }
    },
    "Frame 5",
    "CloseButton"
},
// Контейнер для контента китов
{
    new CuiPanel()
    {
        Image = { Color = "0 0 0 0" },
        RectTransform = {
            AnchorMin = "0.5 0.5",
            AnchorMax = "0.5 0.5",
            OffsetMin = "-380 -150", // width 760, height 300
            OffsetMax = "380 150"
        },
        CursorEnabled = false
    },
    "Frame 5",
    "Kits"
},

            };

            // Рассчитываем размер контента точно под количество китов
            var containerWidth = 760f; // Ширина контейнера Kits (1020-260)
            var kitWidth = 190f; // Ширина одного кита
            var kitsPerView = 4; // Сколько китов помещается на экране
            var startXOffset = 0f; // Центровка при отсутствии скролла
            
            
            
            // Если китов меньше или равно 4 - не используем скролл вообще
            if (kitList.Count <= kitsPerView)
            {
                
                // Обычный контейнер без скролла
                // Центрируем плитки по горизонтали в пределах 760px
                var totalRowWidth = kitList.Count * kitWidth;
                startXOffset = (containerWidth - totalRowWidth) / 2f;
                container.Add(new CuiElement()
                {
                    Parent = "Kits",
                    Name = "KitsContent",
                    Components =
                    {
                         new CuiImageComponent()
                         {
                            Color = "0 0 0 0",
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "1 1",
                            OffsetMin = "0 0",
                            OffsetMax = "0 0"
                         }
                   }
                });
            }
            else
            {
                // Точный размер контента: только нужное количество китов
                var totalContentWidth = kitList.Count * kitWidth;
                
                
                // Добавляем скролл-контейнер
                container.Add(new CuiElement()
                {
                    Parent = "Kits",
                    Name = "KitsScrollView", 
                    Components =
                    {
                        new CuiScrollViewComponent
                        {
                            ContentTransform = new CuiRectTransform
                            {
                                AnchorMin = "0 0",
                                AnchorMax = "0 0",
                                OffsetMin = "0 0",
                                OffsetMax = $"{totalContentWidth} 240"
                            },
                            Horizontal = true,
                            Vertical = false,
                            MovementType = UnityEngine.UI.ScrollRect.MovementType.Clamped,
                            Elasticity = 0.1f,
                            Inertia = true,
                            DecelerationRate = 0.135f,
                            ScrollSensitivity = 30f,
                            HorizontalScrollbar = new CuiScrollbar
                            {
                                Size = 8f,
                                AutoHide = false,
                                HandleColor = "0 0 0 0",
                                HighlightColor = "0 0 0 0",
                                PressedColor = "0 0 0 0",
                                TrackColor = "0 0 0 0"
                            }
                        },
                        new CuiRectTransformComponent
                        {
                            AnchorMin = "0 0",
                            AnchorMax = "1 1",
                            OffsetMin = "0 0",
                            OffsetMax = "0 0"
                        }
                    }
                });

                container.Add(new CuiElement()
                {
                    Parent = "KitsScrollView",
                    Name = "KitsContent",
                    Components =
                    {
                         new CuiImageComponent()
                         {
                            Color = "0 0 0 0",
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "1 1",
                            OffsetMin = "0 0",
                            OffsetMax = "0 0"
                         }
                   }
                });
            }

            // Подсказка под GUI для горизонтального скролла
            if (kitList.Count > kitsPerView)
            {
                container.Add(new CuiElement()
                {
                    Parent = "Frame 5",
                    Name = "KitsHint",
                    Components =
                    {
                        new CuiTextComponent()
                        {
                            Text = "Листайте ЛКМ влево/вправо",
                            Align = TextAnchor.MiddleCenter,
                            Color = "0.8156863 0.7764706 0.7411765 0.9",
                            FontSize = 12,
                            Font = "robotocondensed-regular.ttf",
                        },
                        new CuiRectTransformComponent()
                        {
                            AnchorMin = "0.5 0.5",
                            AnchorMax = "0.5 0.5",
                            OffsetMin = "-300 -180",
                            OffsetMax = "300 -160"
                        }
                    }
                });
            }

            // Отображаем все киты
            kitRects.Clear();
            for (int i = 0; i < kitList.Count; i++)
            {
                var kit = kitList[i];
                var kitId = kit.Key;
                var kitData = kit.Value;
                var x = (int)((startXOffset > 0 ? startXOffset : 0) + i * 190); // центрируем при отсутствии скролла
                var yBase = 30;   // Смещение вверх, чтобы центровать карты по вертикали (высота панели 300, карта 240)
                // Сохраняем позицию рамки кита
                kitRects[kitId] = new Vector4(x, yBase, x + 180, yBase + 240);

				var remaining = GetRemainingCooldown(player, kitId);
				var hasPerm = HasKitPermission(player, kitData);
				var canTake = hasPerm && remaining <= 0;
                
                // Рамка кита
                var frameColor = canTake ? "0.4117647 0.49411765 0.27058825 0.8" : "0.8156863 0.7764706 0.7411765 0.5";
                container.Add(new CuiElement()
                {
                    Parent = "KitsContent",
                    Name = $"KitCard_{kitId}",
                    Components =
                    {
                         new CuiImageComponent()
                         {
                            Color = frameColor,
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "0 0",
                             OffsetMin = $"{x} {yBase}",
                             OffsetMax = $"{x + 180} {yBase + 240}"
                         }
                   }
                });

                // Удален просмотр состава

                // Название кита
                container.Add(new CuiElement()
                {
                    Parent = "KitsContent",
                    Name = $"KitName_{kitId}",
                    Components =
                    {
                         new CuiTextComponent()
                         {
                            Text = kitData.Name.ToUpper(),
                            Align = UnityEngine.TextAnchor.MiddleCenter,
                            Color = "0.8156863 0.7764706 0.7411765 1",
                            FontSize = 15,
                            Font = "robotocondensed-bold.ttf",
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "0 0",
                             OffsetMin = $"{x} {yBase + 81}",
                             OffsetMax = $"{x + 180} {yBase + 108}"
                         }
                   }
                });

                // Статус/кнопка
                var statusBgColor = canTake ? "0.4117647 0.49411765 0.27058825 1" : "0.34509805 0.34509805 0.3529412 1";
                container.Add(new CuiElement()
                {
                    Parent = "KitsContent",
                    Name = $"KitStatusBg_{kitId}",
                    Components =
                    {
                         new CuiImageComponent()
                         {
                            Color = statusBgColor,
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "0 0",
                             OffsetMin = $"{x + 10} {yBase + 5}",
                             OffsetMax = $"{x + 170} {yBase + 35}"
                         }
                   }
                });

				var statusText = canTake ? "ЗАБРАТЬ" : (hasPerm ? FormatHms(remaining) : "НЕТ ДОСТУПА");
				var statusTextColor = canTake ? "0.65882355 0.7607843 0.47058824 1" : "0.8156863 0.7764706 0.7411765 1";
                container.Add(new CuiElement()
                {
                    Parent = "KitsContent",
                    Name = $"KitStatusText_{kitId}",
                    Components =
                    {
                         new CuiTextComponent()
                         {
                            Text = statusText,
                            Align = UnityEngine.TextAnchor.MiddleCenter,
                            Color = statusTextColor,
                            FontSize = 12,
                            Font = "robotocondensed-regular.ttf",
                         },
                         new CuiRectTransformComponent()
                         {
                            AnchorMin = "0 0",
                            AnchorMax = "0 0",
                             OffsetMin = $"{x + 10} {yBase + 5}",
                             OffsetMax = $"{x + 170} {yBase + 35}"
                         }
                   }
                });

                if (canTake)
                {
                    container.Add(new CuiButton()
                    {
                        Button = { Color = "0 0 0 0", Command = $"kitsui.take {kitId}"},
                        RectTransform = {
                            AnchorMin = "0 0",
                            AnchorMax = "0 0",
                            OffsetMin = $"{x + 10} {yBase + 5}",
                            OffsetMax = $"{x + 170} {yBase + 35}"
                        },
                        Text = { Text = "", Color = "0 0 0 0" }
                    },
                    "KitsContent", $"KitTake_{kitId}");
                }

                // Иконка первого предмета
                if (kitData.Items.Count > 0)
                {
                    var firstItem = kitData.Items[0];
                    var itemDef = ItemManager.FindItemDefinition(firstItem.ShortName) ?? ItemManager.FindItemDefinition(firstItem.ItemId);
                    if (itemDef != null)
                    {
                        container.Add(new CuiElement()
                        {
                            Parent = "KitsContent",
                            Name = $"KitIcon_{kitId}",
                            Components =
                            {
                                 new CuiImageComponent()
                                 {
                                    ItemId = itemDef.itemid,
                                 },
                                 new CuiRectTransformComponent()
                                 {
                                    AnchorMin = "0 0",
                                    AnchorMax = "0 0",
                                     OffsetMin = $"{x + 40} {yBase + 120}",
                                     OffsetMax = $"{x + 140} {yBase + 220}"
                                     }
                               }
                            });
                        }
                    }
            }

            return container;
        }

        

        private void CloneToAutokit(BasePlayer player)
        {
            // Создаем autokit если его нет
            if (!kitsStore.ContainsKey("autokit"))
            {
                kitsStore["autokit"] = new Kit
                {
                    Name = "АВТОКИТ",
                    Description = "Автоматически выдается при спавне",
                    CooldownSeconds = 0,
                    IsAvailable = true,
                    CreatedBy = "System",
                    Items = new List<KitItem>()
                };
            }

            var autokit = kitsStore["autokit"];
            autokit.Items.Clear();

            // Копируем все предметы игрока
            foreach (var item in player.inventory.containerWear.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                    autokit.Items.Add(ItemToKit(item, "wear"));
            }

            foreach (var item in player.inventory.containerMain.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                    autokit.Items.Add(ItemToKit(item, "main"));
            }

            foreach (var item in player.inventory.containerBelt.itemList.ToList())
            {
                if (item != null && item.amount > 0)
                    autokit.Items.Add(ItemToKit(item, "belt"));
            }

            SaveKitsToData();
            
            var wearCount = autokit.Items.Count(i => i.Container == "wear");
            var mainCount = autokit.Items.Count(i => i.Container == "main");
            var beltCount = autokit.Items.Count(i => i.Container == "belt");

            player.ChatMessage("Autokit обновлен!");
            player.ChatMessage($"Скопировано предметов: {autokit.Items.Count}");
            player.ChatMessage($"Одежда: {wearCount} | Инвентарь: {mainCount} | Пояс: {beltCount}");
        }

        private void ClearAutokit(BasePlayer player)
        {
            if (kitsStore.ContainsKey("autokit"))
            {
                kitsStore["autokit"].Items.Clear();
                SaveKitsToData();
                player.ChatMessage("Autokit очищен!");
            }
            else
            {
                player.ChatMessage("Autokit не существует!");
            }
        }

        private void ShowAutokitContents(BasePlayer player)
        {
            if (!kitsStore.ContainsKey("autokit"))
            {
                player.ChatMessage("Autokit не существует!");
                return;
            }

            var autokit = kitsStore["autokit"];
            
            if (autokit.Items.Count == 0)
            {
                player.ChatMessage("Autokit пустой!");
                return;
            }

            player.ChatMessage("Содержимое autokit:");
            
            var wearItems = autokit.Items.Where(i => i.Container == "wear").ToList();
            var mainItems = autokit.Items.Where(i => i.Container == "main").ToList();
            var beltItems = autokit.Items.Where(i => i.Container == "belt").ToList();

            if (wearItems.Count > 0)
            {
                player.ChatMessage("Одежда:");
                foreach (var item in wearItems)
                    player.ChatMessage($"  - {item.DisplayName} x{item.Amount}");
            }

            if (mainItems.Count > 0)
            {
                player.ChatMessage("Инвентарь:");
                foreach (var item in mainItems)
                    player.ChatMessage($"  - {item.DisplayName} x{item.Amount}");
            }

            if (beltItems.Count > 0)
            {
                player.ChatMessage("Пояс:");
                foreach (var item in beltItems)
                    player.ChatMessage($"  - {item.DisplayName} x{item.Amount}");
            }
        }

        private void SetGlobalCooldown(BasePlayer player, int seconds)
        {
            config.Settings.GlobalCooldownSeconds = seconds;
            SaveConfig();
            
            if (seconds == 0)
            {
                player.ChatMessage("Глобальный кулдаун отключен. Используются индивидуальные кулдауны китов.");
            }
            else
            {
                player.ChatMessage($"Глобальный кулдаун установлен: {seconds} секунд");
                if (config.Settings.OverrideIndividualCooldowns)
                {
                    player.ChatMessage("Переопределение включено - все киты будут использовать этот кулдаун.");
                }
                else
                {
                    player.ChatMessage("Переопределение выключено - применится к китам без своего кулдауна.");
                }
            }
        }

        private void ShowCooldownInfo(BasePlayer player)
        {
            player.ChatMessage("=== НАСТРОЙКИ КУЛДАУНА ===");
            player.ChatMessage($"Глобальный кулдаун: {config.Settings.GlobalCooldownSeconds} секунд");
            player.ChatMessage($"Переопределение индивидуальных: {(config.Settings.OverrideIndividualCooldowns ? "включено" : "выключено")}");
            player.ChatMessage($"Кулдаун по умолчанию: {config.Settings.DefaultCooldownSeconds} секунд");
            
            // Показать количество затронутых китов
            var affectedKits = 0;
            var totalKits = kitsStore.Count(k => k.Key != "autokit");
            
            if (config.Settings.OverrideIndividualCooldowns)
            {
                affectedKits = totalKits;
            }
            else if (config.Settings.GlobalCooldownSeconds > 0)
            {
                // Подсчитываем киты без собственного кулдауна или с кулдауном 0
                affectedKits = kitsStore.Count(k => k.Key != "autokit" && k.Value.CooldownSeconds == 0);
            }
            
            player.ChatMessage($"Китов всего: {totalKits} | Затронуто: {affectedKits}");
            
            if (config.Settings.GlobalCooldownSeconds == 0)
            {
                player.ChatMessage("Статус: Используются индивидуальные кулдауны китов");
            }
            else if (config.Settings.OverrideIndividualCooldowns)
            {
                player.ChatMessage($"Статус: ВСЕ киты используют {config.Settings.GlobalCooldownSeconds} секунд");
            }
            else
            {
                player.ChatMessage($"Статус: {affectedKits} китов используют {config.Settings.GlobalCooldownSeconds} секунд");
            }
        }

        void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            playersWithUI.Remove(player.userID);
			StopCooldownTimer(player.userID);
        }

        void OnPlayerRespawned(BasePlayer player)
        {
            if (player == null) return;
            if (!kitsStore.ContainsKey("autokit")) return;
            player.inventory.Strip();
            AdminGiveKit(player, "autokit");
        }

        void Unload()
        {
			// stop all timers
			foreach (var kv in uiCooldownTimers.ToList())
			{
				if (kv.Value != null) kv.Value.Destroy();
			}
			uiCooldownTimers.Clear();
			if (buyersCleanupTimer != null) buyersCleanupTimer.Destroy();
			SaveCooldownsToData();
            foreach (var player in BasePlayer.activePlayerList)
            {
                CuiHelper.DestroyUi(player, UI_NAME);
                CuiHelper.DestroyUi(player, "Kits");
                CuiHelper.DestroyUi(player, "CloseButton");
                CuiHelper.DestroyUi(player, "KitsBlur");
                CuiHelper.DestroyUi(player, "KitsHint");
                
                // Принудительно отключаем курсор
                player.EndLooting();
            }
            
            playersWithUI.Clear();
        }
    }
} 
