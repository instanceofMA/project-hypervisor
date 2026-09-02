#!/usr/bin/env zsh

phv() {
    local SUBCOMMAND="$1"
    local USERNAME=$(whoami)
    local SOCKETS_DIR="/Users/${USERNAME}/.sockets"

    case "$SUBCOMMAND" in
        dev)
            local DIR_NAME=$(basename "$PWD" | tr '[:upper:]' '[:lower:]')
            local APP_NAME=${2:-$DIR_NAME}
            local SOCKET_PATH="${SOCKETS_DIR}/${APP_NAME}.sock"

            echo "🚀 Hypervisor: Routing workspace matrix context for [${APP_NAME}]..."
            mkdir -p "$SOCKETS_DIR"
            chmod 755 "$SOCKETS_DIR" 2>/dev/null
            rm -f "$SOCKET_PATH"

            export PORT="$SOCKET_PATH"
            export PATH="./node_modules/.bin:$PATH"

            node "/Users/${USERNAME}/.scripts/hypervisor.js"
            ;;

        status|list)
            echo "📊 Project Hypervisor - Active Sockets in ~/.sockets/:"
            if [ -d "$SOCKETS_DIR" ]; then
                local FOUND=$(ls -la "$SOCKETS_DIR" 2>/dev/null | grep '\.sock$' || true)
                if [ -n "$FOUND" ]; then
                    echo "$FOUND"
                else
                    echo "  (No active sockets running)"
                fi
            else
                echo "No sockets directory found at $SOCKETS_DIR"
            fi
            ;;

        clean)
            echo "🧹 Cleaning stale socket files in ${SOCKETS_DIR}..."
            rm -f "${SOCKETS_DIR}"/*.sock
            echo "✅ Sockets directory clean."
            ;;

        restart)
            echo "🔄 Restarting Project Hypervisor LaunchAgent..."
            node -e "try { require('./scripts/daemon.js'); } catch { require('child_process').execSync('launchctl bootout gui/' + process.getuid() + ' ~/Library/LaunchAgents/com.project-hypervisor.plist 2>/dev/null; launchctl bootstrap gui/' + process.getuid() + ' ~/Library/LaunchAgents/com.project-hypervisor.plist', { stdio: 'inherit' }); }"
            echo "✅ Hypervisor restarted. Visit https://home.test"
            ;;

        help|--help|-h|"")
            echo "╔════════════════════════════════════════════════════════════╗"
            echo "║               PROJECT HYPERVISOR (phv) CLI                 ║"
            echo "╚════════════════════════════════════════════════════════════╝"
            echo ""
            echo "Usage: phv <command> [options]"
            echo ""
            echo "Commands:"
            echo "  phv dev [name]     Launch dev server routed through ~/.sockets/[name].sock"
            echo "  phv status         List active Unix Domain Sockets in ~/.sockets/"
            echo "  phv clean          Remove all stale socket files in ~/.sockets/"
            echo "  phv restart        Restart the main Hypervisor dashboard LaunchAgent"
            echo "  phv help           Show this help message"
            echo ""
            ;;

        *)
            echo "❌ Unknown command: phv $SUBCOMMAND"
            echo "Run 'phv help' for available commands."
            return 1
            ;;
    esac
}

# Alias for backward compatibility
alias dev-domain="phv dev"
