---
id: contentengine-claude
title: Personalized Content Engine — Runbook
status: active
doc_type: how-to
topic: contentengine-runbook
authoritative: true
last_verified: 2026-05-07
authoritative_for:
  - contentengine actor runbook
related:
  - adr-2605072000-langgraph-agent-loop-pattern
  - adr-0018-pii-tier3-cohort-first
---

# Personalized Content Engine (`contentengine.etzhayyim.com`)

ADR-2605072000 business model ⑤ of 5.

## Actor

- DID: `did:web:contentengine.etzhayyim.com`
- Nanoid: `cten0001`
- CF Worker: `60-apps/etzhayyim-project-contentengine/appview/contentengine-cten0001/`
- Python worker: `40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/contentengine_worker_main.py`
- BPMN: `etzhayyim-root/00-contracts/bpmn/com/etzhayyim/contentengine/`

## Flow

```
generateContent XRPC
  → LangServer: contentengine.run_content_agent   (180s) — LangGraph loop
      → load_cohort_profile → match_sources → draft_content
      → rank_variants → quality_gate → store_content
  → SponsorGateway:
      includeSponsorSlot=true  → contentengine.create_sponsor_slot (30s)
      includeSponsorSlot=false → End
```

## LangGraph nodes

1. `load_cohort_profile` — fetch cohort interests/reading_level from vertex_contentengine_cohort_profile
2. `match_sources` — query vertex_news_article + vertex_narou_chapter as signals
3. `draft_content` — LLM personalized draft (title + body, respect max_words)
4. `rank_variants` — score quality (0-1) + relevance (0-1)
5. `quality_gate_node` — conditional edge: retry once if quality < 0.65
6. `store_content` — INSERT to vertex_contentengine_content (no onConflict, PK implicit)

## Tables

| Table | Purpose |
|---|---|
| `vertex_contentengine_cohort_profile` | Cohort interests + reading level |
| `vertex_contentengine_content` | Generated content pieces |

No individual PII — cohort-level only (sensitivity_ord=0, ADR-0018).

## subscribeRepos triggers

- `com.etzhayyim.apps.news.article` — news signals
- `com.etzhayyim.narou.chapter` — creative signals

## Env

```
AGENTGATEWAY_MCP_URL              gRPC address (default 127.0.0.1:26500)
RW_URL                     RisingWave postgres URL
ANTHROPIC_API_KEY
ADS_XRPC_URL               ads.etzhayyim.com base (default https://adsm4d5c.etzhayyim.com)
CONTENT_QUALITY_THRESHOLD  min score to pass (default 0.65)
```

## Start worker

```bash
cd 40-engine/kotoba/crates/kotoba-kotodama/py
python -m kotodama.contentengine_worker_main
# or: kotodama-contentengine-worker
```
