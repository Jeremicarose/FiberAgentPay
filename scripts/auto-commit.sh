#!/bin/bash

# Auto-commit and push script for FiberAgentPay
# Generates structured commit messages based on what actually changed.
#
# Message format: <type>(<scope>): <description>
#   type  = feat | fix | refactor | style | docs | chore | test
#   scope = core | fiber-client | ckb-client | agents | server | dashboard |
#           scripts | config | project
#
# Examples:
#   feat(fiber-client): add channel management RPC methods
#   feat(agents): add DCA agent with scheduled micropayments
#   feat(dashboard): add real-time payment feed component
#   chore(config): update dependencies and build scripts

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$REPO_ROOT/logs/auto-commit.log"
INTERVAL=60  # seconds

mkdir -p "$REPO_ROOT/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# Determine the conventional-commit type (feat, fix, refactor, …)
# ---------------------------------------------------------------------------
detect_type() {
    local added="$1" modified="$2" deleted="$3"

    # If only deletions → chore
    if [[ -z "$added" && -z "$modified" && -n "$deleted" ]]; then
        echo "chore"; return
    fi

    # New files → feat
    if [[ -n "$added" ]]; then
        echo "feat"; return
    fi

    # Config / dependency changes → chore
    if echo "$modified" | grep -qE "(package\.json|tsconfig|\.env|\.gitignore|pnpm-workspace|pnpm-lock)"; then
        echo "chore"; return
    fi

    # Test files → test
    if echo "$modified" | grep -qE "(test|spec|_test)\.(ts|tsx)$"; then
        echo "test"; return
    fi

    # Docs → docs
    if echo "$modified" | grep -qE "\.(md|txt)$" && ! echo "$modified" | grep -qvE "\.(md|txt)$"; then
        echo "docs"; return
    fi

    echo "feat"
}

# ---------------------------------------------------------------------------
# Determine the scope from file paths (FiberAgentPay monorepo)
# ---------------------------------------------------------------------------
detect_scope() {
    local all_files="$1"

    local has_core=false has_fiber=false has_ckb=false has_agents=false
    local has_server=false has_dashboard=false has_scripts=false has_config=false
    local has_tests=false

    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        case "$f" in
            packages/core/*)           has_core=true ;;
            packages/fiber-client/*)   has_fiber=true ;;
            packages/ckb-client/*)     has_ckb=true ;;
            packages/agents/*)         has_agents=true ;;
            packages/server/*)         has_server=true ;;
            packages/dashboard/*)      has_dashboard=true ;;
            scripts/*)                 has_scripts=true ;;
            tests/*)                   has_tests=true ;;
            *.json|*.config.*|.env*|.gitignore|pnpm-workspace.yaml|CLAUDE.md)
                                       has_config=true ;;
        esac
    done <<< "$all_files"

    local scopes=()
    $has_core      && scopes+=("core")
    $has_fiber     && scopes+=("fiber-client")
    $has_ckb       && scopes+=("ckb-client")
    $has_agents    && scopes+=("agents")
    $has_server    && scopes+=("server")
    $has_dashboard && scopes+=("dashboard")
    $has_tests     && scopes+=("tests")
    $has_scripts   && scopes+=("scripts")
    $has_config    && scopes+=("config")

    if [[ ${#scopes[@]} -eq 0 ]]; then
        echo "project"
    elif [[ ${#scopes[@]} -eq 1 ]]; then
        echo "${scopes[0]}"
    else
        local IFS=","
        echo "${scopes[*]}"
    fi
}

# ---------------------------------------------------------------------------
# Build a human-readable description of the changes
# ---------------------------------------------------------------------------
describe_changes() {
    local added="$1" modified="$2" deleted="$3"
    local all_files="$4"
    local desc=""

    # --- Core package (types, config, utils) ---
    if echo "$all_files" | grep -q "packages/core/"; then
        if echo "$added" | grep -q "packages/core/"; then
            desc="${desc:+$desc, }add shared types and config"
        else
            desc="${desc:+$desc, }update core types/config"
        fi
    fi

    # --- Fiber client (RPC, channels, payments) ---
    if echo "$all_files" | grep -q "packages/fiber-client/"; then
        if echo "$all_files" | grep -q "channels"; then
            desc="${desc:+$desc, }add channel management RPC methods"
        elif echo "$all_files" | grep -q "payments\|invoice"; then
            desc="${desc:+$desc, }add payment operations"
        elif echo "$added" | grep -q "packages/fiber-client/"; then
            desc="${desc:+$desc, }add Fiber Network RPC client"
        else
            desc="${desc:+$desc, }update Fiber client"
        fi
    fi

    # --- CKB client (wallet, transactions) ---
    if echo "$all_files" | grep -q "packages/ckb-client/"; then
        if echo "$all_files" | grep -q "wallet"; then
            desc="${desc:+$desc, }add HD wallet management"
        elif echo "$all_files" | grep -q "transactions"; then
            desc="${desc:+$desc, }add CKB transaction building"
        elif echo "$added" | grep -q "packages/ckb-client/"; then
            desc="${desc:+$desc, }add CKB client with CCC SDK"
        else
            desc="${desc:+$desc, }update CKB client"
        fi
    fi

    # --- Agents (DCA, streaming, commerce) ---
    if echo "$all_files" | grep -q "packages/agents/"; then
        if echo "$all_files" | grep -q "dca-agent"; then
            desc="${desc:+$desc, }add DCA agent with scheduled micropayments"
        elif echo "$all_files" | grep -q "stream-agent"; then
            desc="${desc:+$desc, }add streaming payments agent"
        elif echo "$all_files" | grep -q "commerce-agent"; then
            desc="${desc:+$desc, }add agent-to-agent commerce"
        elif echo "$all_files" | grep -q "base-agent"; then
            desc="${desc:+$desc, }add base agent framework"
        elif echo "$all_files" | grep -q "safety"; then
            desc="${desc:+$desc, }add agent safety module"
        elif echo "$added" | grep -q "packages/agents/"; then
            desc="${desc:+$desc, }add agent framework"
        else
            desc="${desc:+$desc, }update agent logic"
        fi
    fi

    # --- Server (API routes, WebSocket) ---
    if echo "$all_files" | grep -q "packages/server/"; then
        if echo "$all_files" | grep -q "websocket"; then
            desc="${desc:+$desc, }add WebSocket real-time updates"
        elif echo "$all_files" | grep -q "routes/"; then
            local routes=$(echo "$all_files" | grep "routes/" | xargs -I{} basename {} .ts 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
            desc="${desc:+$desc, }add ${routes} API routes"
        elif echo "$added" | grep -q "packages/server/"; then
            desc="${desc:+$desc, }add Hono API server"
        else
            desc="${desc:+$desc, }update server"
        fi
    fi

    # --- Dashboard (React components, hooks) ---
    if echo "$all_files" | grep -q "packages/dashboard/"; then
        if echo "$all_files" | grep -q "components/"; then
            local components=$(echo "$all_files" | grep "components/" | xargs -I{} basename {} .tsx 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
            if echo "$added" | grep -q "components/"; then
                desc="${desc:+$desc, }add ${components} component(s)"
            else
                desc="${desc:+$desc, }update ${components} component(s)"
            fi
        elif echo "$all_files" | grep -q "hooks/"; then
            desc="${desc:+$desc, }add React hooks"
        elif echo "$added" | grep -q "packages/dashboard/"; then
            desc="${desc:+$desc, }add React dashboard"
        else
            desc="${desc:+$desc, }update dashboard"
        fi
    fi

    # --- Dependencies ---
    if echo "$all_files" | grep -q "package\.json"; then
        # Only mention if nothing more specific was already said
        if [[ -z "$desc" ]]; then
            desc="update dependencies"
        fi
    fi

    # --- pnpm workspace / lockfile ---
    if echo "$all_files" | grep -q "pnpm-workspace\|pnpm-lock"; then
        if [[ -z "$desc" ]]; then
            desc="update workspace configuration"
        fi
    fi

    # --- Scripts ---
    if echo "$all_files" | grep -q "^scripts/"; then
        desc="${desc:+$desc, }update build/deploy scripts"
    fi

    # --- Tests ---
    if echo "$all_files" | grep -q "^tests/"; then
        if echo "$added" | grep -q "^tests/"; then
            desc="${desc:+$desc, }add tests"
        else
            desc="${desc:+$desc, }update tests"
        fi
    fi

    # --- Deletions ---
    if [[ -n "$deleted" ]]; then
        local del_count=$(echo "$deleted" | wc -l | xargs)
        desc="${desc:+$desc, }remove $del_count file(s)"
    fi

    # Fallback
    if [[ -z "$desc" ]]; then
        local file_count=$(echo "$all_files" | wc -l | xargs)
        local first_file=$(echo "$all_files" | head -1 | xargs basename 2>/dev/null || echo "files")
        if [[ $file_count -eq 1 ]]; then
            desc="update $first_file"
        else
            desc="update $file_count files"
        fi
    fi

    echo "$desc"
}

# ---------------------------------------------------------------------------
# Main: generate full commit message
# ---------------------------------------------------------------------------
generate_commit_message() {
    local added=$(git diff --cached --name-only --diff-filter=A)
    local modified=$(git diff --cached --name-only --diff-filter=M)
    local deleted=$(git diff --cached --name-only --diff-filter=D)
    local all_files=$(git diff --cached --name-only)

    local type=$(detect_type "$added" "$modified" "$deleted")
    local scope=$(detect_scope "$all_files")
    local desc=$(describe_changes "$added" "$modified" "$deleted" "$all_files")

    echo "${type}(${scope}): ${desc}"
}

# ---------------------------------------------------------------------------
# Commit + push
# ---------------------------------------------------------------------------
do_commit() {
    cd "$REPO_ROOT" || { log "Failed to navigate to repo root"; return 1; }

    if [[ -z $(git status -s) ]]; then
        return 0
    fi

    log "Changes detected:"
    git status -s >> "$LOG_FILE"

    git add .

    local commit_msg=$(generate_commit_message)
    log "Commit: $commit_msg"
    git commit -m "$commit_msg"

    log "Pushing to origin/main..."
    if git push origin main 2>&1 | tee -a "$LOG_FILE"; then
        log "Pushed successfully."
    else
        log "Push failed."
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
case "${1:-}" in
    --once)
        log "Running single commit check..."
        do_commit
        ;;
    --watch|"")
        log "Auto-commit started (interval: ${INTERVAL}s)"
        log "Repo: $REPO_ROOT"
        log "Press Ctrl+C to stop"
        while true; do
            do_commit
            sleep $INTERVAL
        done
        ;;
    --help)
        echo "Usage: $0 [--once|--watch|--help]"
        echo "  --once   Run once and exit"
        echo "  --watch  Run continuously every ${INTERVAL}s (default)"
        echo "  --help   Show this help"
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage"
        exit 1
        ;;
esac
