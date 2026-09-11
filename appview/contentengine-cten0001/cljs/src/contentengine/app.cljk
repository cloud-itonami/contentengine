(ns contentengine.app
  "contentengine-cten0001 appview — ported from
  appview/contentengine-cten0001/svelte/src/routes/+page.svelte (SvelteKit
  scaffold) to reagent + re-frame on the jp-go-dds (DADS) design system.

  This is a single view (ADR-2608080100: one document, one bundle, one
  mount) — the whole scaffold was one Svelte page, so there is nothing to
  select between; `app-view` renders directly off the `:app` re-frame sub.

  The rendered facts (title/project/name/kind/routeCount/routes/vars/xrpc/
  relativePath) are the SAME data the original `+page.svelte` hardcoded as
  its inline `const app = {...}` — including `:relative-path`, which
  README.md already documents as a stale pre-extraction monorepo path this
  repo does not contain. That staleness is ported verbatim, not invented or
  corrected here: this file replaces the Svelte *view*, not the scaffold's
  (already-known-stale) generated data.

  Note on what this view does NOT do: the Svelte scaffold's only real logic
  lived in a sibling file, `src/routes/xrpc/[...path]/+server.ts` — a
  SvelteKit server route (backend HTTP handler), not part of this view. It
  has been preserved with a provenance header at
  appview/contentengine-cten0001/backend-frozen/routes/xrpc/[...path]/+server.ts
  and is intentionally left non-functional (see that file's header)."
  (:require [reagent.core :as r]
            [reagent.dom :as rdom]
            [re-frame.core :as rf]
            [jp-go-dds.core :as dds]))

;; ---------------------------------------------------------------------------
;; data — 1:1 port of +page.svelte's inline `const app = {...}`
;; ---------------------------------------------------------------------------

(def default-app
  {:title "Contentengine Cten0001"
   :project "etzhayyim-project-contentengine"
   :name "contentengine-cten0001"
   :kind "appview"
   :route-count 0
   :routes []
   :vars []
   :xrpc? true
   :relative-path "60-apps/etzhayyim-project-contentengine/appview/contentengine-cten0001/svelte/src/routes/+page.svelte"})

;; ---------------------------------------------------------------------------
;; pure helpers — the {#if}/ternary expressions the Svelte template inlined
;; ---------------------------------------------------------------------------

(defn xrpc-label
  "Ports `{app.xrpc ? 'enabled' : 'not configured'}`."
  [xrpc?]
  (if xrpc? "enabled" "not configured"))

(defn has-routes?
  "Ports `{#if app.routes.length}`."
  [routes]
  (boolean (seq routes)))

(defn has-vars?
  "Ports `{#if app.vars.length}`."
  [vars]
  (boolean (seq vars)))

;; ---------------------------------------------------------------------------
;; re-frame — event/sub handlers kept as plain functions so they are testable
;; without a running re-frame app-db.
;; ---------------------------------------------------------------------------

(defn initialize-db
  [_db _event]
  default-app)

(defn app-query
  [db _query-v]
  db)

(rf/reg-event-db :initialize-db initialize-db)
(rf/reg-sub :app app-query)

;; ---------------------------------------------------------------------------
;; view — built from jp-go-dds.core hiccup (DADS), replacing the Svelte
;; scaffold's hand-rolled <style> block. Every section below corresponds to
;; one <section> in the original +page.svelte.
;; ---------------------------------------------------------------------------

(defn top-section
  "Ports `<section class=\"top\">` — kind chip, h1 title, monospace name."
  [{:keys [kind title name]}]
  [:section {:class "dds-ext-hero dds-ext-center"}
   (dds/chip-label (str "Cloudflare " kind) {:color "blue"})
   (dds/heading 1 title {:size "45"})
   [:span {:class "dds-ext-lead"} name]])

(defn facts-section
  "Ports `<section class=\"facts\">` — Project / Routes / XRPC, one dds-ext-card each."
  [{:keys [project route-count xrpc?]}]
  (dds/grid {:min "12rem"}
            (dds/card [:span {:class "dds-ext-lead"} "Project"]
                      [:strong project])
            (dds/card [:span {:class "dds-ext-lead"} "Routes"]
                      [:strong (str route-count)])
            (dds/card [:span {:class "dds-ext-lead"} "XRPC"]
                      [:strong (xrpc-label xrpc?)])))

(defn public-routes-section
  "Ports the \"Public Routes\" panel, including its {#if}/{:else}."
  [{:keys [routes]}]
  (dds/section
   {:title "Public Routes"}
   (if (has-routes? routes)
     (into [:ul] (map (fn [route] [:li route]) routes))
     [:p {:class "dds-ext-lead"}
      "No public route is declared next to this app surface."])))

(defn runtime-bindings-section
  "Ports the \"Runtime Bindings\" panel, including its {#if}/{:else}."
  [{:keys [vars]}]
  (dds/section
   {:title "Runtime Bindings"}
   (if (has-vars? vars)
     (apply dds/row (map (fn [v] (dds/chip-label v {:color "gray"})) vars))
     [:p {:class "dds-ext-lead"}
      "No public vars are declared in the nearest wrangler config."])))

(defn source-section
  "Ports the \"Source\" panel — the (already-known-stale, see ns docstring)
  pre-extraction relativePath."
  [{:keys [relative-path]}]
  (dds/section
   {:title "Source"}
   [:p {:class "dds-ext-lead"} relative-path]))

(defn app-view
  "Ports the original `<main>` wrapping all five `<section>`s directly (top,
  facts, 3 panels) — `dds-ext-container` supplies the max-width/safe-area
  layout the Svelte scaffold's own `<style>` block hand-rolled."
  []
  (let [app @(rf/subscribe [:app])]
    (into [:main {:class "dds-ext-container"}]
          [(top-section app)
           (facts-section app)
           (public-routes-section app)
           (runtime-bindings-section app)
           (source-section app)])))

;; ---------------------------------------------------------------------------
;; mount
;; ---------------------------------------------------------------------------

(defn ^:export main []
  (rf/dispatch-sync [:initialize-db])
  (rdom/render [app-view] (.getElementById js/document "app")))
