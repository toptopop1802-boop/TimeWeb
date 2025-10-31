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

                    // Panel: image 368
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.0000 0.0019", AnchorMax = "1.0000 1.0000" }
                    }, UIName + ".Content", "frame_20_image_368_0");

                    // Panel: Rectangle 2613
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.2036 0.3769", AnchorMax = "0.3448 0.7102" }
                    }, UIName + ".Content", "frame_20_rectangle_2613_1");

                    // Panel: Rectangle 2619
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.3521 0.3769", AnchorMax = "0.4932 0.7102" }
                    }, UIName + ".Content", "frame_20_rectangle_2619_2");

                    // Panel: Rectangle 2620
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.5005 0.3769", AnchorMax = "0.6417 0.7102" }
                    }, UIName + ".Content", "frame_20_rectangle_2620_3");

                    // Panel: Rectangle 2621
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.365 0.424 0.247 1.000" },
                        RectTransform = { AnchorMin = "0.6490 0.3769", AnchorMax = "0.7901 0.7102" }
                    }, UIName + ".Content", "frame_20_rectangle_2621_4");

                    // Panel: Rectangle 2614
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.3599 0.3833", AnchorMax = "0.4849 0.4250" }
                    }, UIName + ".Content", "frame_20_rectangle_2614_5");

                    // Panel: Rectangle 2616
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.2115 0.3833", AnchorMax = "0.3365 0.4250" }
                    }, UIName + ".Content", "frame_20_rectangle_2616_6");

                    // Panel: Rectangle 2618
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.2115 0.3833", AnchorMax = "0.3365 0.4250" }
                    }, UIName + ".Content", "frame_20_rectangle_2618_7");

                    // Panel: Rectangle 2615
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.5083 0.3833", AnchorMax = "0.6333 0.4250" }
                    }, UIName + ".Content", "frame_20_rectangle_2615_8");

                    // Panel: Rectangle 2617
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.412 0.494 0.271 1.000" },
                        RectTransform = { AnchorMin = "0.6568 0.3833", AnchorMax = "0.7818 0.4250" }
                    }, UIName + ".Content", "frame_20_rectangle_2617_9");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.2115 0.3833", AnchorMax = "0.3365 0.4250" }
                    }, UIName + ".Content");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.2115 0.4917", AnchorMax = "0.3365 0.5333" }
                    }, UIName + ".Content");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.3599 0.4917", AnchorMax = "0.4849 0.5333" }
                    }, UIName + ".Content");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.5083 0.4917", AnchorMax = "0.6333 0.5333" }
                    }, UIName + ".Content");

                    // Text: название кита
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "название кита", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.6568 0.4917", AnchorMax = "0.7818 0.5333" }
                    }, UIName + ".Content");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.3599 0.3833", AnchorMax = "0.4849 0.4250" }
                    }, UIName + ".Content");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.5083 0.3833", AnchorMax = "0.6333 0.4250" }
                    }, UIName + ".Content");

                    // Text: взять
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "взять", FontSize = 24, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.6573 0.3833", AnchorMax = "0.7823 0.4250" }
                    }, UIName + ".Content");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5328 0.5333", AnchorMax = "0.6094 0.6694" }
                    }, UIName + ".Content", "frame_20_image_363_18");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_363_18",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/XX779O0" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 365
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.6813 0.5333", AnchorMax = "0.7578 0.6694" }
                    }, UIName + ".Content", "frame_20_image_365_19");

                    // Image for image 365
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_365_19",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/XX779O0" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 366
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.2359 0.5333", AnchorMax = "0.3125 0.6694" }
                    }, UIName + ".Content", "frame_20_image_366_20");

                    // Image for image 366
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_366_20",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/XX779O0" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: image 367
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.3844 0.5333", AnchorMax = "0.4609 0.6694" }
                    }, UIName + ".Content", "frame_20_image_367_21");

                    // Image for image 367
                    elements.Add(new CuiElement
                    {
                        Parent = "frame_20_image_367_21",
                        Components =
                        {
                            new CuiRawImageComponent { Url = "https://bublickrust.ru/i/XX779O0" },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 2622
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.3271 0.6796", AnchorMax = "0.3427 0.7074" }
                    }, UIName + ".Content", "frame_20_rectangle_2622_22");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.3302 0.6843", AnchorMax = "0.3401 0.7019" }
                    }, UIName + ".Content");

                    // Panel: Rectangle 2623
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.4755 0.6796", AnchorMax = "0.4911 0.7074" }
                    }, UIName + ".Content", "frame_20_rectangle_2623_24");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.4786 0.6843", AnchorMax = "0.4885 0.7019" }
                    }, UIName + ".Content");

                    // Panel: Rectangle 2624
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.6240 0.6796", AnchorMax = "0.6396 0.7074" }
                    }, UIName + ".Content", "frame_20_rectangle_2624_26");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.6271 0.6843", AnchorMax = "0.6370 0.7019" }
                    }, UIName + ".Content");

                    // Panel: Rectangle 2625
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.851 0.851 0.851 0.330" },
                        RectTransform = { AnchorMin = "0.7729 0.6796", AnchorMax = "0.7885 0.7074" }
                    }, UIName + ".Content", "frame_20_rectangle_2625_28");

                    // Text: ?
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "?", FontSize = 20, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.7760 0.6843", AnchorMax = "0.7859 0.7019" }
                    }, UIName + ".Content");

                    // Text: Тест плагина Figma
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "Тест плагина Figma", FontSize = 40, Align = TextAnchor.MiddleCenter, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-bold.ttf" },
                        RectTransform = { AnchorMin = "0.2938 0.8185", AnchorMax = "0.7078 0.9204" }
                    }, UIName + ".Content");

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
