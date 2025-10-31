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

        [ChatCommand("frame19")]
        void CmdToggleUI(BasePlayer player, string command, string[] args)
        {
            if (HasUI(player))
                CloseUI(player);
            else
                ShowUI(player);
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
            return CuiHelper.DestroyUi(player, UIName);
        }

        private void ShowUI(BasePlayer player)
        {
            CloseUI(player);
            
            var elements = new CuiElementContainer();

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
                Image = { Color = "1 1 1 0.5", Png = "https://bublickrust.ru/i/4CWGB31" },
                RectTransform = { AnchorMin = "0.1667 0.1926", AnchorMax = "0.8333 0.8593" }
            }, UIName, "frame_19_overlay_1_0");

            // Close button
            elements.Add(new CuiButton
            {
                Button = { Command = "frame19.close", Color = "0.8 0.2 0.2 0.9" },
                RectTransform = { AnchorMin = "0.85 0.92", AnchorMax = "0.98 0.97" },
                Text = { Text = "✕ Закрыть", FontSize = 16, Align = TextAnchor.MiddleCenter, Color = "1 1 1 1" }
            }, UIName);

            CuiHelper.AddUi(player, elements);
        }

        private void CloseUI(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UIName);
        }

        void Unload()
        {
            foreach (var player in BasePlayer.activePlayerList)
                CloseUI(player);
        }
    }
}
