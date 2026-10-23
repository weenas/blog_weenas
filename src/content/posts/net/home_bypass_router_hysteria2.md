---
title: 用 NAS 虚拟 OpenWrt 搭建家庭旁路由代理
date: 2026-10-23T18:00:00+08:00
description: 记录在 NAS 虚拟机中运行 OpenWrt，以 sing-box 和 Hysteria2 为出口，为家庭设备提供按规则分流的旁路由方案，以及 DNS、IPv6 和故障回退的处理。
image: /images/posts/openwrt-bypass-router-cover.jpg
keywords:
  - OpenWrt
  - sing-box
  - Hysteria2
  - 旁路由
tags:
  - network
  - openwrt
  - proxy
draft: false
pubDatetime: 2026-10-23
---

之前在手机、平板、电视和电脑上分别配置代理，每换一台设备就要重新设置一遍。把代理放到家里的主路由上虽然省事，但如果路由或分流规则配置错误，家里所有设备都可能受到影响。

我换了一个更容易回退的做法：在 NAS 的虚拟机里运行一台 OpenWrt，把它作为旁路由；先让一台电脑或电视单独使用它，确认分流和 DNS 正常后，再决定要不要扩大使用范围。家庭主路由仍然负责原有的网络连接，旁路由出现故障时，测试设备可以改回主路由。

![NAS 虚拟 OpenWrt 旁路由通过规则分流连接家庭网络和 VPS](/images/posts/openwrt-bypass-router-cover.jpg)

## 网络结构和方案选择

这套方案里，NAS 上的虚拟 OpenWrt 通过现有家庭网络接入主路由。它不替换主路由，也不负责给全家设备分配地址。需要测试的设备把默认网关和 DNS 临时指向旁路由，由旁路由根据规则决定流量的去向：直连流量经主路由访问互联网；代理流量由旁路由封装进 Hysteria2 隧道，同样经主路由发往 VPS，再由 VPS 访问目标网站。旁路由只有主路由这一个上游，两条路径最终都要经过主路由。

![测试设备把网关和 DNS 指向 NAS 上的虚拟 OpenWrt；直连流量经主路由访问互联网，代理流量经主路由进入 Hysteria2 隧道到 VPS](/images/posts/bypass-router-network.svg)

和在每台设备上安装代理客户端相比，这种方式的终端不需要安装任何软件，只要把网关和 DNS 指向旁路由；分流规则也只需在旁路由上维护一份。

我选择 sing-box，是因为它把入站、DNS、路由规则和代理出站放在同一套配置里管理；Hysteria2 则沿用已经准备好的 VPS 节点。旧的 PassWall 配置曾因 DNS 项目重复而没有正常启动，所以这次不再以旧配置为基础继续叠加，而是使用较新的 sing-box 方案。

## 先把旁路由限制在测试范围

虚拟 OpenWrt 使用家庭 LAN 上的固定地址 `10.1.1.2`，主路由地址是 `10.1.1.1`。地址应根据自己的网络调整，并确保没有被其他设备占用。旁路由的默认网关指向主路由。

旁路由接入已有 LAN 时，DHCP 服务必须关闭，避免它和主路由同时给设备分配地址。IPv6 也一样：旁路由不应发送路由通告（RA）或提供 DHCPv6，否则设备会把它当成 IPv6 路由器和 DNS。OpenWrt 里把 LAN 的 DHCP 设为“忽略此接口”后，可以用 `ubus call dhcp ipv6ra` 确认 odhcpd 没有在任何接口上发送 RA。虚拟机使用现有外部虚拟交换机即可；测试阶段不需要改主路由的默认网关，也不需要把整个家庭网络切到旁路由。

旁路由只有一个网口接在 LAN 里（常说的“单臂”），还要注意回程路径。经过 sing-box TUN 的连接由 sing-box 重新发起，回包会回到旁路由，不受影响；但被排除在 TUN 之外、由内核直接转发的流量，去程经过旁路由，回程却可能由主路由直接发回终端，这种非对称路由会被旁路由的防火墙当成无效连接丢弃。我的配置里排除的都是局域网和保留地址段，再加上 VPS 自己的地址（避免隧道流量再次进入 TUN）；局域网设备访问这些私有地址时本来就不经过网关，所以没有遇到这个问题，LAN 防火墙区域也没有开启动态伪装。如果你要把公网地址段排除在 TUN 之外，就需要在旁路由的 LAN 区域开启 IP 动态伪装（masquerading），让转发出去的流量以旁路由的地址返回。

先在一台测试设备上手动设置：

- 默认网关：旁路由地址，例如 `10.1.1.2`
- DNS 服务器：旁路由地址，例如 `10.1.1.2`

确认测试设备可以正常访问国内网站、代理网站和家庭局域网资源后，再考虑是否让更多设备使用。出现问题时，把测试设备的网关和 DNS 改回主路由，就能恢复原来的上网路径。

## sing-box、Hysteria2 和分流

旁路由上的 sing-box 使用 TUN 入站接收经过它的流量，再由路由规则选择直连或 Hysteria2 出站。规则的核心不是“所有流量都走代理”，而是让国内和局域网流量保持直连，把需要代理的域名或 IP 送到 VPS。

规则顺序很重要。sing-box 先嗅探连接、劫持经过 TUN 的 DNS 请求，再按以下顺序匹配：一般直连例外、较早的代理规则、广告拦截、较晚的代理规则、中国域名和 IP 直连；都没有匹配时，默认走代理。百度直连、X 走代理的测试结果符合这套分流目标。

下面是我的配置的精简版，去掉了节点地址、密码和完整的排除地址列表，用来说明各部分的关系。字段以所装 sing-box 版本的[官方文档](https://sing-box.sagernet.org/zh/configuration/)为准：

```json
{
  "dns": {
    "servers": [
      {
        "type": "https",
        "tag": "cloudflare-doh",
        "server": "1.1.1.1",
        "tls": { "enabled": true, "server_name": "cloudflare-dns.com" },
        "detour": "proxy"
      },
      {
        "type": "https",
        "tag": "china-doh",
        "server": "223.5.5.5",
        "tls": { "enabled": true, "server_name": "dns.alidns.com" }
      }
    ],
    "rules": [
      { "rule_set": ["sr-direct-general"], "server": "china-doh" },
      { "rule_set": ["sr-proxy-early"], "server": "cloudflare-doh" },
      { "rule_set": ["sr-proxy-late"], "server": "cloudflare-doh" },
      { "rule_set": ["sr-cn-domains"], "server": "china-doh" }
    ],
    "final": "cloudflare-doh",
    "strategy": "ipv4_only"
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "address": ["172.19.0.1/30"],
      "auto_route": true,
      "auto_redirect": true,
      "strict_route": true,
      "route_exclude_address": [
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "<VPS 地址>/32"
      ]
    }
  ],
  "outbounds": [
    {
      "type": "hysteria2",
      "tag": "proxy",
      "server": "vps.example.com",
      "server_port": 443,
      "password": "<password>",
      "tls": { "enabled": true, "server_name": "vps.example.com" }
    },
    { "type": "direct", "tag": "direct" }
  ],
  "route": {
    "rules": [
      { "port": 53, "action": "hijack-dns" },
      { "action": "sniff" },
      { "rule_set": ["sr-direct-general"], "outbound": "direct" },
      { "rule_set": ["sr-proxy-early"], "outbound": "proxy" },
      { "rule_set": ["sr-reject"], "action": "reject" },
      { "rule_set": ["sr-proxy-late"], "outbound": "proxy" },
      { "rule_set": ["sr-cn-domains", "sr-cn-ips"], "outbound": "direct" }
    ],
    "rule_set": [
      {
        "type": "local",
        "tag": "sr-cn-domains",
        "format": "binary",
        "path": "/etc/sing-box/rules/<版本目录>/china-domains.srs"
      }
    ],
    "final": "proxy",
    "auto_detect_interface": true,
    "default_domain_resolver": "china-doh"
  }
}
```

`rule_set` 里只列出了一个规则集作为示例，其余五个写法相同；`route_exclude_address` 实际还包含更多保留地址段。局域网流量没有写成路由规则，而是直接排除在 TUN 之外。

### DNS 由谁处理

终端把 DNS 设成 `10.1.1.2` 之后，一次查询会经过这几步：

1. 旁路由上监听 53 端口的是 dnsmasq，它先查自己的缓存（我设成 1000 条）。
2. 缓存没有命中时，dnsmasq 转发给它配置的上游 `1.1.1.1:53`（不读取系统的 resolv 文件）。
3. 这个由旁路由自己发出的查询同样会被 TUN 接管：`auto_route` 也覆盖本机流量，`1.1.1.1` 又不在排除列表里。它在 TUN 里命中第一条 `port: 53` 的 `hijack-dns` 规则，交给 sing-box 的 DNS 处理，实际并不会直接发到 `1.1.1.1:53`。
4. sing-box 按 DNS 规则选择上游：直连规则和中国域名用阿里 DoH，代理规则和其他域名用经过代理出站的 Cloudflare DoH；所有结果只返回 IPv4 地址（`strategy: ipv4_only`）。

如果终端里写死了别的 DNS 服务器（例如 `8.8.8.8`），这些查询经过 TUN 时也会被同一条 `hijack-dns` 规则截获。用 `nslookup www.google.com 10.1.1.2` 查询后，sing-box 日志里能看到对应的 `dns: exchanged` 记录，可以确认这条链路生效。

dnsmasq 的缓存可以减少相同域名反复向上游查询的次数；但缓存只能减少重复查询和解析等待，不会提高 VPS 的带宽，也不能修复上游 DNS 返回错误地址的问题。

### 规则从哪里来，怎样接入

我参考的是 [Shadowrocket-ADBlock-Rules-Forever](https://github.com/Johnshall/Shadowrocket-ADBlock-Rules-Forever)。它提供多种 Shadowrocket 配置，包含按域名或 IP 分流的规则，也有广告拦截规则。我用的是其中的 `sr_top500_banlist_ad.conf`，它是 Shadowrocket 的完整配置文件：里面除了 `[Rule]`，还可能有 `[General]`、`RULE-SET` 外部引用、URL Rewrite 和 MITM 等 Shadowrocket 专用内容。它不是 sing-box 原生规则集，不能把下载 URL 直接填进 sing-box 的 `rule_set` 后就认为接入完成。

接入时先把“流量分流”和“广告拦截”分开看。我用的转换脚本会从 `[General]` 的 `skip-proxy` 生成一般直连规则，并把 `bypass-tun` 网段写进 TUN 入站的排除地址；从 `[Rule]` 解析出代理规则和 `REJECT` 规则。它把第一次广告拦截规则之前的代理项放进 `proxy-early`，广告拦截之后的代理项放进 `proxy-late`，用来保留源配置的先后关系。

- 转换脚本支持 `DOMAIN`、`DOMAIN-SUFFIX`、`DOMAIN-KEYWORD` 和 `IP-CIDR`，并将它们转换成 sing-box 域名/IP 匹配项；`DOMAIN-SUFFIX` 同时生成根域名和后缀匹配。
- Shadowrocket 规则里的 `PROXY`、`DIRECT`、`REJECT` 是客户端策略名，不能假设 sing-box 认识这些策略组名称。脚本把支持位置中的 `PROXY` 映射到代理出站，把 `REJECT` 映射到拦截动作；直连规则来自 `[General]` 的 `skip-proxy` 和独立的中国域名/IP 规则集。源文件以 `FINAL,DIRECT` 结尾（未匹配的流量直连），脚本只把它当作格式检查；我在 sing-box 里有意把未匹配的默认策略设为 `proxy`，这是和源配置最大的差异，影响见下文“故障影响和回退”。其他位置出现不支持的 `DIRECT` 规则会导致转换中止。
- `RULE-SET` 指向其他项目的列表，必须单独确认其格式和内容；不能只转换主文件而漏掉外部引用。
- URL Rewrite 和 MITM 属于应用层功能，不等同于路由器上的透明转发规则，不应混入普通的域名分流规则。

sing-box 原生规则集使用自己的 JSON 源格式，也可以编译成 `.srs` 二进制文件。对简单列表，可以整理为 sing-box 规则集，再用 `sing-box rule-set compile` 编译；路由配置通过规则集标签引用它，并明确匹配后执行的动作和目标出站。字段名称和规则集版本必须与路由器安装的 sing-box 版本匹配。具体格式可以参考 sing-box 官方的[规则集格式说明](https://sing-box.sagernet.org/zh/configuration/rule-set/)和[源文件格式说明](https://sing-box.sagernet.org/zh/configuration/rule-set/source-format/)。

因此，规则转换是一个可重复的步骤，而不是手工复制几万行文本。脚本从 Shadowrocket 文件提取支持的规则类型，再生成 sing-box JSON 源规则集，并调用 `sing-box rule-set compile` 生成 `.srs` 二进制文件。中国域名和 IP 列表则直接下载 sing-box 官方生态提供的 `.srs` 文件。最终配置引用六个本地规则集：`sr-direct-general`、`sr-proxy-early`、`sr-reject`、`sr-proxy-late`、`sr-cn-domains` 和 `sr-cn-ips`。

转换器会对源文件大小、`[Rule]` 区段、外部规则集地址和规则数量做检查；遇到未知语法、意外的策略或转换失败，就停止更新并保留现有规则，不会静默跳过不认识的行。源文件里的 URL Rewrite 和 MITM 内容不会导入 sing-box。转换后的规则集不包含 VPS 节点凭据。

### 每周更新与回滚

规则项目每天 UTC 23:00（北京时间 07:00）自动构建发布；我用每周更新，减少不必要的下载和服务重启。定时任务写在 `/etc/crontabs/root`：

```text
0 1 * * 0 /root/update-shadowrocket-rules.sh >/dev/null 2>&1
```

我的 OpenWrt 系统时区是 GMT，因此该任务对应北京时间每周日 09:00。更新脚本是 `/root/update-shadowrocket-rules.sh`，规则和版本目录位于 `/etc/sing-box/rules/`，配置位于 `/etc/sing-box/config.json`。脚本下载的主要来源包括：

- Shadowrocket 主规则：[`sr_top500_banlist_ad.conf`](https://johnshall.github.io/Shadowrocket-ADBlock-Rules-Forever/sr_top500_banlist_ad.conf)
- Apple News 外部规则：[`AppleNews.list`](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/AppleNews/AppleNews.list)
- 中国域名和 IP 的 sing-box 二进制规则集：SagerNet 的 `sing-geosite`（`geosite-geolocation-cn.srs`）与 `sing-geoip`（`geoip-cn.srs`）项目

每轮更新的流程是：

1. 用锁文件防止更新任务并发运行，在 `/tmp` 建立临时工作目录；所有新下载先写到临时目录，不覆盖正在使用的规则。
2. 下载主规则、Apple News 列表和两个中国规则集，检查文件大小（主规则至少 1 MB，中国规则集至少 10 KB）和 `[Rule]` 区段。
3. 解析 Shadowrocket 主文件及 Apple News 列表，对支持的规则进行计数和格式校验；遇到未知语法或意外的外部规则集时，记录错误并退出。
4. 编译 `direct`、`proxy-early`、`reject`、`proxy-late` 四个规则集。
5. 计算所有源文件和转换脚本版本的 SHA-256 摘要，与上一次记录比较；没有变化（且当前配置结构符合预期）时，到此结束，不替换文件也不重启服务。
6. 用新规则集生成候选 sing-box 配置，并用 `sing-box check` 校验；不通过就退出，正在运行的配置不受影响。
7. 先把当前配置和旧规则备份到 `/root/sing-box-rules-backups/<UTC 时间戳>/`，再把新规则移到同名的版本目录，生成指向这个目录的最终配置并再校验一次，然后原子替换 `/etc/sing-box/config.json`。
8. 重启 sing-box，3 秒后确认进程仍在运行。重启失败或进程退出时，恢复备份的配置并再次启动。
9. 写入新的摘要，记录更新结果，并删除旧的版本目录，`/etc/sing-box/rules/` 只保留最近四个版本供回滚。

sing-box 的远程规则集机制可以按 `update_interval` 定期拉取原生格式规则集；Shadowrocket 配置不属于这种原生格式，所以采用 OpenWrt 本地脚本定时下载、转换、校验和替换。

### 确认更新任务在正常运行

我写这篇文章时的环境是 OpenWrt 25.12.6、sing-box 1.13.21。装好定时任务后，可以这样检查：

- `sing-box check -c /etc/sing-box/config.json` 应该通过，sing-box 进程正在运行。
- `/etc/sing-box/rules/` 下最新的版本目录里，应该有四个转换后的规则集，以及中国域名和 IP 规则集；`/root/sing-box-rules-backups/` 下有对应时间戳的备份。
- 脚本用 `logger -t sr-rules-update` 记录结果，可以用 `logread | grep sr-rules-update` 查看。不过 OpenWrt 的系统日志是内存里的环形缓冲区，sing-box 在 `info` 级别下日志很多，我的旁路由上缓冲区只能保留十几分钟的记录，每周一次的更新日志很快就会被冲掉。想留下更新记录，可以把 sing-box 的日志级别调到 `warn`，或者让脚本把结果另外写进一个文件。

## DNS 与 IPv6 的一个实际问题

我遇到的一个问题与代理节点本身无关。Android 电视已经把 IPv4 网关和 DNS 指向旁路由，但主路由仍通过 IPv6 网络通告了运营商 DNS。电视可能优先使用这个 IPv6 DNS，得到不正确的 YouTube 地址，于是请求没有按预期使用旁路由的解析结果。

我的处理是：主路由保留 IPv6 地址通告和 IPv6 默认路由，停用 DHCPv6，并停止通过 IPv6 路由通告发布有问题的 DNS 地址；IPv4 DNS 继续指向旁路由。电视重新连接网络后，YouTube 首页恢复正常。

需要注意两点：

- **这是全网范围的改动。** DHCPv6 和路由通告是主路由发给所有设备的，停掉 IPv6 DNS 通告会影响家里每一台设备，而不只是测试设备。其他设备仍能通过 IPv4 的 DHCP 拿到主路由下发的 DNS，日常上网通常不受影响，但调整前要清楚影响范围，并选择方便回退的时间。
- **IPv6 流量本身仍然绕过旁路由。** 主路由保留了 IPv6 默认路由，终端的 IPv6 连接会直接经主路由出去，不经过旁路由，也就不受分流规则控制。这个方案能成立，是因为旁路由的 sing-box DNS 设置了 `"strategy": "ipv4_only"`，只给终端返回 IPv4 地址，终端就只会通过 IPv4 访问这些网站。如果 DNS 返回了 AAAA 记录，支持 IPv6 的应用会直接用 IPv6 访问，代理规则对它完全无效。

这次调整影响的是终端通过路由器自动获得的 DNS 服务器，不是关闭 IPv6。局域网设备仍可使用 IPv6 地址互相访问，互联网 IPv6 路由也仍然存在。不过，设备在手工设置里保留的 DNS、浏览器的加密 DNS，或应用自带的 DoH/DoT 解析，仍可能绕过 DHCP/RA 通告的 DNS，因此出现解析差异时需要分别检查这些来源。

## 如何验证链路

建议把验证分成几层，不要只凭一个网站能否打开来判断整套方案：

1. 确认旁路由固定地址可达，DHCP 没有和主路由冲突，默认网关指向主路由。
2. 确认 sing-box 配置校验通过、服务正常运行，Hysteria2 节点连接成功。
3. 在测试设备上确认网关和 DNS 都是旁路由地址，并重新连接网络以清除旧的 DNS 状态。
4. 分别访问预期直连的网站和预期代理的网站，对照旁路由连接日志里的目标地址与出站标签。
5. 再测试 YouTube 等容易受 DNS 和 IPv6 影响的应用；如失败，先确认终端实际使用的 DNS 和解析结果（是否拿到了 AAAA 记录），再看请求走了哪个出站。
6. 暂停 VPS 或代理节点时，验证国内直连网站仍可访问；代理目的地预计会失败。恢复 VPS 后，确认代理路径重新可用。

实际排查电视时，日志显示测试设备流量已经到达旁路由，代理节点也可连接；问题最后定位到终端使用了主路由通告的 IPv6 DNS。移除这条错误 DNS 通告、让电视重新获取网络配置后，YouTube 才恢复。这说明 DNS、路由规则、隧道和 VPS 出口需要分别验证。

## 故障影响和回退

旁路由的故障影响范围取决于哪些设备把它设成默认网关。测试阶段只改一台设备，因此旁路由关机或代理断开时，其他设备仍沿用主路由。测试设备可以把网关和 DNS 改回 `10.1.1.1`，恢复原来的直连路径。

如果 VPS 中断，规则判定为代理的流量无法访问；规则判定为直连的流量仍可经主路由上网。由于未匹配任何规则的流量默认走代理，VPS 中断时受影响的不只是明确列为代理的网站，还包括所有没被规则覆盖的网站，其中可能有不在中国域名列表里的国内小站。如果更看重 VPS 故障时的可用性，可以把默认策略改回直连，代价是部分未收录的境外网站需要手动补充规则。

DNS 是否也受影响，则取决于旁路由使用的解析上游：我的配置里，代理规则和未匹配的域名都用经过代理出站的 `cloudflare-doh` 解析，节点中断时这些新域名会解析失败；中国域名和直连规则用阿里 DoH，不受影响。因此要实际断开代理测试国内域名解析，而不是只假设直连规则会自动解决 DNS 故障。

在扩大到全家设备之前，还要准备好配置备份和恢复步骤，记录 OpenWrt 版本、sing-box 版本、网络地址、DNS 上游和规则来源。更新前保存当前可用配置；更新后先做配置校验和小范围访问测试。任何全网级别的网关、DHCP 或 IPv6 DNS 调整，都应安排在可以立即回退的时候进行。

## 总结

NAS 虚拟机里的 OpenWrt 可以作为一台独立旁路由，让终端统一使用分流代理，同时把试错范围限制在指定设备。对我来说，这次最重要的经验不是单纯把代理客户端跑起来，而是分开验证网关、DNS、规则、隧道和 VPS 出口，并保留随时切回主路由的办法。

这套方案仍然依赖 NAS、旁路由配置和 VPS 的可用性。先从一台测试设备开始，观察直连和代理两条路径，再逐步扩大范围，比直接把全家的默认流量切过去更容易排查和恢复。
