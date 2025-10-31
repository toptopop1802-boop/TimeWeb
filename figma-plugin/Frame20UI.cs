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

            // Center wrapper (keeps Figma frame centered)
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-960 -540", OffsetMax = "960 540" }
            }, UIName + ".Content", UIName + ".Center");

                    // Panel: image 368
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5000 0.5019", AnchorMax = "0.5000 0.5019", OffsetMin = "-960 -540", OffsetMax = "960 540" }
                    }, UIName + ".Center", "frame_20_image_368_0");

                    // Panel: Rectangle 2613
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.2742 0.5435", AnchorMax = "0.2742 0.5435", OffsetMin = "-136 -180", OffsetMax = "136 180" }
                    }, UIName + ".Center", "frame_20_rectangle_2613_1");

                    // Panel: Rectangle 2619
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.4227 0.5435", AnchorMax = "0.4227 0.5435", OffsetMin = "-136 -180", OffsetMax = "136 180" }
                    }, UIName + ".Center", "frame_20_rectangle_2619_2");

                    // Panel: Rectangle 2620
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.5711 0.5435", AnchorMax = "0.5711 0.5435", OffsetMin = "-136 -180", OffsetMax = "136 180" }
                    }, UIName + ".Center", "frame_20_rectangle_2620_3");

                    // Panel: Rectangle 2621
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.7195 0.5435", AnchorMax = "0.7195 0.5435", OffsetMin = "-136 -180", OffsetMax = "136 180" }
                    }, UIName + ".Center", "frame_20_rectangle_2621_4");

                    // Panel: Rectangle 2614
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.4224 0.4042", AnchorMax = "0.4224 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center", "frame_20_rectangle_2614_5");

                    // Panel: Rectangle 2616
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.2740 0.4042", AnchorMax = "0.2740 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center", "frame_20_rectangle_2616_6");

                    // Panel: Rectangle 2618
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.2740 0.4042", AnchorMax = "0.2740 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center", "frame_20_rectangle_2618_7");

                    // Panel: Rectangle 2615
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.5708 0.4042", AnchorMax = "0.5708 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center", "frame_20_rectangle_2615_8");

                    // Panel: Rectangle 2617
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.7193 0.4042", AnchorMax = "0.7193 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center", "frame_20_rectangle_2617_9");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.2740 0.4042", AnchorMax = "0.2740 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.2740 0.5125", AnchorMax = "0.2740 0.5125", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.4224 0.5125", AnchorMax = "0.4224 0.5125", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.5708 0.5125", AnchorMax = "0.5708 0.5125", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.7193 0.5125", AnchorMax = "0.7193 0.5125", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.4224 0.4042", AnchorMax = "0.4224 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.5708 0.4042", AnchorMax = "0.5708 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.7198 0.4042", AnchorMax = "0.7198 0.4042", OffsetMin = "-120 -23", OffsetMax = "120 23" }
                    }, UIName + ".Center");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5711 0.6014", AnchorMax = "0.5711 0.6014", OffsetMin = "-74 -74", OffsetMax = "74 74" }
                    }, UIName + ".Center", "frame_20_image_363_18");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_363_18",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/2NT63OI" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 365
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.7195 0.6014", AnchorMax = "0.7195 0.6014", OffsetMin = "-74 -74", OffsetMax = "74 74" }
                    }, UIName + ".Center", "frame_20_image_365_19");

                    // Image for image 365
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_365_19",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/2NT63OI" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 366
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.2742 0.6014", AnchorMax = "0.2742 0.6014", OffsetMin = "-74 -74", OffsetMax = "74 74" }
                    }, UIName + ".Center", "frame_20_image_366_20");

                    // Image for image 366
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_366_20",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/2NT63OI" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 367
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.4227 0.6014", AnchorMax = "0.4227 0.6014", OffsetMin = "-74 -74", OffsetMax = "74 74" }
                    }, UIName + ".Center", "frame_20_image_367_21");

                    // Image for image 367
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_367_21",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/2NT63OI" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 2622
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.3349 0.6935", AnchorMax = "0.3349 0.6935", OffsetMin = "-15 -15", OffsetMax = "15 15" }
                    }, UIName + ".Center", "frame_20_rectangle_2622_22");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.3352 0.6931", AnchorMax = "0.3352 0.6931", OffsetMin = "-10 -10", OffsetMax = "10 10" }
                    }, UIName + ".Center");

                    // Panel: Rectangle 2623
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.4833 0.6935", AnchorMax = "0.4833 0.6935", OffsetMin = "-15 -15", OffsetMax = "15 15" }
                    }, UIName + ".Center", "frame_20_rectangle_2623_24");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.4836 0.6931", AnchorMax = "0.4836 0.6931", OffsetMin = "-10 -10", OffsetMax = "10 10" }
                    }, UIName + ".Center");

                    // Panel: Rectangle 2624
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.6318 0.6935", AnchorMax = "0.6318 0.6935", OffsetMin = "-15 -15", OffsetMax = "15 15" }
                    }, UIName + ".Center", "frame_20_rectangle_2624_26");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.6320 0.6931", AnchorMax = "0.6320 0.6931", OffsetMin = "-10 -10", OffsetMax = "10 10" }
                    }, UIName + ".Center");

                    // Panel: Rectangle 2625
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.7807 0.6935", AnchorMax = "0.7807 0.6935", OffsetMin = "-15 -15", OffsetMax = "15 15" }
                    }, UIName + ".Center", "frame_20_rectangle_2625_28");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.7810 0.6931", AnchorMax = "0.7810 0.6931", OffsetMin = "-10 -10", OffsetMax = "10 10" }
                    }, UIName + ".Center");

                    // Text: Тест плагина Figma
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "Тест плагина Figma", FontSize = 40, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.5008 0.8694", AnchorMax = "0.5008 0.8694", OffsetMin = "-398 -55", OffsetMax = "398 55" }
                    }, UIName + ".Center");

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
    