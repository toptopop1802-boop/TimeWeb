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

            // Center wrapper to keep layout centered on any aspect ratio (1920x1080 reference)
            // Size derived from original anchors of the main group (~1104 x ~738)
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-552 -369", OffsetMax = "552 369" }
            }, UIName + ".Content", UIName + ".Center");

                    // Panel: Group 1 (fit inside center wrapper)
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" }
                    }, UIName + ".Center", "frame_20_group_1_0");

                        // Text: КЛАНОВОЕ МЕНЮ
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "КЛАНОВОЕ МЕНЮ", FontSize = 40, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6600 0.6938", AnchorMax = "1.0000 0.7683" }
                        }, "frame_20_group_1_0");

                        // Panel: Rectangle 39
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.3320", AnchorMax = "0.5204 0.5501" }
                        }, "frame_20_group_1_0", "group_1_rectangle_39_1");

                        // Panel: Rectangle 49
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.3320", AnchorMax = "1.0000 0.5501" }
                        }, "frame_20_group_1_0", "group_1_rectangle_49_2");

                        // Panel: Rectangle 56
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.3780", AnchorMax = "1.0000 0.4837" }
                        }, "frame_20_group_1_0", "group_1_rectangle_56_3");

                        // Panel: Rectangle 57
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.3780", AnchorMax = "1.0000 0.4837" }
                        }, "frame_20_group_1_0", "group_1_rectangle_57_4");

                        // Panel: Rectangle 43
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.1694", AnchorMax = "0.5340 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_43_5");

                        // Panel: Rectangle 48
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.1694", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_48_6");

                        // Panel: Rectangle 58
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.571 0.537 0.507 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.1233" }
                        }, "frame_20_group_1_0", "group_1_rectangle_58_7");

                        // Panel: Rectangle 59
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_rectangle_59_8");

                        // Panel: image 25
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "1.0000 0.1721", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_image_25_9");

                        // Image for image 25
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_25_9",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/1WNBFX4" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Text: 1
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1", FontSize = 36, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.3997", AnchorMax = "1.0000 0.4621" }
                        }, "frame_20_group_1_0");

                        // Text: 10
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "10", FontSize = 36, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.3997", AnchorMax = "1.0000 0.4621" }
                        }, "frame_20_group_1_0");

                        // Text: Место в топе
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Место в топе", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.5149", AnchorMax = "1.0000 0.5407" }
                        }, "frame_20_group_1_0");

                        // Text: По очкам
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "По очкам", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.4837", AnchorMax = "1.0000 0.5095" }
                        }, "frame_20_group_1_0");

                        // Text: По рейдам
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "По рейдам", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.4837", AnchorMax = "1.0000 0.5095" }
                        }, "frame_20_group_1_0");

                        // Panel: Rectangle 47
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "1.0000 0.1694", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_47_15");

                        // Panel: Rectangle 46
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.8767 0.1694", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_46_16");

                        // Panel: Rectangle 45
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.7081 0.1694", AnchorMax = "0.8731 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_45_17");

                        // Panel: Rectangle 44
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.5385 0.1694", AnchorMax = "0.7044 0.3252" }
                        }, "frame_20_group_1_0", "group_1_rectangle_44_18");

                        // Panel: image 24
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "1.0000 0.1707", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_image_24_19");

                        // Image for image 24
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_24_19",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4QPWOPM" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: Rectangle 40
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.5258 0.4837", AnchorMax = "1.0000 0.5501" }
                        }, "frame_20_group_1_0", "group_1_rectangle_40_20");

                        // Panel: Rectangle 42
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.5258 0.3320", AnchorMax = "1.0000 0.3984" }
                        }, "frame_20_group_1_0", "group_1_rectangle_42_21");

                        // Panel: Rectangle 50
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.1314", AnchorMax = "1.0000 0.1599" }
                        }, "frame_20_group_1_0", "group_1_rectangle_50_22");

                        // Panel: Rectangle 54
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_rectangle_54_23");

                        // Panel: Rectangle 55
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_rectangle_55_24");

                        // Panel: Rectangle 53
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_rectangle_53_25");

                        // Panel: Rectangle 52
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.0000", AnchorMax = "1.0000 0.0501" }
                        }, "frame_20_group_1_0", "group_1_rectangle_52_26");

                        // Panel: Rectangle 51
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.3699 0.0596", AnchorMax = "1.0000 0.1220" }
                        }, "frame_20_group_1_0", "group_1_rectangle_51_27");

                        // Panel: Rectangle 41
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.816 0.776 0.741 0.200" },
                            RectTransform = { AnchorMin = "0.5258 0.4079", AnchorMax = "1.0000 0.4743" }
                        }, "frame_20_group_1_0", "group_1_rectangle_41_28");

                        // Text: Глава клана:
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Глава клана:", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.5394 0.5027", AnchorMax = "0.6546 0.5312" }
                        }, "frame_20_group_1_0");

                        // Text: имя игрока
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "имя игрока", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3762 0.1233", AnchorMax = "0.5050 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: очков
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "очков", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6102 0.1233", AnchorMax = "0.6772 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: убийств
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "убийств", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7579 0.1233", AnchorMax = "0.8540 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: смертей
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "смертей", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9257 0.1233", AnchorMax = "1.0000 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: статус
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "статус", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.1233", AnchorMax = "1.0000 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: к/д
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "к/д", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.1233", AnchorMax = "1.0000 0.1599" }
                        }, "frame_20_group_1_0");

                        // Text: Участников в игре:
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Участников в игре:", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.5394 0.4268", AnchorMax = "0.7099 0.4553" }
                        }, "frame_20_group_1_0");

                        // Text: Очки клана:
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Очки клана:", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.5394 0.3509", AnchorMax = "0.6473 0.3794" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.5027", AnchorMax = "1.0000 0.5312" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3926 0.0732", AnchorMax = "0.4497 0.1084" }
                        }, "frame_20_group_1_0");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6083 0.0732", AnchorMax = "0.6636 0.1084" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7770 0.0732", AnchorMax = "0.8114 0.1084" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9465 0.0732", AnchorMax = "0.9801 0.1084" }
                        }, "frame_20_group_1_0");

                        // Text: 5.2
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "5.2", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0732", AnchorMax = "1.0000 0.1084" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3908 0.0000", AnchorMax = "0.4479 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3926 0.0000", AnchorMax = "0.4497 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3926 0.0000", AnchorMax = "0.4497 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: Deity
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "Deity", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3908 0.0000", AnchorMax = "0.4479 0.0366" }
                        }, "frame_20_group_1_0");

                        // Text: 1 из 5
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1 из 5", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.4268", AnchorMax = "1.0000 0.4553" }
                        }, "frame_20_group_1_0");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.3509", AnchorMax = "1.0000 0.3794" }
                        }, "frame_20_group_1_0");

                        // Panel: image
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.3953 0.3862", AnchorMax = "0.4841 0.5190" }
                        }, "frame_20_group_1_0", "group_1_image_50");

                        // Image for image
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_50",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/1126QEP" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Text: имя клана
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "имя клана", FontSize = 15, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.3926 0.3482", AnchorMax = "0.4878 0.3767" }
                        }, "frame_20_group_1_0");

                        // Panel: image 20
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.3935 0.1721", AnchorMax = "0.5005 0.3238" }
                        }, "frame_20_group_1_0", "group_1_image_20_52");

                        // Image for image 20
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_20_52",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/184QIYO" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: image 21
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.5603 0.1612", AnchorMax = "0.6827 0.3320" }
                        }, "frame_20_group_1_0", "group_1_image_21_53");

                        // Image for image 21
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_21_53",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/1EOKA0H" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: image 22
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.7335 0.1694", AnchorMax = "0.8450 0.3252" }
                        }, "frame_20_group_1_0", "group_1_image_22_54");

                        // Image for image 22
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_22_54",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/ABG3DOR" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Panel: image 23
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0 0 0 0" },
                            RectTransform = { AnchorMin = "0.9030 0.1694", AnchorMax = "1.0000 0.3252" }
                        }, "frame_20_group_1_0", "group_1_image_23_55");

                        // Image for image 23
                        elements.Add(new CuiElement
                        {
                            Parent = "group_1_image_23_55",
                            Components =
                            {
                                new CuiRawImageComponent { Url = "https://bublickrust.ru/i/4MO8SBN" },
                                new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                            }
                        });

                        // Text: ↑
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "↑", FontSize = 64, Align = TextAnchor.MiddleLeft, Color = "0.300 0.300 0.300 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0217", AnchorMax = "1.0000 0.0921" }
                        }, "frame_20_group_1_0");

                        // Text: ↓
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "↓", FontSize = 64, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0");

                        // Panel: Ellipse 2
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.570 1.000 0.500 1.000" },
                            RectTransform = { AnchorMin = "1.0000 0.0799", AnchorMax = "1.0000 0.1016" }
                        }, "frame_20_group_1_0", "group_1_ellipse_2_58");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6083 0.0000", AnchorMax = "0.6636 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7770 0.0000", AnchorMax = "0.8114 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9465 0.0000", AnchorMax = "0.9801 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 5.2
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "5.2", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0");

                        // Panel: Ellipse 6
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.570 1.000 0.500 1.000" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_ellipse_6_63");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6083 0.0000", AnchorMax = "0.6636 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7770 0.0000", AnchorMax = "0.8114 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9465 0.0000", AnchorMax = "0.9801 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 5.2
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "5.2", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0");

                        // Panel: Ellipse 5
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.925 0.166 0.302 1.000" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_ellipse_5_68");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6083 0.0000", AnchorMax = "0.6636 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7770 0.0000", AnchorMax = "0.8114 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9465 0.0000", AnchorMax = "0.9801 0.0000" }
                        }, "frame_20_group_1_0");

                        // Text: 5.2
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "5.2", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0");

                        // Panel: Ellipse 4
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.570 1.000 0.500 1.000" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0000" }
                        }, "frame_20_group_1_0", "group_1_ellipse_4_73");

                        // Text: 1007
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "1007", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.6083 0.0000", AnchorMax = "0.6636 0.0366" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.7770 0.0000", AnchorMax = "0.8114 0.0366" }
                        }, "frame_20_group_1_0");

                        // Text: 52
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "52", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "0.9465 0.0000", AnchorMax = "0.9801 0.0366" }
                        }, "frame_20_group_1_0");

                        // Text: 5.2
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "5.2", FontSize = 20, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000", Font = "robotocondensed-regular.ttf" },
                            RectTransform = { AnchorMin = "1.0000 0.0000", AnchorMax = "1.0000 0.0366" }
                        }, "frame_20_group_1_0");

                        // Panel: Ellipse 3
                        elements.Add(new CuiPanel
                        {
                            Image = { Color = "0.925 0.166 0.302 1.000" },
                            RectTransform = { AnchorMin = "1.0000 0.0068", AnchorMax = "1.0000 0.0298" }
                        }, "frame_20_group_1_0", "group_1_ellipse_3_78");

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
