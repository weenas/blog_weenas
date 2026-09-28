---
title: Transparent Proxy on OpenWrt
image: https://photo.weenas.com/gtB7gP.png
date: 2023-08-14T15:13:18+08:00
description: A new approach to proxying for the home network
keywords:
  - proxy
  - openwrt
  - shadowsocks
tags:
  - network
  - openwrt
pubDatetime: 2023-08-14
---
## Introduction

A proxy forwards data on behalf of clients. It's commonly used inside companies — for example, a proxy server through which employees access the internet. Traffic passing through the proxy can be inspected for its destination address to decide whether access is allowed. To use a proxy, you configure the proxy type, server address and port in the operating system. Nowadays gateways can provide similar functions, so standalone proxy servers have become far less visible.

Following the same idea, we can set up a proxy server on the LAN, establish a Shadowsocks tunnel on it, and let LAN users get past the firewall once they've configured the proxy. For a while I did exactly that, and Chrome even has extensions to choose which websites go through the proxy. But this approach has some problems:
- Every new computer needs the proxy configured again, and if all traffic goes through the proxy, domestic websites become slow
- If traffic is routed automatically based on site lists, those lists are scattered across machines instead of configured centrally
- Using and configuring it on mobile devices is inconvenient

This is where a transparent proxy comes in. It's invisible to users: as long as they're connected to the LAN or Wi-Fi, it just works, and users never notice the proxy exists — hence the name "transparent proxy". The router or gateway defines a set of rules (usually a pool of IP addresses); traffic matching the rules automatically goes out through the proxy, and everything else goes out through the gateway as usual.

## Installing Packages
```sh
opkg install iptables-nft iptables-mod-nat-extra curl ipset bind-dig shadowsocks-libev
```
## Configuring shadowsocks-libev

OpenWrt's shadowsocks-libev includes four components:
- ss-local creates a Shadowsocks client on OpenWrt and opens a port to serve as a local proxy
- ss-redir creates a traffic-forwarding path inside OpenWrt
- ss-tunnel creates an encrypted channel for DNS queries
- ss-server runs a Shadowsocks server on OpenWrt
Neither ss-local nor ss-server is used for a transparent proxy, so only ss-redir and ss-tunnel are covered here.

### ss-tunnel
First, use ss-tunnel to set up an encrypted DNS channel, as in the configuration below. It creates a local DNS service listening on port 530; each DNS request it receives is encrypted and forwarded through the Shadowsocks tunnel to `8.8.8.8:53`.
```json 
# /var/etc/shadowsocks-libev/ss_tunnel.cfg0249c0.json
{
        "server": "156.141.119.237",
        "server_port": 8080,
        "method": "chacha20-ietf-poly1305",
        "password": "password",
        "tunnel_address": "8.8.8.8:53",
        "use_syslog": true,
        "ipv6_first": false,
        "fast_open": true,
        "reuse_port": true,
        "no_delay": true,
        "local_address": "0.0.0.0",
        "local_port": 530,
        "mode": "tcp_and_udp",
        "timeout": 60
}
```
Once ss-tunnel is running, you can verify it with the `dig` command:
```
dig @127.0.0.1 -p 530 www.google.com

; <<>> DiG 9.18.11 <<>> @127.0.0.1 www.google.com
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 43676
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 512
;; QUESTION SECTION:
;www.google.com.                        IN      A

;; ANSWER SECTION:
www.google.com.         300     IN      A       142.250.199.68

;; Query time: 60 msec
;; SERVER: 127.0.0.1#53(127.0.0.1) (UDP)
;; WHEN: Thu Jun 01 10:40:39 UTC 2023
;; MSG SIZE  rcvd: 59
```
If the query succeeds, this step is done.
### ss_redir
ss_redir creates an encrypted channel for forwarding traffic. The configuration below listens on port `1090`, forwards the data it receives to Shadowsocks, and receives the responses.
```json
# /var/etc/shadowsocks-libev/ss_redir.hi.json
{
        "server": "156.141.119.237",
        "server_port": 8080,
        "method": "chacha20-ietf-poly1305",
        "password": "password",
        "use_syslog": true,
        "ipv6_first": false,
        "fast_open": true,
        "reuse_port": true,
        "no_delay": true,
        "local_address": "0.0.0.0",
        "local_port": 1090,
        "mode": "tcp_and_udp",
        "timeout": 60
}
```
Once this service is up, we need iptables to verify that it works, so let's configure iptables first.

## iptables
iptables defines how the system handles each IP packet based on its address or port, so a wrong configuration can break networking. First, two important commands for backing up and restoring the iptables rules, to avoid serious problems from configuration mistakes:
```sh
iptables-save > iptables.rules
iptables-restore < iptables.rules
```
You can use iptables-save at different stages to save different rule sets — just use different file names. Likewise, when restoring, be clear about which stage you're restoring to.

Before creating any rules, let's use curl to test whether we can fetch `http://www.google.com`. Since the IP address behind a domain changes easily, we use the address from the dig query above: `142.250.199.68`
```sh
curl http://142.250.199.68
```
Normally this command gets no response at all, because the IP is blocked.
But with a simple configuration, it's time to witness a miracle.
We use iptables to redirect traffic to this IP address to port 1090, created by ss_redir above:
```sh
iptables -t nat -A OUTPUT -d 142.250.199.68 -p tcp --dport 80 -j REDIRECT --to-port 1090
```
Now test again with curl:
```sh
curl http://142.250.199.68
<HTML><HEAD><meta http-equiv="content-type" content="text/html;charset=utf-8">
<TITLE>301 Moved</TITLE></HEAD><BODY>
<H1>301 Moved</H1>
The document has moved
<A HREF="http://www.google.com/">here</A>.
</BODY></HTML>
```
See that? We get a response from Google's server, which means the path works. Next comes optimization.

## ipset
iptables is fine for rules covering a few IP addresses, but it becomes unwieldy with a large number of them. In that case you can use ipset instead: ipset defines a set of IP addresses, and iptables rules then refer to the set by name.
Before configuring, restore iptables to its initial state with iptables-restore:
```sh
iptables-restore < iptables.rules
```
### Defining a New ipset
Define an ipset named SHADOWSOCKS and add the IP address above to it:
```sh
ipset -N SHADOWSOCKS hash:ip
ipset add SHADOWSOCKS 142.250.199.68
```
### Adding the ipset to iptables
Here, OUTPUT applies to local packets, i.e. whether packets generated by the router itself go through the rule, while PREROUTING applies to routed packets. Choose as needed.
```sh
iptables -t nat -A OUTPUT -p tcp -m set --match-set SHADOWSOCKS dst -j REDIRECT --to-port 1090
iptables -t nat -A OUTPUT -p udp -m set --match-set SHADOWSOCKS dst -j REDIRECT --to-port 1090
iptables -t nat -A PREROUTING -p tcp -m set --match-set SHADOWSOCKS dst -j REDIRECT --to-port 1090
iptables -t nat -A PREROUTING -p udp -m set --match-set SHADOWSOCKS dst -j REDIRECT --to-port 1090
```
To add a new IP address later, just run `ipset add SHADOWSOCKS ip_addr`.

### Improving the ipset
ipset makes it easy to manage many IP addresses, but adding and maintaining them by hand is clearly impractical. Fortunately a tool can do it for us: dnsmasq.
The dnsmasq bundled with OpenWrt is a stripped-down build, so first install the full version:
```sh
opkg remove dnsmasq
opkg install dnsmasq-full
```
The full dnsmasq supports ipset and can automatically add the resolved IP addresses of configured domains to the corresponding ipset. dnsmasq's configuration is generated by the system from `/etc/config/dhcp`. The default `conf-dir` is `/tmp/dnsmasq.d`, a temporary directory that is cleared on reboot, so point it to a directory under `/etc`:
```
config dnsmasq
	...
	option confdir '/etc/dnsmasq.d'
```
Create the directory `/etc/dnsmasq.d` as configured above, and inside it create a file `SHADOWSOCKS.conf` in this format:
```
server=/google.com/127.0.0.1#530
ipset=/google.com/SHADOWSOCKS
```
This tells dnsmasq to forward DNS queries for `google.com` to `127.0.0.1:530` and add the results for `google.com` to the SHADOWSOCKS ipset. That way, no matter how the domain's IP addresses change, traffic to the correct addresses is always sent through Shadowsocks. We just add every domain that should be proxied to this file, and both the DNS queries and the traffic for those domains go through the Shadowsocks tunnel.

Adding domains to this file is yet another headache, but some kind folks have built a tool that generates it automatically — and if you don't even want to run that, they also provide ready-made config files. Take whatever you need:
```
https://github.com/cokebar/gfwlist2dnsmasq
```
