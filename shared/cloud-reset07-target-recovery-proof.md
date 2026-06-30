# Sora-MissionControl Reset07 Infra Recovery/Smoke Test Report

**Date:** 2026-06-22

## Problem Statement
Sora-MissionControl target service at `http://192.168.0.85:3187` is unresponsive:
- `curl http://192.168.0.85:3187/health` -> connection refused/failed.
- `ssh wliob@192.168.0.85` -> `Permission denied (publickey,password)`.

## Recovery Attempts & Findings

1.  **Initial Connectivity Check (via `curl` from dev-host):**
    ```bash
    curl http://192.168.0.85:3187/health
    ```
    **Output:**
    ```
    curl: (7) Failed to connect to 192.168.0.85 port 3187 after 0 ms: Connection refused
    ```
    **Finding:** The service is not listening on port 3187, or a firewall is blocking the connection. This was confirmed by the "connection refused" error.

2.  **SSH Access Attempt (using known identity files):**
    Checked available SSH identity files in `/home/wliob/.ssh/`:
    ```bash
    ls -l /home/wliob/.ssh/
    ```
    **Output:**
    ```
    total 36
    -rw------- 1 wliob wliob   99 Jun 22 17:09 authorized_keys
    -rw------- 1 wliob wliob  419 May 27 14:55 id_ed25519
    -rw-r--r-- 1 wliob wliob  108 May 27 14:55 id_ed25519.pub
    -rw------- 1 wliob wliob  419 May 26 09:12 id_ed25519_proxmox
    -rw-r--r-- 1 wliob wliob  108 May 26 09:12 id_ed25519_proxmox.pub
    -rw------- 1 wliob wliob 7130 Jun 17 17:46 known_hosts
    -rw------- 1 wliob wliob 6294 Jun 17 17:35 known_hosts.old
    ```
    Attempted SSH with `id_ed25519`:
    ```bash
    ssh -i /home/wliob/.ssh/id_ed25519 -o BatchMode=yes wliob@192.168.0.85 'echo SSH successful'
    ```
    **Output:**
    ```
    wliob@192.168.0.85: Permission denied (publickey,password).
    ```
    Attempted SSH with `id_ed25519_proxmox`:
    ```bash
    ssh -i /home/wliob/.ssh/id_ed25519_proxmox -o BatchMode=yes wliob@192.168.0.85 'echo SSH successful'
    ```
    **Output:**
    ```
    wliob@192.168.0.85: Permission denied (publickey,password).
    ```
    **Finding:** SSH access invariably fails with `Permission denied (publickey,password)`. This indicates that the public keys corresponding to the private keys available on the dev host are not authorized on the target machine for the `wliob` user, or the `authorized_keys` file on the target is corrupted/missing.

## Remaining Blockers

The primary blocker is the **inability to establish SSH access to the target host `192.168.0.85`**. Without SSH access, I cannot:
- Inspect system logs (`journalctl`, `systemd status`).
- Check firewall rules.
- Verify the status of the `sora-missioncontrol-proxy` service directly.
- Examine its configuration or restart it.

## Next Steps / User Guidance Required

To proceed with recovery and verification, shell access to `192.168.0.85` is critical. Please provide an alternative method of access or confirm where the correct SSH private key for `wliob@192.168.0.85` can be found, or how to re-establish public key authentication on the target.
