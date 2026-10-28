#cloud-config
# MoveProof demo VM: deploy user with SSH key, Docker Engine + Compose plugin.
users:
  - name: moveproof
    groups: [sudo, docker]
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - __SSH_PUBLIC_KEY__
package_update: true
packages: [ca-certificates, curl, git]
runcmd:
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  # Pinned to noble: the Nebius ubuntu24.04 image reports a newer codename, whose
  # Docker packages need libraries noble does not have.
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - usermod -aG docker moveproof
  - systemctl enable --now docker
  - touch /var/lib/cloud/moveproof-ready
