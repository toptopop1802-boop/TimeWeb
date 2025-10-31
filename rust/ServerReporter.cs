using Oxide.Core;
using Oxide.Core.Libraries.Covalence;
using Oxide.Game.Rust.Cui;
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("ServerReporter", "DSBot", "0.1.0")]
    [Description("Reports active Rust players to external dashboard")] 
    public class ServerReporter : RustPlugin
    {
        private const string DefaultEndpoint = "https://bublickrust.ru/api/rust/players/report";
        private string _endpoint = DefaultEndpoint;
        private string _apiToken = ""; // runtime only, not saved
        private int _intervalSeconds = 5;
        private string _serverName = "Rust Server";
        private Timer _timer;

        private void Init()
        {
            if (_intervalSeconds < 5) _intervalSeconds = 5;

            StartReporting();
        }

        private void Unload()
        {
            _timer?.Destroy();
            _apiToken = string.Empty; // clear from memory
        }

        private void OnPlayerConnected(BasePlayer player)
        {
            QueueSend();
        }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            QueueSend();
        }

        private void StartReporting()
        {
            _timer?.Destroy();
            _timer = timer.Every(_intervalSeconds, () => SendReport());
            timer.Once(5f, () => SendReport());
        }

        private void QueueSend()
        {
            timer.Once(2f, () => SendReport());
        }

        private void SendReport()
        {
            try
            {
                if (string.IsNullOrEmpty(_endpoint)) return;
                if (string.IsNullOrEmpty(_apiToken))
                {
                    // Token not set – skip quietly to avoid spamming logs
                    return;
                }
                var payload = BuildPayload();
                var json = Newtonsoft.Json.JsonConvert.SerializeObject(payload);
                var headers = new Dictionary<string, string>
                {
                    ["Content-Type"] = "application/json",
                    ["Authorization"] = $"Bearer {_apiToken}"
                };
                webrequest.Enqueue(_endpoint, json, (code, response) =>
                {
                    if (code != 200)
                    {
                        Puts($"[ServerReporter] HTTP {code} {(response ?? "")}" );
                    }
                }, this, Core.Libraries.RequestMethod.POST, headers, timeout: 10f);
            }
            catch (Exception e)
            {
                PrintError($"SendReport failed: {e}");
            }
        }

        private object BuildPayload()
        {
            var list = new List<object>();
            // Используем allPlayerList чтобы включить всех игроков, включая спящих
            foreach (var player in BasePlayer.allPlayerList)
            {
                try
                {
                    // Проверяем, спит ли игрок (IsSleeping) или не активен
                    var isOnline = !player.IsSleeping() && player.IsConnected;
                    
                    var (grid, x, y, z) = GetGridAndPos(player);
                    var (teamId, members) = GetTeamInfo(player);
                    var ip = GetIp(player);
                    list.Add(new
                    {
                        steamId = player.userID.ToString(),
                        name = player.displayName,
                        ip,
                        teamId = teamId == 0 ? (string)null : teamId.ToString(),
                        teamMembers = members,
                        grid,
                        x,
                        y,
                        z,
                        online = isOnline
                    });
                }
                catch {}
            }

            return new
            {
                server = new { name = _serverName },
                players = list
            };
        }

        // =============================
        // Console Commands (no storage)
        // =============================
        [ConsoleCommand("serverreporter.settoken")]
        private void CmdSetToken(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            var token = arg.GetString(0, string.Empty);
            if (string.IsNullOrWhiteSpace(token)) { arg.ReplyWith("Usage: serverreporter.settoken <TOKEN>"); return; }
            _apiToken = token.Trim();
            arg.ReplyWith($"ServerReporter: token set (len={_apiToken.Length}).");
        }

        [ConsoleCommand("sr.settoken")]
        private void CmdSetTokenAlias(ConsoleSystem.Arg arg) => CmdSetToken(arg);

        [ConsoleCommand("serverreporter.cleartoken")]
        private void CmdClearToken(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            _apiToken = string.Empty;
            arg.ReplyWith("ServerReporter: token cleared.");
        }

        [ConsoleCommand("serverreporter.setendpoint")]
        private void CmdSetEndpoint(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            var url = arg.GetString(0, string.Empty);
            if (string.IsNullOrWhiteSpace(url)) { arg.ReplyWith("Usage: serverreporter.setendpoint <URL>"); return; }
            _endpoint = url.Trim();
            arg.ReplyWith($"ServerReporter: endpoint set to {_endpoint}");
        }

        [ConsoleCommand("serverreporter.setinterval")]
        private void CmdSetInterval(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            var seconds = arg.GetInt(0, _intervalSeconds);
            if (seconds < 5) seconds = 5;
            _intervalSeconds = seconds;
            StartReporting();
            arg.ReplyWith($"ServerReporter: interval set to {_intervalSeconds}s");
        }

        [ConsoleCommand("serverreporter.setservername")]
        private void CmdSetServerName(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            var name = arg.GetString(0, string.Empty);
            if (string.IsNullOrWhiteSpace(name)) { arg.ReplyWith("Usage: serverreporter.setservername <NAME>"); return; }
            _serverName = name.Trim();
            arg.ReplyWith($"ServerReporter: server name set to '{_serverName}'");
        }

        [ConsoleCommand("serverreporter.sendnow")]
        private void CmdSendNow(ConsoleSystem.Arg arg)
        {
            if (!IsAllowed(arg)) { arg.ReplyWith("No permission"); return; }
            SendReport();
            arg.ReplyWith("ServerReporter: send triggered.");
        }

        private bool IsAllowed(ConsoleSystem.Arg arg)
        {
            // allow server console and admins (authlevel >= 2)
            if (arg.Connection == null) return true;
            return arg.Connection.authLevel >= 2;
        }

        private (ulong teamId, List<object> members) GetTeamInfo(BasePlayer player)
        {
            var members = new List<object>();
            var teamId = player.currentTeam;
            if (teamId == 0) return (0, members);
            var team = RelationshipManager.ServerInstance?.teams?.GetValueOrDefault(teamId);
            if (team != null && team.members != null)
            {
                foreach (var mid in team.members)
                {
                    var name = mid == player.userID ? player.displayName : (BasePlayer.FindByID(mid)?.displayName ?? mid.ToString());
                    members.Add(new { steamId = mid.ToString(), name });
                }
            }
            return (teamId, members);
        }

        private string GetIp(BasePlayer player)
        {
            try
            {
                var raw = player?.net?.connection?.ipaddress ?? string.Empty;
                if (string.IsNullOrEmpty(raw)) return null;
                var i = raw.IndexOf(':');
                if (i > 0) raw = raw.Substring(0, i);
                if (raw.StartsWith("::ffff:")) raw = raw.Substring(7);
                return raw;
            }
            catch { return null; }
        }

        private (string grid, float x, float y, float z) GetGridAndPos(BasePlayer player)
        {
            var pos = player.transform.position;
            var grid = ToGrid(pos);
            return (grid, pos.x, pos.y, pos.z);
        }

        // Approximate map grid like "K7"
        private string ToGrid(Vector3 pos)
        {
            try
            {
                var size = ConVar.Server.worldsize; // e.g. 4250
                var half = size / 2f;
                var cell = 146.3f; // approx grid cell size used by many tools
                var gx = Mathf.Clamp(Mathf.FloorToInt((pos.x + half) / cell), 0, 999);
                var gz = Mathf.Clamp(Mathf.FloorToInt((half - pos.z) / cell), 0, 999);
                return GridLetters(gx) + gz.ToString();
            }
            catch { return "-"; }
        }

        private string GridLetters(int x)
        {
            // A..Z, AA..AZ, BA.. etc.
            var letters = "";
            do
            {
                var rem = x % 26;
                letters = (char)('A' + rem) + letters;
                x = (x / 26) - 1;
            } while (x >= 0);
            return letters;
        }
    }
}


