#!/usr/bin/env bash
#
# gateway_setup.sh -- Install / update / uninstall the nginx gateway runtime on a managed host.
#
# Usage:
#   gateway_setup.sh <install|update|uninstall> [options]
#
# Options:
#   --version VER   nginx version to install (e.g. 1.28.0). REQUIRED for install/update.
#   --config  PATH  custom nginx config file to drop into /etc/nginx/conf.d/. Optional.
#   --name    NAME  conf.d file basename (default: gateway). Produces <name>.conf.
#   --defer-start   Install/update nginx but leave service activation to the caller after validation.
#
# Behavior:
#   install   Configure the nginx.org repo, install the requested version, optionally inject the
#             custom config, enable + start the service and wait for readiness.
#   update    Idempotently re-apply repo/key, install the requested version (downgrade allowed),
#             re-inject config if provided, validate and restart the service.
#   uninstall Stop the service, remove the nginx package and clean up repo/key/config files.
#
# Supported distributions: RHEL family / Debian / Ubuntu / SLES/openSUSE / Alpine.
# Supported init systems: systemd / OpenRC. The script exits if neither is present.
#
# Reference: https://nginx.org/en/linux_packages.html
set -Eeuo pipefail

# ---------- Constants ----------
NGINX_GPG_KEYRING_DEB="/usr/share/keyrings/nginx-archive-keyring.gpg"
NGINX_GPG_FINGERPRINT="573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62"
NGINX_KEY_URL="https://nginx.org/keys/nginx_signing.key"
NGINX_KEY_RSA_URL="https://nginx.org/keys/nginx_signing.rsa.pub"
NGINX_CONF_DIR="/etc/nginx"
NGINX_CONF_D="${NGINX_CONF_DIR}/conf.d"
READY_TIMEOUT=30
READY_INTERVAL=2
DEFAULT_NAME="gateway"

# ---------- Helpers ----------
log()  { printf '\033[0;36m[gateway_setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[gateway_setup][WARN]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[0;31m[gateway_setup][ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

# Invoked by the ERR trap; prints the failing line and exit code so failures are traceable.
on_error() {
    local exit_code=$? line=${1:-?}
    die "Script failed at line ${line} (exit ${exit_code}). Check the logs above for details."
}
trap 'on_error ${LINENO}' ERR

have() { command -v "$1" >/dev/null 2>&1; }

# Verify the nginx signing key by fingerprint / structure before trusting it.
verify_key() {
    local keyfile="$1"
    case "$keyfile" in
        *.gpg|*signing.key)
            if ! gpg --dry-run --quiet --no-keyring --import --import-options import-show "$keyfile" 2>/dev/null \
                 | grep -q "$NGINX_GPG_FINGERPRINT"; then
                die "GPG key fingerprint mismatch for ${keyfile} (expected ${NGINX_GPG_FINGERPRINT})."
            fi
            log "GPG key fingerprint verified: ${NGINX_GPG_FINGERPRINT}"
            ;;
        *.rsa.pub)
            if ! openssl rsa -pubin -in "$keyfile" -text -noout >/dev/null 2>&1; then
                die "Failed to parse RSA public key ${keyfile}."
            fi
            log "RSA public key validated: ${keyfile}"
            ;;
        *)
            die "Unknown key file type: ${keyfile}"
            ;;
    esac
}

# ---------- Parse arguments ----------
ACTION="${1:-}"
[ -n "$ACTION" ] || die "Missing action. Usage: $0 <install|update|uninstall> [--version VER] [--config PATH] [--name NAME]"
shift || true

NGINX_VERSION=""
CONFIG_PATH=""
CONF_NAME="$DEFAULT_NAME"
DEFER_START=0

while [ $# -gt 0 ]; do
    case "$1" in
        --version) NGINX_VERSION="${2:-}"; shift 2 ;;
        --config)  CONFIG_PATH="${2:-}";   shift 2 ;;
        --name)    CONF_NAME="${2:-}";     shift 2 ;;
        --defer-start) DEFER_START=1; shift ;;
        -h|--help)
            sed -n '2,/^set -Eeuo/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) die "Unknown option: $1" ;;
    esac
done

case "$ACTION" in
    install|update|uninstall) ;;
    *) die "Unknown action: ${ACTION}. Expected install|update|uninstall." ;;
esac

if [ "$ACTION" != "uninstall" ]; then
    [ -n "$NGINX_VERSION" ] || die "--version is required for ${ACTION}. Example: $0 ${ACTION} --version 1.28.0"
fi
if [ -n "$CONFIG_PATH" ]; then
    [ -f "$CONFIG_PATH" ] || die "CONFIG file does not exist: ${CONFIG_PATH}"
    [ -r "$CONFIG_PATH" ] || die "CONFIG file is not readable: ${CONFIG_PATH}"
fi
# sanitize conf name (allow word chars only)
case "$CONF_NAME" in
    *[!A-Za-z0-9_.-]*) die "Invalid --name '${CONF_NAME}'; only A-Z a-z 0-9 . _ - allowed." ;;
esac

# ---------- Pre-flight checks ----------
[ "${EUID:-$(id -u)}" -eq 0 ] || die "Root privileges required; please run with sudo or as root."
have curl || die "curl not found; please install curl first."

# ---------- Detect distribution + package manager ----------
log "Detecting OS distribution and package manager"

OS_RELEASE="/etc/os-release"
[ -f "$OS_RELEASE" ] || die "/etc/os-release not found, cannot identify distribution."
# shellcheck disable=SC1090
. "$OS_RELEASE"

OS_ID="${ID:-}"
OS_ID_LIKE="${ID_LIKE:-}"
OS_VERSION_ID="${VERSION_ID:-}"
OS_CODENAME="${VERSION_CODENAME:-}"

detect_pkg_mgr() {
    case "$OS_ID" in
        rhel|centos|rocky|almalinux|ol|fedora|amzn) echo "rpm" ;;
        debian|ubuntu) echo "apt" ;;
        sles|opensuse|opensuse-leap|opensuse-tumbleweed|opensuse-microos) echo "zypper" ;;
        alpine) echo "apk" ;;
        *)
            case " $OS_ID_LIKE " in
                *" rhel "*|*" fedora "*|*" centos "*) echo "rpm" ;;
                *" debian "*) echo "apt" ;;
                *" suse "*|*" sles "*) echo "zypper" ;;
            esac
            ;;
    esac
}

PKG_MGR="$(detect_pkg_mgr || true)"
if [ -z "$PKG_MGR" ]; then
    log "Distribution (ID=${OS_ID}, ID_LIKE=${OS_ID_LIKE}) not matched directly, falling back to probing mainstream package managers..."
    for cand in dnf yum apt zypper apk; do
        if have "$cand"; then
            case "$cand" in
                dnf|yum) PKG_MGR="rpm" ;;
                apt)     PKG_MGR="apt" ;;
                zypper)  PKG_MGR="zypper" ;;
                apk)     PKG_MGR="apk" ;;
            esac
            log "Found package manager command: ${cand}"
            break
        fi
    done
fi
[ -n "$PKG_MGR" ] || die "Cannot determine package manager (ID=${OS_ID}, ID_LIKE=${OS_ID_LIKE}); none of dnf/yum/apt/zypper/apk found."

case "$PKG_MGR" in
    rpm)    RPM_MGR="$(have dnf && echo dnf || echo yum)" ;;
    apt|zypper|apk) ;;
    *) die "Internal error: unknown package manager type ${PKG_MGR}." ;;
esac
log "Distribution: ${OS_ID} ${OS_VERSION_ID}${OS_CODENAME:+ ($OS_CODENAME)}, package manager: ${PKG_MGR}${RPM_MGR:+ ($RPM_MGR)}"

# ---------- Detect init system ----------
log "Detecting init system"

INIT_SYSTEM=""
if { [ -d /run/systemd/system ] && have systemctl; } \
   || { have systemctl && systemctl is-system-running >/dev/null 2>&1; }; then
    INIT_SYSTEM="systemd"
elif { have rc-service && have rc-update; } || [ -d /run/openrc ]; then
    INIT_SYSTEM="openrc"
fi
if [ -z "$INIT_SYSTEM" ]; then
    PID1="$(ps -p 1 -o comm= 2>/dev/null | tr -d ' ' || echo unknown)"
    die "Neither systemd nor OpenRC detected (PID1=${PID1}, OS=${OS_ID}, PKG_MGR=${PKG_MGR}). Only systemd / OpenRC hosts are supported."
fi
log "init system: ${INIT_SYSTEM}"

# ---------- Repo + key setup (shared by install/update) ----------
setup_apt_repo() {
    local keyring_pkg
    case "$OS_ID" in
        ubuntu) keyring_pkg="ubuntu-keyring" ;;
        *)      keyring_pkg="debian-archive-keyring" ;;
    esac
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl gnupg2 ca-certificates lsb-release "$keyring_pkg"

    if [ ! -s "$NGINX_GPG_KEYRING_DEB" ]; then
        curl -fsSL "$NGINX_KEY_URL" | gpg --dearmor \
            | tee "$NGINX_GPG_KEYRING_DEB" >/dev/null
        chmod 644 "$NGINX_GPG_KEYRING_DEB"
    fi
    verify_key "$NGINX_GPG_KEYRING_DEB"

    local codename="$OS_CODENAME"
    if [ -z "$codename" ]; then
        codename="$(lsb_release -cs 2>/dev/null || true)"
    fi
    [ -n "$codename" ] || die "Cannot determine distribution codename, apt repo setup failed."

    local repo_file="/etc/apt/sources.list.d/nginx.list"
    cat > "$repo_file" <<EOF
deb [signed-by=${NGINX_GPG_KEYRING_DEB}] https://nginx.org/packages/${OS_ID} ${codename} nginx
EOF
    log "apt repo written: ${repo_file}"

    cat > /etc/apt/preferences.d/99nginx <<'EOF'
Package: *
Pin: origin nginx.org
Pin: release o=nginx
Pin-Priority: 900
EOF

    apt-get update -y
}

setup_rpm_repo() {
    "$RPM_MGR" install -y yum-utils

    local repo_file="/etc/yum.repos.d/nginx.repo"
    local baseurl_stable baseurl_mainline
    case "$OS_ID" in
        amzn)
            if [ "${OS_VERSION_ID%%.*}" = "2" ]; then
                baseurl_stable="https://nginx.org/packages/amzn2/\$releasever/\$basearch/"
                baseurl_mainline="https://nginx.org/packages/mainline/amzn2/\$releasever/\$basearch/"
            else
                baseurl_stable="https://nginx.org/packages/amzn/2023/\$basearch/"
                baseurl_mainline="https://nginx.org/packages/mainline/amzn/2023/\$basearch/"
            fi
            ;;
        *)
            baseurl_stable="https://nginx.org/packages/centos/\$releasever/\$basearch/"
            baseurl_mainline="https://nginx.org/packages/mainline/centos/\$releasever/\$basearch/"
            ;;
    esac
    cat > "$repo_file" <<EOF
[nginx-stable]
name=nginx stable repo
baseurl=${baseurl_stable}
gpgcheck=1
enabled=1
gpgkey=${NGINX_KEY_URL}
module_hotfixes=true

[nginx-mainline]
name=nginx mainline repo
baseurl=${baseurl_mainline}
gpgcheck=1
enabled=0
gpgkey=${NGINX_KEY_URL}
module_hotfixes=true
EOF
    log "yum repo written: ${repo_file} (stable segment enabled)"

    if [ ! -f /etc/pki/rpm-gpg/nginx_signing.key ] && ! rpm -q gpg-pubkey --qf '%{NAME}-%{VERSION}-%{RELEASE}\n' 2>/dev/null | grep -qi nginx; then
        curl -fsSL -o /tmp/nginx_signing.key "$NGINX_KEY_URL"
        verify_key /tmp/nginx_signing.key
        rpmkeys --import /tmp/nginx_signing.key
        rm -f /tmp/nginx_signing.key
    fi
}

setup_zypper_repo() {
    zypper --non-interactive --gpg-auto-import-keys refresh || true
    zypper --non-interactive install -y curl ca-certificates gpg2

    local major="${OS_VERSION_ID%%.*}"
    [ -n "$major" ] || die "Cannot determine SLES major version (VERSION_ID=${OS_VERSION_ID})."

    if ! zypper repos --export /dev/null 2>/dev/null | grep -q '^nginx-stable'; then
        zypper --non-interactive addrepo --gpgcheck --type yum --refresh --check \
            "https://nginx.org/packages/sles/${major}" nginx-stable
        log "zypper repo added: nginx-stable"
    fi

    if ! rpm -q gpg-pubkey --qf '%{NAME}-%{VERSION}-%{RELEASE}\n' 2>/dev/null | grep -qi nginx; then
        curl -fsSL -o /tmp/nginx_signing.key "$NGINX_KEY_URL"
        verify_key /tmp/nginx_signing.key
        rpmkeys --import /tmp/nginx_signing.key
        rm -f /tmp/nginx_signing.key
    fi
    zypper --non-interactive --gpg-auto-import-keys refresh nginx-stable || true
}

setup_apk_repo() {
    apk add --no-cache openssl curl ca-certificates

    local alpine_ver
    alpine_ver="$(grep -Eo '^[0-9]+\.[0-9]+' /etc/alpine-release 2>/dev/null || true)"
    [ -n "$alpine_ver" ] || die "Cannot parse Alpine version (/etc/alpine-release)."

    local repo_line="@nginx https://nginx.org/packages/alpine/v${alpine_ver}/main"
    if ! grep -qxF "$repo_line" /etc/apk/repositories 2>/dev/null; then
        printf '%s\n' "$repo_line" >> /etc/apk/repositories
        log "apk repo appended: ${repo_line}"
    fi

    if [ ! -f /etc/apk/keys/nginx_signing.rsa.pub ]; then
        curl -fsSL -o /etc/apk/keys/nginx_signing.rsa.pub "$NGINX_KEY_RSA_URL"
        chmod 644 /etc/apk/keys/nginx_signing.rsa.pub
    fi
    verify_key /etc/apk/keys/nginx_signing.rsa.pub

    apk update
}

setup_repo() {
    case "$PKG_MGR" in
        apt)    setup_apt_repo ;;
        rpm)    setup_rpm_repo ;;
        zypper) setup_zypper_repo ;;
        apk)    setup_apk_repo ;;
    esac
}

# ---------- Version pinning (best-effort) ----------
apt_version_spec() {
    if apt-cache madison nginx 2>/dev/null \
        | grep -Eq "^ *nginx *\| *${NGINX_VERSION}-"; then
        printf 'nginx=%s' "$(apt-cache madison nginx 2>/dev/null \
            | awk -v v="${NGINX_VERSION}" '$0 ~ "^ *nginx \\| *"v"-" {print $3; exit}')"
        return 0
    fi
    warn "No deb package exactly matching ${NGINX_VERSION} found in nginx.org repo, using latest."
    printf 'nginx'
}

rpm_version_spec() {
    local available
    if "$RPM_MGR" --version 2>/dev/null | head -n1 | grep -qi dnf; then
        available="$(dnf -q --disablerepo='*' --enablerepo='nginx-stable' list available nginx 2>/dev/null \
                    | awk '/^nginx / {print $2; exit}' || true)"
    else
        available="$(yum -q --disablerepo='*' --enablerepo='nginx-stable' list available nginx 2>/dev/null \
                    | awk '/^nginx / {print $2; exit}' || true)"
    fi
    if [ -n "$available" ] && printf '%s' "$available" | grep -Eq "^${NGINX_VERSION}"; then
        printf 'nginx-%s' "$available"
        return 0
    fi
    warn "No rpm package exactly matching ${NGINX_VERSION} found in nginx.org repo, using latest."
    printf 'nginx'
}

zypper_version_spec() {
    local avail
    avail="$(zypper --non-interactive -q se -s -r nginx-stable nginx 2>/dev/null \
            | awk '$1 ~ /^i$|^v$|^n$|^p$/ && $2=="nginx" {print $4; exit}' || true)"
    if [ -n "$avail" ] && printf '%s' "$avail" | grep -Eq "^${NGINX_VERSION}"; then
        printf 'nginx-%s' "$avail"
        return 0
    fi
    warn "No package exactly matching ${NGINX_VERSION} found in nginx.org repo, using latest."
    printf 'nginx'
}

apk_version_spec() {
    local avail ver_part
    avail="$(apk search -v 'nginx@nginx' 2>/dev/null | awk '/^nginx@nginx-/ {print $1; exit}' || true)"
    if [ -n "$avail" ]; then
        ver_part="${avail#nginx@nginx-}"
        if printf '%s' "$ver_part" | grep -Eq "^${NGINX_VERSION}"; then
            printf 'nginx@nginx=%s' "$ver_part"
            return 0
        fi
    fi
    warn "No apk package exactly matching ${NGINX_VERSION} found in nginx.org repo, using latest."
    printf 'nginx@nginx'
}

# ---------- Install the nginx package ----------
install_pkg() {
    local spec
    case "$PKG_MGR" in
        apt)    spec="$(apt_version_spec)" ;;
        rpm)    spec="$(rpm_version_spec)" ;;
        zypper) spec="$(zypper_version_spec)" ;;
        apk)    spec="$(apk_version_spec)" ;;
    esac
    log "Installing package: ${spec}"
    case "$PKG_MGR" in
        apt)
            export DEBIAN_FRONTEND=noninteractive
            apt-get install -y "$spec" || { warn "Pinned install failed, falling back to latest."; apt-get install -y nginx; }
            ;;
        rpm)
            "$RPM_MGR" install -y "$spec" || { warn "Pinned install failed, falling back to latest."; "$RPM_MGR" install -y nginx; }
            ;;
        zypper)
            zypper --non-interactive install -y "$spec" || { warn "Pinned install failed, falling back to latest."; zypper --non-interactive install -y nginx; }
            ;;
        apk)
            apk add --no-cache "$spec" || { warn "Pinned install failed, falling back to latest."; apk add --no-cache nginx@nginx; }
            ;;
    esac
}

# ---------- Config injection ----------
inject_config() {
    [ -n "$CONFIG_PATH" ] || return 0
    log "Injecting custom config into ${NGINX_CONF_D}/${CONF_NAME}.conf"
    mkdir -p "$NGINX_CONF_D"

    local dst_file="${NGINX_CONF_D}/${CONF_NAME}.conf"

    # Avoid port conflict: disable the default config (idempotent).
    if [ -f "${NGINX_CONF_D}/default.conf" ]; then
        mv "${NGINX_CONF_D}/default.conf" "${NGINX_CONF_D}/default.conf.disabled"
        log "Disabled default config default.conf -> default.conf.disabled (avoid port conflict)"
    fi

    cp -f "$CONFIG_PATH" "$dst_file"
    chmod 644 "$dst_file"
    log "Custom config written: ${dst_file}"

    if ! nginx -t 2>&1 | tee /dev/stderr; then
        warn "nginx -t failed, rolling back custom config."
        rm -f "$dst_file"
        if [ -f "${NGINX_CONF_D}/default.conf.disabled" ]; then
            mv "${NGINX_CONF_D}/default.conf.disabled" "${NGINX_CONF_D}/default.conf"
        fi
        die "Custom config syntax check failed, rolled back."
    fi
}

# ---------- Service control ----------
service_enable_start() {
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        systemctl cat nginx >/dev/null 2>&1 \
            || die "nginx systemd unit not found; check whether the nginx package is fully installed."
        systemctl enable nginx >/dev/null 2>&1 || warn "systemctl enable nginx returned non-zero (may already be enabled)."
        systemctl restart nginx
    else
        [ -x /etc/init.d/nginx ] || die "/etc/init.d/nginx not found; check whether the nginx package is fully installed."
        rc-update add nginx default >/dev/null 2>&1 || warn "rc-update add nginx default returned non-zero (may already be added)."
        rc-service nginx restart
    fi
}

service_stop() {
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        systemctl stop nginx 2>/dev/null || true
        systemctl disable nginx 2>/dev/null || true
    else
        rc-service nginx stop 2>/dev/null || true
        rc-update del nginx default 2>/dev/null || true
    fi
}

wait_ready() {
    is_ready() {
        nginx -t >/dev/null 2>&1 || return 1
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            systemctl is-active --quiet nginx
        else
            rc-service nginx status >/dev/null 2>&1 || pidof nginx >/dev/null 2>&1
        fi
    }
    local elapsed=0
    while [ "$elapsed" -lt "$READY_TIMEOUT" ]; do
        if is_ready; then
            log "nginx is ready and running."
            nginx -v 2>&1 | sed 's/^/[gateway_setup] /'
            return 0
        fi
        sleep "$READY_INTERVAL"
        elapsed=$((elapsed + READY_INTERVAL))
        log "Waiting for nginx to become ready... (${elapsed}s/${READY_TIMEOUT}s)"
    done
    warn "nginx not ready within ${READY_TIMEOUT}s, dumping diagnostics:"
    nginx -t 2>&1 | sed 's/^/[gateway_setup][diag] /' >&2 || true
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        systemctl status nginx --no-pager -l 2>&1 | tail -n 30 | sed 's/^/[gateway_setup][diag] /' >&2 || true
        journalctl -u nginx --no-pager -n 30 2>&1 | sed 's/^/[gateway_setup][diag] /' >&2 || true
    else
        rc-service nginx status 2>&1 | sed 's/^/[gateway_setup][diag] /' >&2 || true
    fi
    die "nginx did not become ready within the timeout; please investigate using the diagnostics above."
}

# ---------- Actions ----------
do_install() {
    log "Action: install (version=${NGINX_VERSION})"
    setup_repo
    install_pkg
    have nginx || die "nginx installed but nginx executable not found in PATH."
    inject_config
    if [ "$DEFER_START" -eq 1 ]; then
        nginx -t
        log "nginx installed and validated; service start deferred to caller."
        return
    fi
    service_enable_start
    wait_ready
}

do_update() {
    log "Action: update (version=${NGINX_VERSION})"
    setup_repo
    # Allow downgrade: remove any pinned version constraint first, then install the requested one.
    case "$PKG_MGR" in
        rpm)    "$RPM_MGR" versionpl 2>/dev/null || true ;;  # no-op placeholder
    esac
    # For yum/dnf, downgrade is allowed by reinstalling the requested version.
    case "$PKG_MGR" in
        rpm)
            local spec; spec="$(rpm_version_spec)"
            log "Installing / downgrading to: ${spec}"
            "$RPM_MGR" install -y "$spec" || "$RPM_MGR" reinstall -y "$spec" \
                || { warn "Pinned install failed, falling back to latest."; "$RPM_MGR" install -y nginx; }
            ;;
        zypper)
            local spec; spec="$(zypper_version_spec)"
            log "Installing / downgrading to: ${spec}"
            zypper --non-interactive install --force-resolution -y "$spec" \
                || { warn "Pinned install failed, falling back to latest."; zypper --non-interactive install -y nginx; }
            ;;
        apt)
            local spec; spec="$(apt_version_spec)"
            export DEBIAN_FRONTEND=noninteractive
            log "Installing / downgrading to: ${spec}"
            apt-get install -y --allow-downgrades "$spec" \
                || { warn "Pinned install failed, falling back to latest."; apt-get install -y nginx; }
            ;;
        apk)
            local spec; spec="$(apk_version_spec)"
            log "Installing / downgrading to: ${spec}"
            apk add --no-cache "$spec" \
                || { warn "Pinned install failed, falling back to latest."; apk add --no-cache nginx@nginx; }
            ;;
    esac
    have nginx || die "nginx installed but nginx executable not found in PATH."
    inject_config
    if [ "$DEFER_START" -eq 1 ]; then
        nginx -t
        log "nginx updated and validated; service restart deferred to caller."
        return
    fi
    service_enable_start
    wait_ready
}

do_uninstall() {
    log "Action: uninstall"
    service_stop
    log "Removing nginx package..."
    case "$PKG_MGR" in
        apt)
            export DEBIAN_FRONTEND=noninteractive
            apt-get purge -y nginx nginx-common 2>/dev/null || apt-get remove -y nginx 2>/dev/null || warn "apt remove nginx returned non-zero."
            apt-get autoremove -y 2>/dev/null || true
            ;;
        rpm)
            "$RPM_MGR" remove -y nginx 2>/dev/null || warn "rpm remove nginx returned non-zero."
            ;;
        zypper)
            zypper --non-interactive remove -y nginx 2>/dev/null || warn "zypper remove nginx returned non-zero."
            ;;
        apk)
            apk del --no-cache nginx@nginx nginx 2>/dev/null || warn "apk del nginx returned non-zero."
            ;;
    esac

    log "Cleaning up repo and key files..."
    rm -f /etc/apt/sources.list.d/nginx.list /etc/apt/preferences.d/99nginx "$NGINX_GPG_KEYRING_DEB" 2>/dev/null || true
    rm -f /etc/yum.repos.d/nginx.repo 2>/dev/null || true
    rpm -e gpg-pubkey-7bd9bf62 2>/dev/null || true
    zypper --non-interactive removerepo nginx-stable 2>/dev/null || true
    rm -f /etc/apk/keys/nginx_signing.rsa.pub 2>/dev/null || true
    # remove the @nginx repo line from /etc/apk/repositories
    if [ -f /etc/apk/repositories ]; then
        grep -v '@nginx ' /etc/apk/repositories > /etc/apk/repositories.tmp 2>/dev/null && mv /etc/apk/repositories.tmp /etc/apk/repositories || true
    fi

    # remove the gateway config file we injected
    rm -f "${NGINX_CONF_D}/${CONF_NAME}.conf" 2>/dev/null || true
    if [ -f "${NGINX_CONF_D}/default.conf.disabled" ]; then
        mv "${NGINX_CONF_D}/default.conf.disabled" "${NGINX_CONF_D}/default.conf" 2>/dev/null || true
    fi

    log "Uninstall complete."
}

case "$ACTION" in
    install)   do_install ;;
    update)    do_update ;;
    uninstall) do_uninstall ;;
esac
