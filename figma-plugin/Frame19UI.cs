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

            // Main panel
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0.8" },
                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },
                CursorEnabled = true
            }, "Overlay", UIName);

                    // Panel: Overlay 1
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "1 1 1 0.5", Png = "https://bublickrust.ru/i/41RL4ZE" },
                        RectTransform = { AnchorMin = "0.1667 0.1926", AnchorMax = "0.8333 0.8593" }
                    }, UIName, "frame_19_overlay_1_0");

            // Close button
            elements.Add(new CuiButton
            {
                Button = { Command = "frame19.close", Color = "0.8 0.2 0.2 0.9" },
                RectTransform = { AnchorMin = "0.85 0.92", AnchorMax = "0.98 0.97" },
                Text = { Text = "✕ Закрыть", FontSize = 16, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1" }
            }, UIName);

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
