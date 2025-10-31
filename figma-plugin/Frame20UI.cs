using Oxide.Core.Plugins;
using Oxide.Game.Rust.Cui;
using System.Collections.Generic;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("Frame20UI", "BublickRust", "1.0.0")]
    [Description("Auto-generated UI from Figma")]
    class Frame20UI : RustPlugin
    {
        private const string UIName = "Frame20";
        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();

        void Init()
        {
            Puts("[Frame20UI] Plugin initialized. Use /frame20 to toggle UI");
        }

        [ChatCommand("frame20")]
        void CmdToggleUI(BasePlayer player, string command, string[] args)
        {
            Puts($"[Frame20UI] Command /frame20 called by {player.displayName}");
            if (HasUI(player))
            {
                Puts($"[Frame20UI] Closing UI for {player.displayName}");
                CloseUI(player);
            }
            else
            {
                Puts($"[Frame20UI] Opening UI for {player.displayName}");
                ShowUI(player);
            }
        }

        [ConsoleCommand("frame20.show")]
        void ConsoleShowUI(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            ShowUI(player);
        }

        [ConsoleCommand("frame20.close")]
        void ConsoleCloseUI(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            CloseUI(player);
        }

        private bool HasUI(BasePlayer player)
        {
            return playersWithUI.Contains(player.userID);
        }

        private void ShowUI(BasePlayer player)
        {
            Puts($"[Frame20UI] ShowUI called for {player.displayName}");
            CloseUI(player);
            playersWithUI.Add(player.userID);
            
            var elements = new CuiElementContainer();
            Puts($"[Frame20UI] Creating UI elements...");

            // Main background panel with blur
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0.8", Material = "assets/content/ui/uibackgroundblur-ingamemenu.mat" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                CursorEnabled = true
            }, "Overlay", UIName);

            // Invisible button for closing on background click
            elements.Add(new CuiButton
            {
                Button = { Color = "0 0 0 0", Command = "frame20.close" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                Text = { Text = "", Color = "0 0 0 0" }
            }, UIName, UIName + ".CloseBackground");

            // Content container (on top of close button)
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                CursorEnabled = false
            }, UIName, UIName + ".Content");

                    // Text: <
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "<", FontSize = 128, Align = TextAnchor.MiddleCenter, Color = "0.765 0.765 0.765 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.4221 0.7544", AnchorMax = "0.4383 0.7996" }
                    }, UIName + ".Content");

                    // Panel: BATLE PASS FIFNSIH EBANI
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.0758 0.0000", AnchorMax = "0.9242 1.0000" }
                    }, UIName + ".Content", "frame_20_batle_pass_fifnsih_ebani_1");

                        // Panel: BatlePass
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.0894 0.0155", AnchorMax = "1.0000 1.0000" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: image 101
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.1519 0.1462", AnchorMax = "1.0000 0.9089" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_101_0");

                            // Panel: image-Photoroom 5
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.8578 0.1315", AnchorMax = "0.9555 0.2727" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_5_1");

                            // Panel: image-Photoroom 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.8578 0.1315", AnchorMax = "0.9555 0.2727" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_1_2");

                            // Panel: image-Photoroom 4 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.0894 0.0155", AnchorMax = "0.3604 0.4075" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_4_1_3");

                            // Panel: image-Photoroom 2
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.1948 0.1348", AnchorMax = "0.3616 0.3762" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_2_4");

                            // Panel: image-Photoroom 3
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.4039 0.7438", AnchorMax = "0.5291 0.9250" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_3_5");

                            // Panel: image-Photoroom 6
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.4039 0.7438", AnchorMax = "0.5291 0.9250" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_photoroom_6_6");

                            // Text: Куда ложить твой лут?
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Куда ложить твой лут?", FontSize = 32, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3330 0.2648", AnchorMax = "0.5229 0.2973" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Поставь переключатель туда куда тебе нужнозабирать награды. Либо в игровой инветраь, либо в инвентарь плагина.
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Поставь переключатель туда куда тебе нужнозабирать награды. Либо в игровой инветраь, либо в инвентарь плагина.", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3374 0.2239", AnchorMax = "0.4966 0.2648" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: В инвентарь плагина
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "В инвентарь плагина", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3363 0.1983", AnchorMax = "0.4037 0.2174" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: В инвентарь
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "В инвентарь", FontSize = 13, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.4183 0.1983", AnchorMax = "0.4857 0.2174" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: #4
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "#4", FontSize = 48, Align = TextAnchor.MiddleCenter, Color = "0.945 0.627 0.267 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3085 0.2682", AnchorMax = "0.3392 0.2972" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: #1
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "#1", FontSize = 48, Align = TextAnchor.MiddleCenter, Color = "0.945 0.627 0.267 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2303 0.7548", AnchorMax = "0.2611 0.7838" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Вип награды
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Вип награды", FontSize = 32, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.5419 0.7082", AnchorMax = "0.7318 0.7407" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.5428 0.6729", AnchorMax = "0.7020 0.7139" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Вип награды
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Вип награды", FontSize = 32, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2612 0.7578", AnchorMax = "0.4512 0.7903" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2612 0.7203", AnchorMax = "0.4204 0.7613" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: #2
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "#2", FontSize = 48, Align = TextAnchor.MiddleCenter, Color = "0.945 0.627 0.267 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.5111 0.7054", AnchorMax = "0.5419 0.7343" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Вип награды
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Вип награды", FontSize = 32, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.8207 0.7845", AnchorMax = "1.0000 0.8170" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Заходи на сервер каждый день и получай награды за каждый день захода. Чем дальше тем пиздаче призы", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.8221 0.7407", AnchorMax = "0.9813 0.7817" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: #3
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "#3", FontSize = 48, Align = TextAnchor.MiddleCenter, Color = "0.945 0.627 0.267 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.7899 0.7817", AnchorMax = "0.8207 0.8106" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: Group 27 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.4033 0.1956", AnchorMax = "0.4282 0.2182" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_27_1_21");

                            // Text: НАГРАДЫ
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "НАГРАДЫ", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "0.945 0.627 0.267 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.5814 0.8558", AnchorMax = "0.6390 0.8749" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: Group 37 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.2036 0.3771", AnchorMax = "0.3081 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_37_1_23");

                            // Text: ИНВЕНТАРЬ
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "ИНВЕНТАРЬ", FontSize = 23, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.6420 0.8558", AnchorMax = "0.6996 0.8749" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: День 1
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2104 0.5671", AnchorMax = "0.2485 0.5904" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: ?
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2847 0.5671", AnchorMax = "0.3013 0.5904" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: День 2
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "День 2", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3374 0.5733", AnchorMax = "0.3589 0.5839" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: ?
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.4074 0.5727", AnchorMax = "0.4152 0.5840" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: Group 34 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.3219 0.3764", AnchorMax = "0.4283 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_34_1_29");

                            // Panel: Group 34 2
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.4406 0.3764", AnchorMax = "0.5470 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_34_2_30");

                            // Panel: Group 34 3
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.6787 0.3764", AnchorMax = "0.7852 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_34_3_31");

                            // Panel: Group 34 4
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.7998 0.3764", AnchorMax = "0.9063 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_34_4_32");

                            // Text: Внутри хуйняочень вкусное
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2339 0.4271", AnchorMax = "0.2783 0.4512" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: image 107
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "1.0000 0.3951", AnchorMax = "1.0000 0.4269" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_107_34");

                            // Image for image 107
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_image_107_34",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4OF1S4V" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Panel: image 106
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.9500 0.3924", AnchorMax = "0.9793 0.4560" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_106_35");

                            // Image for image 106
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_image_106_35",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4OF1S4V" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Text: Внутри хуйняочень вкусное
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3550 0.4271", AnchorMax = "0.3994 0.4512" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: image 105
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.9113 0.4653", AnchorMax = "0.9602 0.5712" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_image_105_37");

                            // Image for image 105
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_image_105_37",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4OF1S4V" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Text: Внутри хуйняочень вкусное
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.4697 0.4271", AnchorMax = "0.5142 0.4512" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Внутри хуйняочень вкусное
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.7080 0.4271", AnchorMax = "0.7524 0.4512" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: Внутри хуйняочень вкусное
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.8262 0.4273", AnchorMax = "0.8706 0.4513" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: ПОЛУЧИТЬ
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "ПОЛУЧИТЬ", FontSize = 14, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.2378 0.3855", AnchorMax = "0.2759 0.3975" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: 24:00:00
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "24:00:00", FontSize = 14, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.3589 0.3819", AnchorMax = "0.3916 0.3982" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: НЕ ДОСТУПЕН
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "НЕ ДОСТУПЕН", FontSize = 14, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.4702 0.3848", AnchorMax = "0.5190 0.3982" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: Group 35 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.5591 0.3764", AnchorMax = "0.6641 0.5996" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_35_1_44");

                            // Image for Group 35 1
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_group_35_1_44",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/PHD9YD0" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Panel: Group 36 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.9180 0.3771", AnchorMax = "1.0000 0.6003" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_36_1_45");

                            // Image for Group 36 1
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_group_36_1_45",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/30042VK" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Text: НЕ ДОСТУПЕН
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "НЕ ДОСТУПЕН", FontSize = 14, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.7075 0.3848", AnchorMax = "0.7563 0.3982" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Text: НЕ ДОСТУПЕН
                            elements.Add(new CuiLabel
                            {
                                Text = { Text = "НЕ ДОСТУПЕН", FontSize = 14, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                RectTransform = { AnchorMin = "0.8267 0.3849", AnchorMax = "0.8755 0.3983" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0");

                            // Panel: Group 29
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.5801 0.3862", AnchorMax = "0.6625 0.7372" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_29_48");

                                // Text: Внутри хуйняочень вкусное
                                elements.Add(new CuiLabel
                                {
                                    Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                    RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                                }, "batlepass_group_29_48");

                                // Panel: Group 28 5
                                elements.Add(new CuiPanel
                                {
                                    Image = { Color = "0 0 0 0" },
                                    RectTransform = { AnchorMin = "1.0000 0.1687", AnchorMax = "1.0000 0.2512" }
                                }, "batlepass_group_29_48", "group_29_group_28_5_1");

                                // Image for Group 28 5
                                elements.Add(new CuiElement
                                {
                                    Parent = "group_29_group_28_5_1",
                                    Components =
                                    {
                                        new CuiRawImageComponent { Url = "https://bublickrust.ru/i/2QKIV97" },
                                        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                    }
                                });

                                // Text: НУЖЕН ВИП СТАТУС
                                elements.Add(new CuiLabel
                                {
                                    Text = { Text = "НУЖЕН ВИП СТАТУС", FontSize = 13, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                    RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                                }, "batlepass_group_29_48");

                            // Panel: Group 31
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.9111 0.3876", AnchorMax = "1.0000 0.8233" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_group_31_49");

                                // Panel: Group 30
                                elements.Add(new CuiPanel
                                {
                                    Image = { Color = "0 0 0 0" },
                                    RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.5945" }
                                }, "batlepass_group_31_49", "group_31_group_30_0");

                                    // Text: Внутри хуйняочень вкусное
                                    elements.Add(new CuiLabel
                                    {
                                        Text = { Text = "Внутри хуйняочень вкусное", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                        RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                                    }, "group_31_group_30_0");

                                    // Text: НЕ ДОСТУПНО
                                    elements.Add(new CuiLabel
                                    {
                                        Text = { Text = "НЕ ДОСТУПНО", FontSize = 14, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                                        RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                                    }, "group_31_group_30_0");

                                    // Panel: image 104
                                    elements.Add(new CuiPanel
                                    {
                                        Image = { Color = "0 0 0 0" },
                                        RectTransform = { AnchorMin = "1.0000 0.0159", AnchorMax = "1.0000 0.1180" }
                                    }, "group_31_group_30_0", "group_30_image_104_2");

                                    // Image for image 104
                                    elements.Add(new CuiElement
                                    {
                                        Parent = "group_30_image_104_2",
                                        Components =
                                        {
                                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4OF1S4V" },
                                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                        }
                                    });

                                    // Panel: image 105
                                    elements.Add(new CuiPanel
                                    {
                                        Image = { Color = "0 0 0 0" },
                                        RectTransform = { AnchorMin = "1.0000 0.4924", AnchorMax = "1.0000 0.5945" }
                                    }, "group_31_group_30_0", "group_30_image_105_3");

                                    // Image for image 105
                                    elements.Add(new CuiElement
                                    {
                                        Parent = "group_30_image_105_3",
                                        Components =
                                        {
                                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4OF1S4V" },
                                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                        }
                                    });

                            // Panel: rifle.l96 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.5796 0.4632", AnchorMax = "0.6421 0.5536" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_rifle_l96_1_50");

                            // Image for rifle.l96 1
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_rifle_l96_1_50",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/LUSMTL0" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                            // Panel: lmg.m249 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.9370 0.4632", AnchorMax = "0.9995 0.5536" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_lmg_m249_1_51");

                            // Panel: metal.plate.torso 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.6997 0.4610", AnchorMax = "0.7622 0.5514" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_metal_plate_torso_1_52");

                            // Panel: workbench3 1
                            elements.Add(new CuiPanel
                            {
                                Image = { Color = "0 0 0 0" },
                                RectTransform = { AnchorMin = "0.8179 0.4632", AnchorMax = "0.8804 0.5536" }
                            }, "batle_pass_fifnsih_ebani_batlepass_0", "batlepass_workbench3_1_53");

                            // Image for workbench3 1
                            elements.Add(new CuiElement
                            {
                                Parent = "batlepass_workbench3_1_53",
                                Components =
                                {
                                    new CuiRawImageComponent { Url = "https://bublickrust.ru/i/245OFQE" },
                                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                                }
                            });

                        // Panel: rifle.ak.ice 3
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.2246 0.4632", AnchorMax = "0.2871 0.5536" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_rifle_ak_ice_3_1");

                        // Panel: rifle.ak 1
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.3442 0.4632", AnchorMax = "0.4067 0.5536" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_rifle_ak_1_2");

                        // Image for rifle.ak 1
                        elements.Add(new CuiElement
                        {
                            Parent = "batle_pass_fifnsih_ebani_rifle_ak_1_2",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/69VHR60" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: Vector 21 1
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.6953 0.6921", AnchorMax = "0.8428 0.7444" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_vector_21_1_3");

                        // Panel: Vector 22 1
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.4883 0.2684", AnchorMax = "1.0000 0.7613" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_vector_22_1_4");

                        // Panel: Vector 20 1
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.3684 0.7334", AnchorMax = "0.5686 0.7687" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_vector_20_1_5");

                        // Image for Vector 20 1
                        elements.Add(new CuiElement
                        {
                            Parent = "batle_pass_fifnsih_ebani_vector_20_1_5",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/3M0AHA0" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: sulfur 1
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.4634 0.4632", AnchorMax = "0.5259 0.5536" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1", "batle_pass_fifnsih_ebani_sulfur_1_6");

                        // Image for sulfur 1
                        elements.Add(new CuiElement
                        {
                            Parent = "batle_pass_fifnsih_ebani_sulfur_1_6",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/24XT2L9" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.3301 0.5671", AnchorMax = "0.3682 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.4043 0.5671", AnchorMax = "0.4209 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.4482 0.5671", AnchorMax = "0.4863 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.5225 0.5671", AnchorMax = "0.5391 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.5664 0.5671", AnchorMax = "0.6045 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.6406 0.5671", AnchorMax = "0.6572 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.6865 0.5671", AnchorMax = "0.7246 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.7607 0.5671", AnchorMax = "0.7773 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.8076 0.5671", AnchorMax = "0.8457 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.8818 0.5671", AnchorMax = "0.8984 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: День 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "День 1", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.9248 0.5671", AnchorMax = "0.9629 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

                        // Text: ?
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "?", FontSize = 15, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                            RectTransform = { AnchorMin = "0.9990 0.5671", AnchorMax = "1.0000 0.5904" }
                        }, "frame_20_batle_pass_fifnsih_ebani_1");

            Puts($"[Frame20UI] Adding {elements.Count} UI elements to player");
            CuiHelper.AddUi(player, elements);
            Puts($"[Frame20UI] UI successfully shown to {player.displayName}");
        }

        private void CloseUI(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UIName);
            playersWithUI.Remove(player.userID);
        }

        void OnPlayerDisconnected(BasePlayer player)
        {
            playersWithUI.Remove(player.userID);
        }

        void Unload()
        {
            foreach (var player in BasePlayer.activePlayerList)
                CloseUI(player);
            playersWithUI.Clear();
        }
    }
}
