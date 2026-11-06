---
title: 移动宽带没有公网 IPv4，如何通过 IPv6 和 OpenVPN 连回家
pubDatetime: 2026-11-06T07:53:41Z
description: 记录 OpenWrt、sing-box 与群晖 OpenVPN 共存时的 IPv6 获址、组播放行、UDP 1194 入站和回程排查，以及手机连回家后复用家庭网关自动分流的过程。
tags:
  - network
  - openwrt
  - ipv6
  - openvpn
  - synology
keywords:
  - IPv6
  - OpenVPN
  - sing-box
  - DDNS
  - 群晖
  - 移动宽带
draft: false
---

家里的移动宽带没有公网 IPv4，路由器拿到的是 `100.64.*` 的运营商共享地址，但有公网 IPv6。之前已经把 NAS 的 IPv6 注册到 DDNS，这次想做的事情很直接：手机在外面用 IPv6 连接 NAS 上的 OpenVPN，再通过 VPN 访问家里的内网设备。

另外还有一个收获。手机连回家以后，把默认流量送到家庭网络，再由家里的 OpenWrt 网关按已有规则决定直连或通过 Hysteria2 代理。这样手机在外面也能复用家庭网关的分流，不必再维护一套独立的代理规则。

真正配置时，问题并没有停留在“开放一个端口”。先是 NAS 只有 `fe80::` 地址，之后拿到了公网地址却不能正常出网，最后 OpenVPN 仍然超时。排查下来，IPv6 的地址通告、sing-box 的严格路由和防火墙转发都参与了这条链路。我把这次走过的过程记下来，方便以后重新配置或排查时回来查看。

## 网络结构和两段隧道

主路由运行 OpenWrt、sing-box 和 Hysteria2 客户端，群晖 NAS 运行 OpenVPN Server。文章中的域名 `vpn.weenas.com` 仅为示例，不代表实际服务地址；局域网地址、公网 IPv6、MAC 和接口标识也都使用示例值。

| 设备 | 示例局域网地址 | 用途 |
| --- | --- | --- |
| OpenWrt 主路由 | `192.168.10.1` | IPv6 路由、DNS、sing-box 分流 |
| 群晖 NAS | `192.168.10.10` | OpenVPN 服务器 |

手机到群晖 NAS 的 OpenVPN，和家庭网关到 VPS 的 Hysteria2，是两段各自独立的连接。手机通过公网 IPv6 回家，隧道里仍然可以传输访问 `192.168.10.*` 的 IPv4 数据。需要代理的访问到达家庭网关后，再进入 Hysteria2。

下文的配置名称和设备标识均经过脱敏，使用时需要替换为自己的实际值。文章没有包含 VPN 私钥、用户密码或节点凭据。

## 路由器有公网 IPv6，不等于 NAS 已经有地址

最开始，NAS 的网卡只有 `fe80::` 链路本地地址。主路由的 PPPoE 接口有公网 IPv6，LAN 也已经分到了公网 `/64`，因此问题不是“移动没有提供 IPv6”。

我实际检查了路由器从运营商拿到的 PD：这是一个 `/60`，可以划分为 16 个 `/64`。LAN 当时使用其中一个 `/64`。这里应直接查委派结果，不能仅凭 WAN 和 LAN 的地址不同，就推断拿到了多大的前缀。

在 OpenWrt 上可以这样看：

```sh
ubus call network.interface.wan_6 status
ubus call network.interface.lan status
ip -6 addr show dev br-lan scope global
ubus call dhcp ipv6ra
```

`wan_6` 是我这台 PPPoE 路由器自动生成的 IPv6 接口名称，其他设备可能叫 `wan6`。`ubus call dhcp ipv6ra` 能列出 odhcpd 通告的前缀，但它没有给出完整的线上报文，也不能单独证明 NAS 已经收到通告。

NAS 这一端则检查实际承载地址的接口。如果群晖 NAS 使用 Open vSwitch 和链路聚合，承载地址的接口可能叫 `ovs_bond0`，不能只查看 `eth0`；下面以 `ovs_bond0` 为例：

```sh
ip -6 addr show dev ovs_bond0
ip -6 route show
cat /proc/sys/net/ipv6/conf/ovs_bond0/autoconf
cat /proc/sys/net/ipv6/conf/ovs_bond0/accept_ra
cat /proc/sys/net/ipv6/conf/ovs_bond0/accept_ra_pinfo
```

当时 NAS 的 `autoconf=1`、`accept_ra=2`、`accept_ra_pinfo=1`，没有发现地址重复检测失败。它具备接收前缀并自动生成地址的条件。

## 不要把 ra_flags 和 SLAAC 的 A 标志混在一起

看到 NAS 没有地址，第一反应很容易是“RA 没有启用 SLAAC”。但 OpenWrt 的两个配置项管理的是不同的东西：

- `ra_slaac` 决定前缀信息中的 A 标志，终端据此自动生成地址。
- `ra_flags` 管理 RA 的 M/O 等标志，用于告知终端是否通过 DHCPv6 获取地址或其他配置。

因此，`ra_flags='none'` 不等于关闭 SLAAC。odhcpd 文档中 `ra_slaac` 的默认值本来就是 `1`。这次我把它显式写入配置，但单独加这一项并没有解决问题。[odhcpd 配置说明](https://github.com/openwrt/odhcpd/blob/master/README.md)

保留下来的配置是：

```sh
uci set dhcp.lan.ra='server'
uci set dhcp.lan.ra_slaac='1'
uci commit dhcp
/etc/init.d/odhcpd restart
```

家里之前遇到过终端使用另一条 IPv6 DNS 解析路径的问题，所以仍保留 `ra_flags='none'`、`ra_dns='0'`，没有为了修 SLAAC 而启用 DHCPv6 server。IPv4 DNS 查询同样可以返回 AAAA 记录，DNS 请求本身不必通过 IPv6 发送。

后来实际抓到的 RA 中，公网 `/64` 的 PIO 标志为 `0xc0`，A、L 都开启。前缀内容没有问题，问题发生在报文传输过程中。

## 真正拦住 RA 的是 sing-box

主路由当时运行 sing-box 1.12.12。TUN 入站只配置了 IPv4 地址，同时启用了：

```json
{
  "auto_route": true,
  "auto_redirect": true,
  "strict_route": true
}
```

这个配置会对不支持的 IPv6 流量生成拒绝规则。原来的排除列表有 `::1/128`、`fc00::/7`、`fe80::/10`，却漏掉了链路本地组播。RA 发往 `ff02::1`，Router Solicitation 发往 `ff02::2`；这些目的地址不属于 `fe80::/10`，因而没有被放过。

直接以 root 发一个标准 RS 时，发送接口返回 `Operation not permitted`；检查 nftables 后，能看到 sing-box 的 IPv6 reject 规则正在命中。这才把地址通告和透明代理之间的关系对上。

最终有效的改动，是在 TUN 原有的 `route_exclude_address` 中追加：

```json
"ff02::/16"
```

这里只展示新增项，应保留原来的排除列表。修改前先备份配置，修改后再校验和重启：

```sh
sing-box check -c /etc/sing-box/config.json
/etc/init.d/sing-box restart
```

还要把同一项加入 `/root/update-shadowrocket-rules.sh` 的候选配置生成逻辑，否则每周更新规则时会把这次修复覆盖掉。

我试过把整个 `ff00::/8` 加进去：静态校验可以通过，但这台机器在启动时出现 `auto-redirect: netlink receive: file exists`，服务不断退出。已回退后改用 `ff02::/16`，才正常启动。也试过内联 `route_exclude_address_set`，在这套 IPv4-only TUN 中没有生成需要的 IPv6 排除规则，因此没有保留。这里记录的是当前版本的实测行为，不代表其他版本一定相同。[sing-box TUN 文档](https://sing-box.sagernet.org/configuration/inbound/tun/)

放行组播并重新广播 RA 后，群晖 NAS 自动生成了公网 IPv6 和 ULA 地址。到这里，才算解决了“NAS 只有 fe80”的问题。

## 有地址之后，还要处理原生 IPv6 的进出

有公网地址不代表已经能访问互联网。sing-box 的严格路由仍会拒绝没有明确排除的公网 IPv6。

原生 IPv6 出网和 OpenVPN 公网入口需要分别处理。本篇的 VPN 配置只为群晖 NAS 增加 UDP 1194 的入站与回程例外，IPv4 继续按原来的规则分流。如果 NAS 本身也要使用原生 IPv6 出网，还需要单独设计相应的直连规则，不能仅凭 VPN 端口放行就认为所有 IPv6 应用都能访问外网。

验证时也踩过一个判断上的坑：访问 Cloudflare 的固定 IPv6 地址超时，并不代表所有 IPv6 都不通。排查中增加针对性的原生 IPv6 放行后，访问百度返回 HTTP 200，约 0.30 秒；访问阿里 DNS 的 IPv6 HTTPS 接口完成 TLS 后返回 HTTP 400，约 0.11 秒。后者是没有提交 DoH 查询参数时的应用响应，说明网络和 TLS 已经打通。

为了隔离 DNS 分流影响，测试使用固定 IPv6 和正确的域名/SNI，例如：

```sh
curl -6 \
  --resolve 'dns.alidns.com:443:[2400:3200::1]' \
  --connect-timeout 4 --max-time 8 \
  -o /dev/null -w '%{http_code}\n' \
  https://dns.alidns.com/dns-query
```

这些时间只是当时的观察值，不能据此推断 IPv6 总比 IPv4 快。

## OpenVPN 的 IPv6入口不需要 DHCPv6-PD

群晖 VPN Server 有一个“IPv6 服务器模式”，页面会要求选择通过 DHCPv6-PD 等方式获得的前缀。看到这个空下拉框，很容易以为“NAS 虽然有 IPv6，但还不能通过 IPv6 连接 OpenVPN”。

实际上，这是两件事：手机通过 NAS 的公网 IPv6 建立 OpenVPN，要求 VPN 服务监听 IPv6；给 VPN 隧道内部的客户端分配 IPv6，则是另一项功能，后者才涉及可用前缀。

我的目标是用公网 IPv6 回家，再在隧道里访问 IPv4 内网，因此没有把 NAS 改成 DHCPv6-PD，也没有为了这个入口开启 VPN 内部的 IPv6 地址分配。[Synology VPN Server 说明](https://kb.synology.com/en-au/DSM/help/VPNCenter/vpn_setup?version=6)

OpenVPN 使用 UDP 1194。排查服务器时，应确认实际目标 NAS 的 IPv6 UDP 监听；常见输出类似：

```text
udp6  0  0  :::1194  :::*
```

服务配置中的 `proto udp6` 表示 IPv6 UDP。手机导出的配置也应使用与服务端相符的协议和端口，例如：

```text
proto udp6
remote vpn.weenas.com 1194
```

这段只是协议和入口示例，不替代群晖导出的证书、认证和完整客户端配置。

## 先核对 DDNS 与群晖 NAS 的地址

连接超时时，应先用公共 DNS 查询 `vpn.weenas.com` 的 AAAA，再与群晖 NAS 当前的公网 IPv6 对照，并通过路由器邻居表确认设备 MAC。前缀变化后，旧 AAAA 仍可能保留一段时间；防火墙规则如果匹配了错误的地址或接口标识，也不会命中。

如果局域网里另外配置了静态 DNS，域名可能解析到示例内网地址 `192.168.10.10`。这个结果不能代替手机蜂窝网络看到的公共 AAAA。

排查前把“域名、公共 IPv6、局域网 IPv4、设备 MAC”对应好，再检查监听和防火墙。最后通过路由器 WAN、LAN 两侧的抓包，确认请求是否送到群晖 NAS、NAS 是否回复，并由手机进行真实连接验证。

## 主路由要放行 forward，而不是只放行 input

主路由原来已经有一条包含 UDP 1194 的 socat 放行，但它位于 input 链，只允许流量访问路由器自身。

手机连接的是 NAS 的公网 IPv6，数据包经过主路由转发给 LAN，属于 forward。它不需要 IPv4 端口映射，也不需要 NAT66，但需要明确允许 WAN 到 NAS 的 UDP 1194。

考虑到移动重拨后前缀可能变化，我没有在规则中写死完整 `/128`，而是匹配群晖 NAS 固定的低 64 位接口标识。下面以 `::1234:5678:9abc:def0` 为例，必须替换成 NAS 实际接口标识；同时确认该设备没有使用会轮换的隐私地址。

规则文件 `/etc/nftables.d/lan-services/nas-openvpn-ipv6.nft`：

```nft
# 示例 IID，必须替换。
oifname "br-lan" ip6 daddr 2000::/3 ip6 daddr & ::ffff:ffff:ffff:ffff == ::1234:5678:9abc:def0 udp dport 1194 counter accept comment "!fw4: NAS OpenVPN IPv6 UDP1194"
```

通过 UCI 将它放在 `forward_wan` 链开头：

```sh
uci set firewall.nas_openvpn_v6='include'
uci set firewall.nas_openvpn_v6.type='nftables'
uci set firewall.nas_openvpn_v6.path='/etc/nftables.d/lan-services/nas-openvpn-ipv6.nft'
uci set firewall.nas_openvpn_v6.position='chain-prepend'
uci set firewall.nas_openvpn_v6.chain='forward_wan'
uci set firewall.nas_openvpn_v6.enabled='1'
uci commit firewall
fw4 check
```

只有检查成功后才执行 `fw4 reload`。实际应用前备份 `/etc/config/firewall`；如果检查失败，恢复配置并处理报错，不要继续重载。

这条规则只开放指定 NAS 的 IPv6 UDP 1194。没有开放 DSM 管理端口，也没有把 WAN 到 LAN 全部设为允许。

## sing-box 还要放过 VPN 入站和回程

fw4 允许不代表数据一定能到达 NAS。sing-box 在更早的 prerouting 阶段可能已经拒绝它，因此为群晖 NAS 的 VPN 增加了两个 return 例外：目的为群晖 NAS 的 IPv6 UDP 1194，以及它发出的 UDP 源端口 1194。

下面是用于群晖 NAS 的 helper 示例。MAC 和 IID 都是占位示例，实际部署前替换；IPv4 不在这些规则的匹配范围内。

```sh
#!/bin/sh
set -eu

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if nft list chain inet sing-box prerouting >/dev/null 2>&1; then
    if ! nft list chain inet sing-box prerouting | grep -Fq 'nas-openvpn-v6-out'; then
      nft 'insert rule inet sing-box prerouting meta nfproto ipv6 ether saddr 02:11:22:33:44:55 udp sport 1194 counter return comment "nas-openvpn-v6-out"'
    fi
    if ! nft list chain inet sing-box prerouting | grep -Fq 'nas-openvpn-v6-in'; then
      nft 'insert rule inet sing-box prerouting ip6 daddr & ::ffff:ffff:ffff:ffff == ::1234:5678:9abc:def0 udp dport 1194 counter return comment "nas-openvpn-v6-in"'
    fi
    exit 0
  fi
  sleep 1
done
exit 1
```

`return` 只让报文跳过 sing-box 当前这条链的处理，后面仍由 fw4 决定是否允许转发，它本身不是“公网全部放行”。

本文将 helper 保存为 `/usr/sbin/sing-box-lan-ipv6-bypass`，用于加载群晖 NAS 的 VPN 专用规则。由于 sing-box 每次重启会重新建表，不能只在命令行临时插入一次。我把 helper 接入已有的 `/usr/sbin/sing-box-supervisor`：启动子进程后、`wait "$child"` 前调用它，helper 会等待表出现，再幂等地添加规则。

另外在 `/etc/hotplug.d/iface/95-sing-box-lan-ipv6-bypass` 处理 WAN/LAN 的 `ifup`、`ifupdate`，短暂延迟后重新调用 helper。helper、supervisor、规则更新脚本加入 `/etc/sysupgrade.conf`，自定义 fw4 文件和 hotplug 文件保存在 `/etc`。

这样服务重启和接口更新后有自动恢复机制。更换 NAS 网卡、MAC、IPv6 接口标识或启用隐私地址时，需要重新检查这些匹配条件，不能把“前缀变化后可继续使用”理解为设备身份变化后也无需维护。

## 手机连回家后，复用家庭网关的自动分流

手机实际重连后，OpenVPN 已经成功。路由器 WAN 和 LAN 两侧都看到手机与群晖 NAS 的 IPv6 UDP 1194 双向数据，放行规则和 sing-box 入站例外也命中。

我还在手机上确认了一项使用方式：连接 OpenVPN 后，默认流量进入家庭网络，再通过主路由出网。访问国内网站走家庭宽带，需要代理的网站由主路由上的 sing-box 送往 Hysteria2 和 VPS。这等于手机连回家后直接复用了家里已经维护好的分流规则。

这项能力还要求 OpenVPN 客户端接受默认路由，以及 NAS 正确转发 VPN 客户端流量。常见的 IPv4 默认路由配置是服务端推送：

```text
push "redirect-gateway def1"
```

客户端也可以按实际需要配置 `redirect-gateway def1`。`def1` 使用两条 `/1` 路由覆盖 IPv4 默认出口；DNS 应同步指向 VPN 内可达的家庭解析器，例如 `192.168.10.1`，并确认客户端实际接受了配置。[OpenVPN 默认路由说明](https://openvpn.net/community-docs/routing-all-client-traffic--including-web-traffic--through-the-vpn/)

“默认流量回家后能够自动分流”的结果已经在手机端实际使用中确认。上面的指令用于解释实现机制，不是对完整服务端或手机配置文件的逐行抄录；复现时还应核对群晖 NAS 的转发方式、客户端收到的路由和 DNS。

还有一个容易忽略的边界：通过 IPv6 建立 OpenVPN，再用 `redirect-gateway def1` 接管 IPv4，不等于手机所有 IPv6 流量也进入了隧道。若需要严格的全量接管，还要单独设计客户端 IPv6 路由或阻断策略，并检查应用自带 DNS 的行为。当前没有据此宣称所有协议、所有应用都已完成无旁路验证。[OpenVPN 2.6 手册](https://openvpn.net/community-docs/community-articles/openvpn-2-6-manual/)

## 再遇到超时，按链路逐段看

以后排查可以按下面的顺序，不要一开始就改 VPN 认证参数：

1. 用公共 DNS 确认 AAAA 指向实际群晖 NAS，手机所在外网本身具备 IPv6。
2. 确认 NAS 有有效公网地址，路由器能正确发送 RA，DDNS 没有保留旧前缀。
3. 查看 WAN 是否收到 UDP 1194；收不到时先查手机、解析和上游链路。
4. 查看 sing-box 例外和 fw4 转发规则是否命中，再看 LAN 是否把包送到 NAS。
5. 查看 NAS 是否回复，以及回复是否从 WAN 发出。
6. 双向 UDP 已通而认证仍失败时，再查实际 NAS 和手机客户端的 OpenVPN 握手日志。
7. VPN 连上后，分别验证内网资源、国内网站、代理网站和 DNS；“已连接”不等于每条应用路径都正常。

抓包只保留必要包头并限制数量。OpenWrt 的 `tcpdump-mini` 在部分 Linux cooked 链路类型上可能无法正常解码，甚至转为输出十六进制内容；这次实际遇到了这个情况。以后优先在 `br-lan` 上看正常解码的包头，WAN 侧必要时用兼容的完整解码工具处理，避免把大量会话数据输出到日志。临时工具和抓包文件用完后清理。

## 这次保留下来的配置与边界

这套 VPN 方案的关键配置是：LAN 的 SLAAC、sing-box 对 `ff02::/16` 的排除，以及群晖 NAS 的 UDP 1194 精确转发与入站/回程例外。没有启用 DHCPv6-PD，没有打开 DSM 的公网管理端口，也没有把所有 LAN 设备的 IPv6 都设为直连。

手机蜂窝网络的真实 OpenVPN 连接已经验证。sing-box 服务重启后的规则恢复和国内/代理访问也已测试。没有为了测试而断开整条 WAN 或重启主路由，接口更新钩子做了语法检查，不能把它写成已经完成实际断线重拨验证。

以后手机处于只有 IPv4 的外网时，这个纯 IPv6 入口不能使用；要覆盖这种网络还需要另做中转方案。连接回家后，代理流量还会经过家庭线路和 VPS，延迟、家庭上行以及 VPS 带宽都会影响速度。VPS 故障时，应让家庭网关的直连与直连 DNS 保持独立，这也是后续做故障演练时需要继续验证的部分。

实际设备标识、备份路径和恢复记录单独保存在本地维护文档中。这篇文章保留配置的因果关系和复现方法，以后迁移到其他网络时，再按新网络的前缀、DNS、网关与防火墙逐项核对。
