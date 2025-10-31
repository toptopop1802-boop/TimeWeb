using Oxide.Core.Plugins;
using Oxide.Game.Rust.Cui;
using System.Collections.Generic;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("Frame19UI", "BublickRust", "1.0.0")]
    [Description("Auto-generated UI from Figma")]
    class Frame19UI : RustPlugin
    {
        private const string UIName = "Frame19";
        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();

        void Init()
        {
            Puts("[Frame19UI] Plugin initialized. Use /frame19 to toggle UI");
        }

        [ChatCommand("frame19")]
        void CmdToggleUI(BasePlayer player, string command, string[] args)
        {
            Puts($"[Frame19UI] Command /frame19 called by {player.displayName}");
            if (HasUI(player))
            {
                Puts($"[Frame19UI] Closing UI for {player.displayName}");
                CloseUI(player);
            }
            else
            {
                Puts($"[Frame19UI] Opening UI for {player.displayName}");
                ShowUI(player);
            }
        }

        [ConsoleCommand("frame19.show")]
        void ConsoleShowUI(ConsoleSystem.Arg arg)
        {
            var player = arg.Player();
            if (player == null) return;
            ShowUI(player);
        }

        [ConsoleCommand("frame19.close")]
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
            Puts($"[Frame19UI] ShowUI called for {player.displayName}");
            CloseUI(player);
            playersWithUI.Add(player.userID);
            
            var elements = new CuiElementContainer();
            Puts($"[Frame19UI] Creating UI elements...");

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
                Button = { Color = "0 0 0 0", Command = "frame19.close" },
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

            // Panel: Rectangle 141
            elements.Add(new CuiPanel
            {
                Image = { Color = "0.851 0.851 0.851 1.000" },
                RectTransform = { AnchorMin = "0.0000 0.0000", AnchorMax = "0.1557 0.2343" }
            }, UIName + ".Content", "frame_19_rectangle_141_0");

            // Panel: Rectangle 142
            elements.Add(new CuiPanel
            {
                Image = { Color = "0.851 0.851 0.851 1.000" },
                RectTransform = { AnchorMin = "0.8531 0.0000", AnchorMax = "1.0000 0.2407" }
            }, UIName + ".Content", "frame_19_rectangle_142_1");

            // Panel: Rectangle 143
            elements.Add(new CuiPanel
            {
                Image = { Color = "0.851 0.851 0.851 1.000" },
                RectTransform = { AnchorMin = "0.8984 0.8250", AnchorMax = "1.0135 1.0000" }
            }, UIName + ".Content", "frame_19_rectangle_143_2");

            // Panel: Rectangle 144
            elements.Add(new CuiPanel
            {
                Image = { Color = "0.851 0.851 0.851 1.000" },
                RectTransform = { AnchorMin = "-0.0073 0.8546", AnchorMax = "0.1625 1.0000" }
            }, UIName + ".Content", "frame_19_rectangle_144_3");

            // Panel: Rectangle 145
            elements.Add(new CuiPanel
            {
                Image = { Color = "0.851 0.851 0.851 1.000" },
                RectTransform = { AnchorMin = "0.3922 0.4074", AnchorMax = "0.6078 0.7019" }
            }, UIName + ".Content", "frame_19_rectangle_145_4");

            // Text: ТЕКСТ
            elements.Add(new CuiLabel
            {
                Text = { Text = "ТЕКСТ", FontSize = 96, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000" },
                RectTransform = { AnchorMin = "0.3521 0.6176", AnchorMax = "0.6391 0.7250" }
            }, UIName + ".Content");

            // Text: ТЕКСТ
            elements.Add(new CuiLabel
            {
                Text = { Text = "ТЕКСТ", FontSize = 96, Align = TextAnchor.MiddleLeft, Color = "1.000 1.000 1.000 1.000" },
                RectTransform = { AnchorMin = "0.3521 0.5102", AnchorMax = "0.6391 0.6176" }
            }, UIName + ".Content");

            Puts($"[Frame19UI] Adding {elements.Count} UI elements to player");
            CuiHelper.AddUi(player, elements);
            Puts($"[Frame19UI] UI successfully shown to {player.displayName}");
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
