#!/bin/bash
# trackmebaby - One-line installer for Linux and macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/Feynmunh/trackmebaby/master/scripts/install.sh | bash
#
set -euo pipefail

REPO="Feynmunh/trackmebaby"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}==>${NC} $*"; }
success() { echo -e "${GREEN}SUCCESS:${NC} $*"; }
warn()    { echo -e "${YELLOW}WARNING:${NC} $*"; }
error()   { echo -e "${RED}Error:${NC} $*" >&2; }

if ! command -v curl >/dev/null 2>&1; then
    error "curl is required but is not installed."
    error "Please install curl first: https://curl.se/docs/install.html"
    exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
    error "tar is required but is not installed."
    exit 1
fi

detect_installation() {
    local IFS=$'\n'
    case "$(uname -s)" in
        Linux)
            local data_home="${XDG_DATA_HOME:-"$HOME/.local/share"}"
            if [ -d "$data_home/trackmebaby/stable/app" ]; then
                echo "$data_home/trackmebaby/stable/app"
                return 0
            fi
            ;;
        Darwin)
            if [ -d "/Applications/trackmebaby.app" ]; then
                echo "/Applications/trackmebaby.app"
                return 0
            fi
            ;;
    esac
    return 1
}

EXISTING_INSTALL=$(detect_installation || true)
if [ -n "$EXISTING_INSTALL" ]; then
    warn "Found existing installation at: $EXISTING_INSTALL"
    echo "Re-running the installer will update to the latest version."
    if [ "${NONINTERACTIVE:-}" = "1" ]; then
        info "Running in NONINTERACTIVE mode — proceeding with update."
    else
        if [ -t 0 ]; then
            echo -n "Continue? [Y/n] "
            read -r reply
            if [ -n "$reply" ] && [ "$reply" != "Y" ] && [ "$reply" != "y" ]; then
                info "Installation cancelled."
                exit 0
            fi
        fi
    fi
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

determine_filename() {
    local os=$1
    local arch=$2
    case "$os" in
        Linux)
            case "$arch" in
                x86_64|amd64)
                    echo "trackmebaby-linux-x64-installer.tar.gz"
                    ;;
                aarch64|arm64)
                    echo "trackmebaby-linux-arm64-installer.tar.gz"
                    ;;
                *)
                    error "Unsupported Linux architecture: $arch"
                    error "Supported architectures: x86_64, aarch64"
                    exit 1
                    ;;
            esac
            ;;
        Darwin)
            case "$arch" in
                arm64)
                    echo "trackmebaby-macos-arm64.tar.gz"
                    ;;
                x86_64)
                    echo "trackmebaby-macos-x64.tar.gz"
                    ;;
                *)
                    error "Unsupported macOS architecture: $arch"
                    error "Supported architectures: arm64, x86_64"
                    exit 1
                    ;;
            esac
            ;;
        *)
            return 1
            ;;
    esac
    return 0
}

FILENAME=$(determine_filename "$OS" "$ARCH") || {
    error "Unsupported OS: $OS"
    echo "Please visit https://github.com/$REPO/releases for manual installation."
    exit 1
}

URL="https://github.com/$REPO/releases/latest/download/$FILENAME"

info "Detected OS: ${GREEN}${OS}${NC} (${ARCH})"
info "Target asset: ${GREEN}${FILENAME}${NC}"
info "Fetching latest version..."

TEMP_DIR=""
cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

info "Downloading installer..."
if ! curl --proto '=https' --tlsv1.2 -fLsS -o "$FILENAME" "$URL"; then
    error "Download failed. Check your network connection and verify the release asset exists."
    error "URL: $URL"
    exit 1
fi

if [ ! -s "$FILENAME" ]; then
    error "Downloaded file is empty."
    exit 1
fi

# Verify it's a gzip archive (magic bytes: 1f 8b)
if command -v xxd >/dev/null 2>&1; then
    MAGIC=$(xxd -p -l 2 "$FILENAME")
    if [ "$MAGIC" != "1f8b" ]; then
        error "Downloaded file is not a valid gzip archive. You may have received an error page."
        exit 1
    fi
fi

info "Extracting..."
tar -xzf "$FILENAME"

case "$OS" in
    Linux)
        if [ -x ./installer ]; then
            info "Running installer..."
            chmod +x installer
            ./installer
            success "trackmebaby has been installed!"
            echo "You can now launch it from your application menu."
        else
            error "No 'installer' binary found in the downloaded archive."
            exit 1
        fi
        ;;

    Darwin)
        mapfile -t APP_NAMES < <(find . -maxdepth 1 -name "*.app" -type d 2>/dev/null)
        APP_COUNT=${#APP_NAMES[@]}

        if [ "$APP_COUNT" -eq 0 ]; then
            error "Could not find a .app bundle in the downloaded archive."
            exit 1
        elif [ "$APP_COUNT" -gt 1 ]; then
            error "Multiple .app bundles found in archive. Ambiguous."
            error "Found: ${APP_NAMES[*]}"
            exit 1
        fi

        APP_NAME="${APP_NAMES[0]}"
        info "Installing ${APP_NAME} to /Applications..."

        if mv "$APP_NAME" /Applications/ 2>/dev/null; then
            success "trackmebaby installed to /Applications"
        elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
            info "Requesting permission..."
            sudo mv "$APP_NAME" /Applications/ && success "trackmebaby installed to /Applications"
        else
            error "Failed to install $APP_NAME to /Applications."
            error "Move it manually: sudo mv \"$APP_NAME\" /Applications/"
            exit 1
        fi
        ;;
esac
