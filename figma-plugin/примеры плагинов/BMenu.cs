using Oxide.Core.Plugins;
using UnityEngine;
using System;
using Oxide.Game.Rust.Cui;
using System.Linq;
using Newtonsoft.Json;
using System.Collections.Generic;
		   		 		  						  	   		  	 				  		  		   		 		  		 	
namespace Oxide.Plugins
{
    [Info("BMenu", "King", "1.0.0")]
    class BMenu : RustPlugin
    {
		[PluginReference] private Plugin? ImageLibrary = null, IQFakeActive = null, FGS = null;

		private Dictionary<UInt64, DateTime> _cooldownPlayer = new Dictionary<UInt64, DateTime>();
		private void GUIMenuInfo(BasePlayer player)
		{
            CuiElementContainer container = new CuiElementContainer();
			
			container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-12 -50", OffsetMax = "210 6.5" },
                Text = { Text = string.Format(lang.GetMessage("TITLE", this, player.UserIDString), online, maxplayers, joining, sleeping, time), Align = TextAnchor.UpperLeft, FontSize = 13, Color = "1 1 1 1" }
            }, ".MenuGUI", ".MenuInfoGUI", ".MenuInfoGUI");	
			
			CuiHelper.AddUi(player, container);
		}

        protected override void LoadConfig()
        {
            base.LoadConfig();
			
			try
			{
				config = Config.ReadObject<MenuConfig>(); 
			}
			catch
			{
				PrintWarning(LanguageEnglish ? "Configuration read error! Creating a default configuration!" : "Ошибка чтения конфигурации! Создание дефолтной конфигурации!");
				LoadDefaultConfig();
			}
			
			SaveConfig();
        }
		
        private void InitializeLang()
        {
			Dictionary<string, string> langen = new Dictionary<string, string>
			{
				["TITLE"] = "\n<size=12> {0}</size>",
				["AddOPEN"] = "MORE BUTTONS",
				["AddCLOSE"] = "CLOSE"
			};			
			
			foreach(var button in config.Button)
			{
				langen.Add(button.Key, "MENU");
			}			
			
			foreach(var button in config.ButtonAdd)
			{
				langen.Add(button.Key, "MENU");
			}
			
			foreach(var plugininfo in config.PluginsInfo)
			{
				langen.Add(plugininfo.PluginName, "BALANCE: {0}$");
			}
            lang.RegisterMessages(langen, this);
        }

		public int maxplayers, online, joining, sleeping;
		private void GUIAddButtonOpen(BasePlayer player)
		{
			CuiElementContainer container = new CuiElementContainer();
			CuiHelper.AddUi(player, container);
		}

        private MenuConfig config;

		int FakeOnline => (int)IQFakeActive?.Call("GetOnline");
				
		private void OnServerInitialized()	
		{
			ImageLibrary?.Call("AddImage", config.Logo.LogoURL, ".LogoIMG");
			ImageLibrary?.Call("AddImage", "https://i.postimg.cc/DzSpqCdd/Group-1-1.png", $"{Name}.fonimage");
			ImageLibrary?.Call("AddImage", "https://gspics.org/images/2025/04/06/Isrpqj.png", $"{Name}.menubutton");
			ImageLibrary?.Call("AddImage", "https://gspics.org/images/2025/04/06/Isr2hm.png", $"{Name}.storebutton");
			
			int x = 0;
			
			foreach(var image in config.ButtonP)
			{
				if(!String.IsNullOrEmpty(image.LinkImageURL)) ImageLibrary?.Call("AddImage", image.LinkImageURL, ".Button_P" + x);
				x++;
			}
			
			foreach(var image in config.Event.Events) ImageLibrary?.Call("AddImage", image.Value.EventURL, $".{image.Key}");

			Update();
			BasePlayer.activePlayerList.ToList().ForEach(OnPlayerConnected);
			
			if(config.Setting.Reload)
			    timer.Every(config.Setting.IReload, () => {
			        foreach(var i in players)
				    {
					    GUIMenuInfo(i);
						
						if(config.Setting.AEvents)
					        GUIEvent(i);
						
						if(config.Setting.APIuginsInfo && config.Setting.ReloadPluginsInfo) 
				            GUIPluginsInfo(i);
				    }
			    });
			InitializeLang();
		}

		private Dictionary<BasePlayer, DateTime> Cooldowns = new Dictionary<BasePlayer, DateTime>();
		private List<BasePlayer> players = new List<BasePlayer>();
        protected override void SaveConfig() => Config.WriteObject(config);
		
		private void GUIEvent(BasePlayer player)
		{
            CuiElementContainer container = new CuiElementContainer();
			
			container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = "0 1", AnchorMax = "0 1", OffsetMin = "112.25 -90", OffsetMax = "242.75 -62.5" },
                Image = { Color = config.Event.EMenuColor, Material = config.Event.EMenuMaterial }
            }, ".MenuGUI", ".EventGUI", ".EventGUI");
			
			int count = config.Event.Events.Count;
			
			foreach(var i in config.Event.Events) 
			{
				double offset = -(11.25 * count--) - (1.5 * count--);
				
				container.Add(new CuiPanel 
                { 
                    RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{offset} -11.25", OffsetMax = $"{offset + 22.5} 11.25" },
                    Image = { Color = config.Event.EBackgroundColor }
                }, ".EventGUI", $".{i.Key}");
				
				container.Add(new CuiPanel 
				{
					RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMin = "2.5 2.5", OffsetMax = "-2.5 -2.5" },
					Image = { Png = (string) ImageLibrary?.Call("GetImage", $".{i.Key}"), Color = _activeevents[i.Key] ? i.Value.EventAColor : i.Value.EventDColor }
				}, $".{i.Key}");
			}  
			
			CuiHelper.AddUi(player, container); 
		}
		protected override void LoadDefaultConfig() => config = MenuConfig.GetNewConfiguration();
		
		private List<BaseNetworkable> _events = new List<BaseNetworkable>();
		
		private void Update()
		{
			maxplayers = ConVar.Server.maxplayers;
			online = config.Setting.FakeOnline == 1 && IQFakeActive ? FakeOnline : config.Setting.FakeOnline == 2 && FGS ? BasePlayer.activePlayerList.Count + (int)FGS?.CallHook("getFakes") : BasePlayer.activePlayerList.Count;
			joining = ServerMgr.Instance.connectionQueue.Joining;
			sleeping = BasePlayer.sleepingPlayerList.Count;
			time = TOD_Sky.Instance.Cycle.DateTime.ToString(config.Setting.TimeFormat);
			
			timer.Once(config.Setting.IReload, () => Update());
		}
		
		void SyncReservedFinish()
        {
            PrintWarning(LanguageEnglish ? $"{Name} - successfully synced with IQFakeActive" : $"{Name} - успешно синхронизирована с IQFakeActive");
            PrintWarning("=============SYNC==================");
        }
		
		private void DestroyUiMenu(BasePlayer player, bool offlogo = true)
		{
			if(config.Setting.Reload)
				
			players.Remove(player);
			
			CuiHelper.DestroyUi(player, ".MenuGUI");
			CuiHelper.DestroyUi(player, ".AddButton_Open");
			CuiHelper.DestroyUi(player, ".AddButton_Close");
			
			if(offlogo)
				GUILogo(player);
		}
 
        private class MenuConfig
        {		
			
			public static MenuConfig GetNewConfiguration()
            {
                return new MenuConfig
                {
                    Setting = new GeneralSetting
                    {
						Connect = false,
						APIuginsInfo = false,
						AEvents = true,
						Reload = false,
						ReloadPluginsInfo = false,
						IReload = 12.5f,
						FakeOnline = 0,
						TimeFormat = "HH:mm"
                    },
					Logo = new LogoSetting
					{
						LogoURL = "https://gspics.org/images/2025/01/07/ICd6LX.png",
						LogoColor = "1 1 1 1",
                        LogoMaterial = "assets/icons/greyout.mat",
						AnchorMin = "0 1",
						AnchorMax = "0 1",
						OffsetMin = "10 -78",
						OffsetMax = "80 -8",
						MMOffsetMin = "10 -178",
						MMOffsetMax = "80 -108"
					},
                    Menu = new MenuSetting
                    {
						MenuColor = "1 0.2702794 0 0.502794",
						MenuMaterial = "assets/icons/greyout.mat",
						ButtonColor = "0.21702794 0.22102794 0.20902794 0.7502794",
						ButtonTextColor = "1 1 1 1",
						LineColor = "1 1 1 1",
						ButtonSize = 9,
						Mission = false,
						CloseMenu = false,
						MAnchorMin = "0 1",
						MAnchorMax = "0 1",
						MOffsetMin = "40 -65.2",
						MOffsetMax = "230 -15.6",
						MMOffsetMin = "45 -172.5",
						MMOffsetMax = "400 -112.5",						
						PAnchorMin = "0 1",
						PAnchorMax = "0 1",
						POffsetMin = "357.5 -60",
						POffsetMax = "445 0"
                    },
					Button = new Dictionary<string, string>
					{
						["REWARD"] = "chat.say /reward",
			            ["CALENDAR"] = "chat.say /calendar",
			            ["SHOP"] = "chat.say /s",
			            ["CRAFT"] = "chat.say /craft",  
			            ["INFO"] = "chat.say /info" 
					},					
					ButtonP = new List<ButtonPlus>
					{
						new ButtonPlus("store", "", "assets/icons/open.png"),
						new ButtonPlus("chat.say /s", "https://i.ibb.co/ykDPJ4B/GRZseo8.png", "assets/icons/community_servers.png"),
						new ButtonPlus("chat.say /stats", "", "assets/icons/market.png")
					},
					ButtonAdd = new Dictionary<string, string>
					{
						["KIT_VIP"] = "chat.say \"/kit vip\"",
						["KIT_PREM"] = "chat.say \"/kit premium\"",
						["KIT_ELITE"] = "chat.say \"/kit elite\"",
						["KIT_GOLD"] = "chat.say \"/kit gold\"",
						["LEVEL"] = "chat.say /level"
					},
					Event = new EventsSetting 
					{
						EMenuColor = "1 0.2702794 0 0.502794",
						EMenuMaterial = "assets/icons/greyout.mat",
						EBackgroundColor = "0.217 0.221 0.209 0.75",
						Events = new Dictionary<string, EventSetting>
						{
							["CargoPlane"] = new EventSetting
							{
								EventURL = "https://i.ibb.co/m6Fvdn1/01.png",
								EventAColor = "1 0.5 0.5 1",
								EventDColor = "1 1 1 1"
							},
							["BaseHelicopter"] = new EventSetting
							{
								EventURL = "https://i.ibb.co/Sf0w95T/03.png",
								EventAColor = "1 0.5 1 1",
								EventDColor = "1 1 1 1"
							},
				            ["CargoShip"] = new EventSetting
						    {
							    EventURL = "https://i.ibb.co/LvRq2X3/02.png",
							    EventAColor = "0.5 0.5 1 1",
							    EventDColor = "1 1 1 1"
						    },
							["CH47Helicopter"] = new EventSetting
							{
						    	EventURL = "https://i.ibb.co/DCcp6Td/04.png",
						    	EventAColor = "0.5 1 1 1",
						    	EventDColor = "1 1 1 1"
						    },							
							["BradleyAPC"] = new EventSetting
							{
								EventURL = "https://i.ibb.co/5L6qYR4/05.png",
								EventAColor = "1 1 0.5 1",
								EventDColor = "1 1 1 1"
							}												
						}
					},
					PluginsInfo = new List<PluginsInfoSetting>
					{
						new PluginsInfoSetting("XShop", "API_GetBalance", "player"),
						new PluginsInfoSetting("XLevels", "API_GetLevel", "player")
					}
				};
			}
			[JsonProperty(LanguageEnglish ? "Settings menu" : "Настройка меню")]
            public MenuSetting Menu;

            internal class EventsSetting	
			{
				[JsonProperty(LanguageEnglish ? "Event menu color" : "Цвет меню ивентов")] public string EMenuColor;
				[JsonProperty(LanguageEnglish ? "Event menu material" : "Материал меню ивентов")] public string EMenuMaterial;
				[JsonProperty(LanguageEnglish ? "Event icons background color" : "Цвет фона иконок ивентов")] public string EBackgroundColor;
				
				[JsonProperty(LanguageEnglish ? "Setting up event icons" : "Настройка иконок ивентов")]
                public Dictionary<string, EventSetting> Events; 
			}            
			[JsonProperty(LanguageEnglish ? "Settings events" : "Настройка ивентов")]
            public EventsSetting Event;
		    
            internal class MenuSetting
			{
				[JsonProperty(LanguageEnglish ? "Menu color" : "Цвет меню")] public string MenuColor;
				[JsonProperty(LanguageEnglish ? "Menu material" : "Материал меню")] public string MenuMaterial;
				[JsonProperty(LanguageEnglish ? "Button color" : "Цвет кнопок")] public string ButtonColor;
				[JsonProperty(LanguageEnglish ? "Button text color" : "Цвет текста кнопок")] public string ButtonTextColor;
				[JsonProperty(LanguageEnglish ? "Side line color" : "Цвет боковых линий")] public string LineColor;
				[JsonProperty(LanguageEnglish ? "Button text size" : "Размер текста кнопок")] public int ButtonSize;
				[JsonProperty(LanguageEnglish ? "Close the menu after pressing one of the buttons" : "Закрывать меню после нажатия одной из кнопок")] public bool CloseMenu;
				[JsonProperty(LanguageEnglish ? "Move the menu/logo when the mission is active" : "Сдвинуть меню/лого при активной мисси")] public bool Mission;
				[JsonProperty(LanguageEnglish ? "Menu - AnchorMin" : "Меню - AnchorMin")] public string MAnchorMin;
                [JsonProperty(LanguageEnglish ? "Menu - AnchorMax" : "Меню - AnchorMax")] public string MAnchorMax;
                [JsonProperty(LanguageEnglish ? "Menu - OffsetMin" : "Меню - OffsetMin")] public string MOffsetMin;
                [JsonProperty(LanguageEnglish ? "Menu - OffsetMax" : "Меню - OffsetMax")] public string MOffsetMax;
                [JsonProperty(LanguageEnglish ? "Move menu - OffsetMin" : "Сдвинуть меню - OffsetMin")] public string MMOffsetMin;
                [JsonProperty(LanguageEnglish ? "Move menu - OffsetMax" : "Сдвинуть меню - OffsetMax")] public string MMOffsetMax;				
				[JsonProperty(LanguageEnglish ? "Plugin info - AnchorMin" : "Инфа плагинов - AnchorMin")] public string PAnchorMin;
                [JsonProperty(LanguageEnglish ? "Plugin info - AnchorMax" : "Инфа плагинов - AnchorMax")] public string PAnchorMax;
                [JsonProperty(LanguageEnglish ? "Plugin info - OffsetMin" : "Инфа плагинов - OffsetMin")] public string POffsetMin;
                [JsonProperty(LanguageEnglish ? "Plugin info - OffsetMax" : "Инфа плагинов - OffsetMax")] public string POffsetMax;
			}
            [JsonProperty(LanguageEnglish ? "Settings buttons [ Key_text | Command ] - [ Text setting in oxide/lang ]" : "Настройка кнопок [ Ключ_текста | Команда ] - [ Настройка текста в oxide/lang ]")] 
            public Dictionary<string, string> Button;

		    internal class EventSetting
			{
				[JsonProperty(LanguageEnglish ? "Link to event image" : "Ссылка на картинку ивента")] public string EventURL;
				[JsonProperty(LanguageEnglish ? "Active event color" : "Цвет активного ивента")] public string EventAColor;
				[JsonProperty(LanguageEnglish ? "Inactive event color" : "Цвет неактивного ивента")] public string EventDColor;
			}	 
		    internal class GeneralSetting
			{
                [JsonProperty(LanguageEnglish ? "Update menu [ Only the open menu is updated ]" : "Обновлять меню [ Обновляется только открытое меню ]")] public bool Reload;
                [JsonProperty(LanguageEnglish ? "Display information of other plugins" : "Отображать информацию других плагинов")] public bool APIuginsInfo;
                [JsonProperty(LanguageEnglish ? "Show events" : "Отображать ивенты")] public bool AEvents;
				[JsonProperty(LanguageEnglish ? "Time format - [ HH:mm - 24:00 | hh:mm tt - 12:00 ]" : "Формат времени - [ HH:mm - 24:00 | hh:mm tt - 12:00 ]")] public string TimeFormat;
                [JsonProperty(LanguageEnglish ? "Open menu after connection" : "Открытое меню после подключения")] public bool Connect;
                [JsonProperty(LanguageEnglish ? "Fake online from the plugin - [ Default - 0 | IQFakeActive - 1 | FGS - 2] - ( Displayed only in the panel and nowhere else )" : "Фейк онлайн от плагина - [ Default - 0 | IQFakeActive - 1 | FGS - 2]")] public int FakeOnline;
                [JsonProperty(LanguageEnglish ? "Update information of other plugins [ Updates only when the menu is open ]" : "Обновлять информацию других плагинов [ Обновляется только при открытом меню ]")] public bool ReloadPluginsInfo;
                [JsonProperty(LanguageEnglish ? "Open menu refresh interval" : "Интервал обновления открытого меню")] public float IReload;
			}			   

            internal class LogoSetting
			{
                [JsonProperty(LanguageEnglish ? "Link to the logo image" : "Ссылка на картинку логотипа")] public string LogoURL;
                [JsonProperty(LanguageEnglish ? "Logo color" : "Цвет логотипа")] public string LogoColor;
                [JsonProperty(LanguageEnglish ? "Logo material" : "Материал логотипа")] public string LogoMaterial;
                [JsonProperty(LanguageEnglish ? "Logo - AnchorMin" : "Лого - AnchorMin")] public string AnchorMin;
                [JsonProperty(LanguageEnglish ? "Logo - AnchorMax" : "Лого - AnchorMax")] public string AnchorMax;
                [JsonProperty(LanguageEnglish ? "Logo - OffsetMin" : "Лого - OffsetMin")] public string OffsetMin;
                [JsonProperty(LanguageEnglish ? "Logo - OffsetMax" : "Лого - OffsetMax")] public string OffsetMax;
				[JsonProperty(LanguageEnglish ? "Move logo - OffsetMin" : "Сдвинуть лого - OffsetMin")] public string MMOffsetMin;
                [JsonProperty(LanguageEnglish ? "Move logo - OffsetMax" : "Сдвинуть лого - OffsetMax")] public string MMOffsetMax;
			}	
			
			internal class ButtonPlus
			{
				[JsonProperty(LanguageEnglish ? "Command" : "Команда")] public string Command;
				[JsonProperty(LanguageEnglish ? "Link to image from internet" : "Ссылка на картинку из интернета")] public string LinkImageURL;
				[JsonProperty(LanguageEnglish ? "Link to icon from the game" : "Ссылка на иконку из игры")] public string LinkImageGame;
				
				public ButtonPlus(string cmd, string url, string game)
				{
					Command = cmd; LinkImageURL = url; LinkImageGame = game;
				}
			}
			[JsonProperty(LanguageEnglish ? "Settings logo" : "Настройка логотипа")]
            public LogoSetting Logo;
			[JsonProperty(LanguageEnglish ? "Dropdown buttons - [ Key_text | Command ] - [ Text setting in oxide/lang ]" : "Кнопки выпадающего меню - [ Ключ_текста - команда ] - [ Настройка текста в oxide/lang ]")]
            public Dictionary<string, string> ButtonAdd;
			
			[JsonProperty(LanguageEnglish ? "General settings" : "Общие настройки")]
            public GeneralSetting Setting;
			 
			internal class PluginsInfoSetting	
			{
                [JsonProperty(LanguageEnglish ? "Plugin name" : "Название плагина")] public string PluginName;				
                [JsonProperty(LanguageEnglish ? "Method name(API)" : "Название метода(API)")] public string HookName;				
                [JsonProperty(LanguageEnglish ? "Hook parameter type - [ player | userID ]" : "Тип параметра хука - [ player | userID ]")] public string Parameter;				
		   		 		  						  	   		  	 				  		  		   		 		  		 	
                public PluginsInfoSetting(string pluginname, string hookname, string parameter)
				{
					PluginName = pluginname; HookName = hookname; Parameter = parameter;
				}				
			}			
            [JsonProperty(LanguageEnglish ? "Settings additional buttons" : "Настройка дополнительных кнопок")]
            public List<ButtonPlus> ButtonP;

			[JsonProperty(LanguageEnglish ? "Configuring information for other plugins. [ Hooks with parameter type - player(BasePlayer) | userID(ulong) ]" : "Настройка информации других плагинов. [ Хуки c типом параметра - player(BasePlayer) | userID(ulong) ]")]
            public List<PluginsInfoSetting> PluginsInfo;
        }
		private const bool LanguageEnglish = false;
		
		private Dictionary<string, bool> _activeevents = new Dictionary<string, bool>
		{
			["CargoPlane"] = false,
			["BaseHelicopter"] = false,
			["CargoShip"] = false,
			["CH47Helicopter"] = false,
			["BradleyAPC"] = false
		};
		
		private void GUILogo(BasePlayer player, bool open = false) 
		{
            CuiElementContainer container = new CuiElementContainer();
			
			MenuConfig.LogoSetting logo = config.Logo;
			
			bool activemission = player.HasActiveMission() && config.Menu.Mission;
			
			container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = logo.AnchorMin, AnchorMax = logo.AnchorMax, OffsetMin = activemission ? logo.MMOffsetMin : logo.OffsetMin, OffsetMax = activemission ? logo.MMOffsetMax : logo.OffsetMax },
                Image = { Png = (string) ImageLibrary?.Call("GetImage", ".LogoIMG"), Color = logo.LogoColor, Material = logo.LogoMaterial }
            }, "Overlay", ".LogoGUI", ".LogoGUI");
			
			container.Add(new CuiButton
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMax = "0 0" },
                Button = { Color = "0 0 0 0", Command = open ? "ui_menu close" : "ui_menu open" },
                Text = { Text = "" }
            }, ".LogoGUI");
			
			CuiHelper.AddUi(player, container);
		}
		
		private void GUIMenu(BasePlayer player)
		{
            CuiElementContainer container = new CuiElementContainer();
			MenuConfig.MenuSetting menu = config.Menu;
			bool activemission = player.HasActiveMission() && menu.Mission;
			
			container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = menu.MAnchorMin, AnchorMax = menu.MAnchorMax, OffsetMin = activemission ? menu.MMOffsetMin : menu.MOffsetMin, OffsetMax = activemission ? menu.MMOffsetMax : menu.MOffsetMax },
                Image = { Color = menu.MenuColor, Material = menu.MenuMaterial }
            }, "Overlay", ".MenuGUI", ".MenuGUI");

			container.Add(new CuiElement
            {
                Parent = ".MenuGUI",
                Components =
                {
                    new CuiRawImageComponent { Png = (string)ImageLibrary?.Call("GetImage", $"{Name}.fonimage") },
                    new CuiRectTransformComponent {AnchorMin = "0 0", AnchorMax = "1 1"},
                }
            });

            container.Add(new CuiButton
            {
                Button = { Color = "1 0.96 0.88 0", Material = "assets/icons/greyout.mat", Command = $"chat.say /craft" },
                RectTransform = { AnchorMin = "0.195 0.5", AnchorMax = "0.195 0.5", OffsetMin = "2 -22.8", OffsetMax = "16 -9" },
            },  ".MenuGUI", ".BUTTONSTORE");

            container.Add(new CuiElement
            {
                Parent = ".BUTTONSTORE",
                Components =
                {
                    new CuiRawImageComponent { Png = (string)ImageLibrary?.Call("GetImage", $"{Name}.storebutton") },
                    new CuiRectTransformComponent {AnchorMin = "0 0", AnchorMax = "1 1"},
                }
            });

            container.Add(new CuiButton
                {
                    RectTransform = { AnchorMin = "0.195 0.5", AnchorMax = "0.195 0.5", OffsetMin = $"19 -22.8", OffsetMax = $"33 -9" },
                    Button = { Color = "0 0 0 0", Command = $"chat.say /report" },
                }, ".MenuGUI", ".BUTTON2");
				
			container.Add(new CuiElement
            {
                Parent = ".BUTTON2",
                Components =
                {
                    new CuiRawImageComponent { Png = (string)ImageLibrary?.Call("GetImage", $"{Name}.menubutton") },
                    new CuiRectTransformComponent {AnchorMin = "0 0", AnchorMax = "1 1"},
                }
            });

			CuiHelper.AddUi(player, container);
			
			GUIMenuInfo(player);
			
			if(config.Setting.AEvents)
			    GUIEvent(player);
			
			if(config.Setting.APIuginsInfo)
				GUIPluginsInfo(player);
		}
		
		private void Unload()
		{
			foreach(BasePlayer player in BasePlayer.activePlayerList)
			{
			    CuiHelper.DestroyUi(player, ".LogoGUI");
			    CuiHelper.DestroyUi(player, ".MenuGUI");
			}
		}
		public string time;
		
		private void GUIPluginsInfo(BasePlayer player)
		{
            CuiElementContainer container = new CuiElementContainer();			
			MenuConfig.MenuSetting menu = config.Menu;
			container.Add(new CuiPanel
            {
                RectTransform = { AnchorMin = menu.PAnchorMin, AnchorMax = menu.PAnchorMax, OffsetMin = menu.POffsetMin, OffsetMax = menu.POffsetMax },
                Image = { Color = "0 0 0 0" }
            }, ".MenuGUI", ".PluginsInfoGUI", ".PluginsInfoGUI");						
		   		 		  						  	   		  	 				  		  		   		 		  		 	
            int y = 0, count = config.PluginsInfo.Count; 

            foreach(var plugininfo in config.PluginsInfo.Where(p => plugins.Find(p.PluginName)))
			{
				container.Add(new CuiPanel
                {
                    RectTransform = { AnchorMin = "0 1", AnchorMax = "1 1", OffsetMin = $"0 {-18 - (y * 21)}", OffsetMax = $"0 {0 - (y * 21)}" },
                    Image = { Color = config.Menu.MenuColor, Material = config.Menu.MenuMaterial }
                }, ".PluginsInfoGUI", ".InfoText");
				
				if(plugininfo.Parameter == "player")
				    container.Add(new CuiLabel
                    {
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMax = "0 0" },
                        Text = { Text = string.Format(lang.GetMessage(plugininfo.PluginName, this, player.UserIDString), plugins.Find(plugininfo.PluginName).CallHook(plugininfo.HookName, player)), Align = TextAnchor.MiddleCenter, FontSize = 11 }
                    }, ".InfoText");
				else if(plugininfo.Parameter == "userID")
					container.Add(new CuiLabel
                    {
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMax = "0 0" },
                        Text = { Text = string.Format(lang.GetMessage(plugininfo.PluginName, this, player.UserIDString), plugins.Find(plugininfo.PluginName).CallHook(plugininfo.HookName, player.userID)), Align = TextAnchor.MiddleCenter, FontSize = 11 }
                    }, ".InfoText");
					
				y++;
			}
			CuiHelper.AddUi(player, container);
		}
		
		private void OnPlayerDisconnected(BasePlayer player)
		{
			if(config.Setting.Reload)
			players.Remove(player);
		}

		private void GUIAddButton(BasePlayer player)
		{
			CuiElementContainer container = new CuiElementContainer();
			
			container.Add(new CuiButton
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0", OffsetMin = "0 -20", OffsetMax = "0 -2.5" },
                Button = { Color = config.Menu.MenuColor, Command = "ui_menu addbutton_close", Material = config.Menu.MenuMaterial },
                Text = { Text = "" }
            }, ".LogoGUI", ".AddButton_Close", ".AddButton_Close");
			
			container.Add(new CuiLabel
            {
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMax = "0 -1" },
                Text = { Text = lang.GetMessage("AddCLOSE", this, player.UserIDString), Align = TextAnchor.MiddleCenter, FontSize = 10, Color = "1 1 1 0.802794" }
            }, ".AddButton_Close");
			
			int x = 0;
			
			foreach(var button in config.ButtonAdd)
			{
				float fadein = 0.5f + (x * 0.5f);
				
				container.Add(new CuiButton
				{
					RectTransform = { AnchorMin = "0 0", AnchorMax = "1 0", OffsetMin = $"0 {-22.5 - (x * 17.5)}", OffsetMax = $"0 {-7.5 - (x * 17.5)}" },
					Button = { FadeIn = fadein, Color = config.Menu.MenuColor, Command = $"ui_menu_b '{button.Value}'", Material = config.Menu.MenuMaterial },
					Text = { Text = "" } 
				}, ".AddButton_Close", ".AddButton_N");
				
			    container.Add(new CuiLabel
                {
                    RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1", OffsetMax = "0 -1" },
                    Text = { FadeIn = fadein, Text = lang.GetMessage(button.Key, this, player.UserIDString), Align = TextAnchor.MiddleCenter, FontSize = 10, Color = "1 1 1 0.802794" }
                }, ".AddButton_N");
				
				x++;
			}
			
			CuiHelper.AddUi(player, container);
		}
		
		private void OnPlayerConnected(BasePlayer player)
		{
			if(player.IsReceivingSnapshot)
            {
                NextTick(() => OnPlayerConnected(player));
                return;
            }
			
			if(config.Setting.Connect)
			{
				GUIMenu(player);
				GUILogo(player, true);
					
				if(config.Setting.Reload)
					players.Add(player);
				
				if(config.ButtonAdd.Count >= 1)
					GUIAddButtonOpen(player);
			}
			else
			GUILogo(player);
		}
    }
}