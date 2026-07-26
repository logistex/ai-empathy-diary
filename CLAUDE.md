# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Status: starter stub — work in progress.**
> This project has not been built yet. As of this writing the directory contains only a `.env` file. The notes below record what is known; fill in the rest (build/lint/test commands, architecture, run instructions) as code is added, then re-run `/init` to expand this file.

## Context

Chapter 7 ("에이전트" / Agent) study project from the book *혼자 공부하는 바이브 코딩 with 클로드 코드* (taehojo). The goal of this chapter is to build an AI agent application.

## Known configuration

Environment variables live in `.env` (git-ignored; not committed):

- `OPENROUTER_API_KEY` — the app calls an LLM through [OpenRouter](https://openrouter.ai), not a provider API directly.
- `DATABASE_URL` — a PostgreSQL database hosted on AWS (`postgresql://...`).

## To be filled in

Once the app exists, document here:

- **Commands** — how to install deps, run the dev server, build, lint, and run tests (including a single test).
- **Stack** — framework/runtime, ORM or DB client, and how OpenRouter is wired in.
- **Architecture** — the agent loop, tools/functions it can call, and how the database is used (schema, migrations).
