.PHONY: help all clean build lint fmt check-fmt typecheck test markdownlint spelling

.DEFAULT_GOAL := all

all: build check-fmt lint typecheck test spelling

TYPOS_VERSION ?= 1.48.0
TYPOS := uv tool run typos@$(TYPOS_VERSION)

node_modules: package.json
	bun install
	@touch node_modules

build: node_modules ## Install dependencies

clean: ## Remove build artifacts
	rm -rf dist node_modules .bun
	rm -f .typos-oxendict-base.json .typos-oxendict-base.toml

fmt: build ## Format sources
	bun run fmt

check-fmt: build ## Verify formatting
	bun run check:fmt

lint: build ## Run linters
	bun run lint

typecheck: build ## Run type checking
	bun run check:types

test: build ## Run tests
	bun run test

markdownlint: build ## Lint Markdown files
	bun run lint:markdown

spelling: ## Enforce en-GB-oxendict spelling in Markdown prose
	@uv run scripts/generate_typos_config.py
	@find . -type f -name '*.md' -not -path './node_modules/*' -print0 | \
		xargs -0 -r $(TYPOS) --config typos.toml --force-exclude

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	sed 's/:.*##/##/' | \
	awk 'BEGIN {FS="##"; printf "Available targets:\n"} {gsub(/^[ \t]+/, "", $$2); printf "  %-20s %s\n", $$1, $$2}'
