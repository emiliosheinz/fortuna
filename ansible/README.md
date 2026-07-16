# Ansible

> **Deployments paused: VPS decommissioned.** Every automated production deploy is disabled; the pipeline, playbooks, secrets, and this document remain intact for a future resume. See [.specs/disable-deployments/spec.md](../.specs/disable-deployments/spec.md).

Host configuration and release delivery for the Fortuna production VPS.

The split mirrors the technical design (`.specs/vps-deployment/TECHNICAL-DESIGN.md`): host configuration plays run from the operator workstation; only the release-delivery playbook runs from GitHub Actions.

## Playbooks

| Playbook | Run from | Purpose |
|----------|----------|---------|
| `site.yml` | Operator workstation | Converge the host to the operational baseline: `common`, `hardening`, `volume_mount`, `docker`, `fx_smoke`. |
| `certbot-bootstrap.yml` | Operator workstation | One-shot first issuance of Let's Encrypt certificates for both public subdomains (staging then production). |
| `deploy.yml` | GitHub Actions (and ad-hoc from workstation) | Materialize the host-side `.env`, ship the compose payload, `docker compose pull && up -d --remove-orphans`, poll the `web` healthcheck. |

## Layout

```
ansible/
  ansible.cfg
  inventory.yml          # static; ansible_host comes from the operator-captured VPS IP
  requirements.yml       # pinned collections (community.docker, community.general)
  group_vars/all.yml     # defaults shared by every play
  site.yml
  certbot-bootstrap.yml
  deploy.yml
  roles/
    common/              # apt baseline + unattended-upgrades
    hardening/           # deploy user, SSH hardening, ufw, restricted sudoers
    volume_mount/        # mount the attached Hetzner Volume at /var/lib/docker/volumes
    docker/              # Docker Engine + compose plugin
    fx_smoke/            # confirm api.frankfurter.app is reachable from the host
```

## Running locally

```sh
# install collections once
ansible-galaxy collection install -r requirements.yml

# dry-run every host-config change first
ansible-playbook site.yml --check --diff

# apply
ansible-playbook site.yml

# first-cert issuance after the host is converged
ansible-playbook certbot-bootstrap.yml

# ad-hoc redeploy from the workstation (GHA owns the tag-driven path)
ansible-playbook deploy.yml -e env_file=/path/to/materialized/.env
```

The inventory expects `DEPLOY_SSH_HOST` (or `--inventory inventory.yml -e deploy_host=...`) to identify the production host. See `inventory.yml` for the active pattern.
