# cloud-itonami/contentengine

**`contentengine.etzhayyim.com`（パーソナライズド・コンテンツエンジン）の、edge 側だけを
切り出した凍結コピー。** 実体は SvelteKit の thin edge BFF 1 本 —— 判断は何もせず、
`POST /xrpc/<nsid>` を MCP router へ JSON-RPC `tools/call` として中継するだけ。

名前が `contentengine` としか言っていないので、まずここで名乗る —— この repo は
**「コホート単位で記事を生成する LangGraph ループ」そのものではなく、その前に立つ
15 ファイルの受付**である。実際に下書きを書いて品質スコアを付けていた Python ワーカーは、
ここには**無い**（下記のとおり、どの repo にも見つからない）。

**そして今日、中継先の MCP router も、自分のホストも DNS に無い**（下記「ホストの現在地」）。
つまりこの repo は「動いているサービス」ではなく、**何が宣言されていたかの記録**である。

## 何が入っていて、何が入っていないか

`CLAUDE.md`（抽出前の monorepo 時代の runbook）は 4 つの場所を名指しする。実測
2026-08-12、上流 `etzhayyim/root`（ローカル checkout `9b57e9e40b`）を直接読んで確かめた:

| runbook が指す場所 | 今日どこに在るか |
|---|---|
| `60-apps/etzhayyim-project-contentengine/appview/contentengine-cten0001/` | **✅ ここ**（`appview/contentengine-cten0001/`。パスの前半が落ちた形）。**同時に上流にも原本が残っている**（下記） |
| `00-contracts/bpmn/com/etzhayyim/contentengine/` | ⚠ **`etzhayyim/root` に在る**（この repo には無い）。`generateContent.bpmn` 2,865B の 1 本だけ |
| `40-engine/kotoba/crates/kotoba-kotodama/py/…/contentengine_worker_main.py` | ❌ **見つからない**。上流の `40-engine/kotoba/` は**ディレクトリごと消えている**。`kotoba-lang/kotodama-py`（py 資産の移転先）にも `contentengine` の文字列は **0 件**。上流に残る `contentengine_worker_main` の言及 4 件は、すべて**この名前を参照している側**（BPMN のコメント・`src/app.ts`・`CLAUDE.md`・`90-docs/session-history.edn`）で、モジュール本体はどこにも無い |
| `90-docs/adr/2605072000-langgraph-agent-loop-pattern` | ⚠ **`etzhayyim/root` に `.edn` として在る**（`.md` ではない）。この repo には無い |

**したがって「LangGraph 6 ノードのループ」は、この repo からは動かせない。**
`CLAUDE.md` 末尾の `python -m kotodama.contentengine_worker_main` は**踏めない手順**として
読むこと（`cd` する先のディレクトリ自体が上流から消えている）。

`CLAUDE.md` が挙げる RisingWave の 2 テーブル（`vertex_contentengine_cohort_profile` /
`vertex_contentengine_content`）も同様で、**DDL はどこにも無い** —— 上流で
`vertex_contentengine` に当たるのは runbook 自身と `90-docs/session-history.edn` の 2 件だけ。

### 抽出元がまだ生きている（この repo は唯一のコピーではない）

`migration.edn` は `etzhayyim/root@c3a74d2` から 13 ファイルを取り出したと記録しているが、
**その 13 ファイルは今も上流の元の場所に在り、1 バイトも違わない**（実測 2026-08-12、
`cmp` で 13/13 とも same）。抽出は move ではなく copy だった。

さらに `migration.edn` の `:destination` は
**`etzhayyim/com-etzhayyim-app-contentengine`** と書いてあるが、**その名前の repo は
west.yml に無い** —— 実際の行き先はここ、`cloud-itonami/contentengine` である。
migration 記録の宛先を、現在地の根拠に使わないこと。

したがって編集するときは「どちらを直すか」を先に決める必要がある。**上流の
`60-apps/etzhayyim-project-contentengine/` を直しても、ここには伝播しない**（その逆も）。

### 契約は残り、実装だけが消えている

上流には**この actor の wire contract が完全な形で残っている**:

- `00-contracts/bpmn/com/etzhayyim/contentengine/generateContent.bpmn` ——
  `RunContentAgent`（`contentengine.run_content_agent`、timeout 180s、retries 2）
  → `SponsorGateway` → `CreateSponsorSlot`（`contentengine.create_sponsor_slot`、30s）
  → `End`。分岐条件は `includeSponsorSlot = true` / `= false`。
  **`CLAUDE.md` の Flow 図はこの BPMN と一致する**（runbook のこの部分は今日も正しい）
- `00-contracts/lexicons/com/etzhayyim/etzhayyim/apps/contentengine/` に **4 本**
  （`generateContent` / `getContent` / `listContent` / `registerCohortProfile`）

`generateContent` の入力は `cohortName` / `contentType` / `topic` が **required**、
`contentType` は `blog_post|social_thread|email_body|report_summary`、`maxWords` は
50–2000（既定 500）。**この検証は誰も実行していない**（下記）。

## この BFF は何も検証しない

実測 2026-08-12（`wrangler dev --local`、詳細は quickstart step 4）:

| 送ったもの | 返ってきたもの | 意味 |
|---|---|---|
| lexicon 準拠の body | **500** | 上流へ行こうとして落ちる |
| required を全部欠いた `{"bogus":1}` | **500**（400 ではない） | **schema 検証をしていない** |
| `com.example.not.a.capability` | **500**（404 ではない） | **capability を見ていない**。`/xrpc/*` なら何でも中継しようとする |
| `GET /xrpc/<nsid>` | 405 | `+server.ts` は `POST` と `OPTIONS` しか持たない |

`wrangler.jsonc` の `APP_CAPABILITIES`・`kotodama.jsonld`・`actor-manifest.jsonld` が
挙げる 4 つの capability は、**宣言であって強制ではない**。絞り込みは（今は居ない）
MCP router 側の仕事だった。

## `src/app.ts` はデプロイされない

`wrangler.jsonc` の `main` は **`svelte/.svelte-kit/cloudflare/_worker.js`** ——
つまり SvelteKit のビルド出力であって、`src/app.ts` ではない。

実測（2026-08-12、`npm run build` 後にビルド成果物を検索）:

- 成果物の中に **`dispatcher.etzhayyim.com` は 1 件も現れない**（`src/app.ts` だけが持つ上流）
- 一方 `mcp.etzhayyim.com` は
  `output/server/entries/endpoints/xrpc/_...path_/_server.ts.js` に入っている
- ローカルで `GET /health` を叩くと **404**（`src/app.ts` にしか無い経路）

**したがってこの repo には XRPC の中継が 2 つ在り、動くのは片方だけ:**

| | `src/app.ts`（死） | `routes/xrpc/[...path]/+server.ts`（生） |
|---|---|---|
| 上流 | `dispatcher.etzhayyim.com` | `mcp.etzhayyim.com`（`AGENTGATEWAY_MCP_ROUTER_URL`） |
| プロトコル | XRPC をそのまま POST | JSON-RPC `tools/call` に包む |
| 認証 | `x-internal-trust` ヘッダ | 受信ヘッダをそのまま透過 |
| `/health` | 有り | **無し** |
| nsid の絞り込み | `com.etzhayyim.apps.contentengine.` 接頭辞を検査 | **しない**（上表） |

**型検査もされていない。** `npm run check` は 142 ファイルを 0 error で通すが、
そこに `src/app.ts` は**入っていない** —— `.svelte-kit/tsconfig.json` の `include` は
`../src/**`（= `svelte/src/`）までで、1 つ上の階層に在るこのファイルに届かない。
**この repo に `src/app.ts` を検査するものは無い。**

消していないのは、**どちらが意図された設計だったかをこの repo が答えられない**ため。
消す/残すを決めるのは、上流の dispatcher と MCP router のどちらが正になるかを知っている側。

## ランディングページは自分の設定と食い違う

`+page.svelte` は scaffold 生成物で、`routeCount: 0` / `routes: []` / `vars: []` が
**ソースにハードコードされている**。実際に `GET /` を叩くと
`No public route is declared next to this app surface.` と表示されるが、
**隣の `wrangler.jsonc` は route を 2 本・vars を 9 個宣言している**
（`wrangler dev` の起動時に 9 件とも表に出る。quickstart step 4-b）。
画面を信用せず、`wrangler.jsonc` を読むこと。

`relativePath` も抽出前の monorepo パス
（`60-apps/etzhayyim-project-contentengine/…`）のままで、この repo には存在しない。

## ホストの現在地（2026-08-12 実測）

```
contentengine.etzhayyim.com   → DNS 応答なし
cten0001.etzhayyim.com        → DNS 応答なし
mcp.etzhayyim.com             → DNS 応答なし   ← 生きている側 BFF の唯一の上流
dispatcher.etzhayyim.com      → DNS 応答なし   ← 死んでいる側の上流
ads.etzhayyim.com             → DNS 応答なし   ← BPMN の sponsor 分岐先
adsm4d5c.etzhayyim.com        → DNS 応答なし   ← runbook の ADS_XRPC_URL 既定値
news.etzhayyim.com            → DNS 応答なし   ← subscribeRepos の signal 源
narou.etzhayyim.com           → DNS 応答なし   ← 同上
etzhayyim.com                 → 172.67.179.128 / 104.21.51.111（Cloudflare）
```

zone（`etzhayyim.com`、NS は `everton` / `vivienne.ns.cloudflare.com`）は生きているが、
**この actor が名指しする 8 ホストは 1 つも存在しない。**
`wrangler.jsonc` が宣言する 2 本の route も、どちらもホスト名が無い。
**この Worker は今日デプロイされていない。**

**これは「手元から外に出られない」ではない。** 対照実験として `https://etzhayyim.com/` と
`https://example.com/` はどちらも **200** を返し、`https://mcp.etzhayyim.com/` だけが
`Could not resolve host` になる。上流が消えているのであって、環境の問題ではない。

結果として、ローカルで起動しても `POST /xrpc/…` は **500 `{"message":"Internal Error"}`**
になる（`+server.ts` は `fetch` を try で囲っていないので、上流の名前解決失敗が例外として
素通りし、ハンドラ内の 502 分岐 `MCP router request failed` に到達しない）。
**これは設定ミスではなく、上流が無いことの正しい観測。**

⚠ **失敗の見え方は runtime で違う。** 同じ 500 でも、ログに出るものが違う:

| runtime | ログ |
|---|---|
| `wrangler dev`（workerd = production と同じ） | `Error: internal error; reference = <id>` —— **原因が読めない** |
| `vite preview`（Node/undici） | `TypeError: fetch failed` —— DNS 失敗と読める |

production 側のランタイムでは原因が潰れるので、**切り分けは Node 側で行うこと。**

## 最近接 repo との境界

| repo | 役割 | こことの違い |
|---|---|---|
| [`etzhayyim/root`](https://github.com/etzhayyim/root) | 抽出元の monorepo。BPMN・lexicon・ADR、**そして同じ 13 ファイルの原本**が今もここ | あちらが**契約の正本**。ここは edge の受付だけ |
| [`kotoba-lang/kotodama-py`](https://github.com/kotoba-lang/kotodama-py) | 旧 monorepo の Python worker / SQLMesh 資産の移転先 | **contentengine は移されていない**（実測: 該当文字列 0 件）。「py はここ」と当て推量しない |
| [`kotoba-lang/kotodama`](https://github.com/kotoba-lang/kotodama) | functional-organism runtime 本体 | ランタイム。ここは 1 アプリの facade |
| `cloud-itonami` の他の appview（`compintel` / `danjo` / `eigyo` …） | 同じ抽出バッチの兄弟。同じ SvelteKit scaffold | **scaffold が同型**。`+page.svelte` は生成物で、中身は nanoid が違うだけ。**振る舞いまで同じとは限らない**（差分は各 repo の quickstart で実測すること） |
| **ここ** | **edge BFF の凍結コピー** | 上のどれでもない。新しい生成ロジックをここに足さない |

## 中身（15 ファイル）

```
README.edn                 115B  機械可読 metadata（:kind :app）。人間向けの説明は入っていない
CLAUDE.md                        抽出前の runbook。上表のとおり 4 つの参照先のうち 2 つが死に、
                                 1 つは上流に在る。Flow 図と BPMN は今も一致する
NOTICE                           Apache-2.0 + etzhayyim Charter Rider v3.1
actor-manifest.jsonld            DID did:web:contentengine.etzhayyim.com / nanoid cten0001 / capability 4 本
migration.edn                    抽出元 etzhayyim/root@c3a74d2 の記録（13 files / 17,995B）。
                                 :destination は実際の行き先と食い違う（上記）
appview/contentengine-cten0001/
  wrangler.jsonc                 Worker 設定。main は svelte 側のビルド出力を指す
  kotodama.jsonld                アプリ宣言。subscribeRepos（news / narou）/ integrations（ads）/ piiPolicy tier 0
  src/app.ts                     **デプロイも型検査もされない**（上記）
  svelte/                        **これがデプロイされる本体**
    src/routes/+page.svelte      ランディング。生成物で、中身は自分の設定と食い違う（上記）
    src/routes/xrpc/[...path]/+server.ts   唯一の実処理。MCP router への中継
```

## 触る前に

- **動かして確かめる手順は [`docs/operator-quickstart.md`](docs/operator-quickstart.md)。**
  Cloudflare アカウントも secret も要らず、「何が生きて何が死んでいるか」を自分の目で
  見られる（全手順 2026-08-12 に実測済み。踏めなかったものは踏めないと書いてある）。
- **新しい生成ロジックをここに足さない。** ここは受付であって、判断は BPMN 契約と
  （今は行方不明の）LangGraph ワーカーの側に在った。
- **PII を持ち込まない。** `kotodama.jsonld` の `piiPolicy` は tier 0 /
  `sensitivity_ord` 0、`cohortName` 単位のみ（ADR-0018）。lexicon の入力にも
  個人識別子は 1 つも無い。この線を越える変更は、この repo の宣言と矛盾する。
- `README.edn` は消さない（`etzhayyim.repository/v1` の機械可読 metadata で、
  `migration.edn` の `:allowed-additions` に載っている 2 ファイルのうちの 1 つ）。

### この README 自体が `:allowed-additions` の外に在る

`migration.edn` は `:identity {:allowed-additions ["README.edn" "migration.edn"]}` と
宣言している —— 抽出時の意図は「抽出元の tree に、この 2 つ以外を足さない」だった。
**この `README.md` / `docs/` / `.gitignore` はその 3 つ目以降にあたる。**

黙って増やさないために書いておく: 2026-08-12 時点で **`:allowed-additions` を検査する
gate はこの workspace に無い**。凍結を優先して名乗りを持たないままにするより、
**何が生きていて何が死んでいるかを読めるようにする方を採った**。抽出時の tree が
知りたければ `migration.edn` の `:source` に revision と tree hash が固定されている
（さらに今日は、上流の原本そのものが同じ場所に残っている）。
